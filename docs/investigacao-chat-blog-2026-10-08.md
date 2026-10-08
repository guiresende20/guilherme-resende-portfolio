# Investigação: perguntas sobre posts no chat

Data: 08/10/2026. Checkout: `676c41a`. Produção consultada: `https://guiresende20.netlify.app`, header `X-Chat-Knowledge-Version: portfolio-2026-10-06-v1`.

## Resultado

O RAG tem acesso ao blog e retornou fontes durante a investigação. A pergunta “me fale do seu ultimo post” reproduziu HTTP 502 em produção. No handler atual, esse código corresponde a `InvalidChatAnswer`: a saída do modelo foi recusada pela validação. Falhas do provedor usam 503.

Há também um erro independente: a recuperação por semelhança não fornece datas nem identifica cronologicamente o post mais recente. O modelo tenta deduzir a ordem a partir de trechos. A validação de citações não verifica essa dedução.

Na etapa inicial de investigação, nenhuma alteração foi feita no comportamento do chat ou na publicação. Foram adicionados somente este relatório e um script de diagnóstico local. As correções posteriores estão registradas ao final.

## Evidências em produção

| Consulta | Resultado observado |
| --- | --- |
| `GET /api/blog/list` | 200; oito posts publicados |
| `POST /api/chat`, “me fale do seu ultimo post”, histórico vazio | 502 |
| `POST /api/chat-knowledge`, mesma pergunta | 200, `status: ok`, cinco fontes |
| `POST /api/chat`, “Resuma o post Da rancheta ao prompt” | 200; resumo pertinente do post e link |
| `POST /api/chat`, “me fale de seus projetos” | 502 nesta execução |

A lista pública indica como post mais recente **“Da rancheta ao prompt - talk sobre IA para arquiterura e design”**, de **25/07/2026**. O artigo **“Mudei do Gemini 2.5 para o 3.1”** é de **23/05/2026**.

A recuperação para “ultimo post” retornou:

- Um trecho final do artigo de julho, com imagem JPEG em base64; os primeiros 6.000 caracteres foram enviados como texto de evidência.
- Dois trechos de “Por trás deste blog”, publicado em maio.
- “Teste de audio”.
- Um trecho de “Mudei do Gemini 2.5 para o 3.1”.

Nenhuma das fontes desse resultado traz metadados de publicação. O título específico “Da rancheta ao prompt” recupera o começo do artigo, com a descrição da palestra e do aplicativo, permitindo uma resposta útil.

## Reprodução local com o modelo real

O script [diagnose-blog-chat.mjs](../tmp/diagnose-blog-chat.mjs) usa as fontes retornadas pelo endpoint público, o prompt e schema do checkout atual, o mesmo modelo `gemini-3.1-flash-lite` e a chave Gemini local. Foram feitas duas gerações por pergunta, com histórico vazio. Não é uma captura da saída bruta da requisição original de produção: as gerações são novas e podem variar.

Resultados completos: `tmp/diagnose-blog-chat-results.json`. Nenhuma chave foi registrada.

| Pergunta / rodada | Validação | Achado |
| --- | --- | --- |
| Último post / 1 | Rejeitada | Texto menciona `2026`; a única citação literal não contém o ano. Reproduz a barreira de anos de `parseGroundedAnswer`. |
| Último post / 2 | Aceita | Incluiu outra citação contendo `2026`, mas chamou incorretamente o artigo de maio de “mais recente”. |
| Projetos / 1 | Aceita | Citações literais encontradas nas fontes. |
| Projetos / 2 | Rejeitada | Citação `Projeto Aula 360º – Educação Imersiva` não corresponde literalmente à fonte. |

Isso demonstra dois mecanismos de rejeição e uma resposta cronologicamente falsa que passa na validação. O servidor não registra hoje a regra específica que rejeitou cada resposta; portanto, não é possível atribuir a requisição original do usuário a uma dessas regras com certeza.

## Origem da afirmação sobre atualização a cada dez minutos

O trecho recuperado de “Por trás deste blog” afirma que a lista entra no system prompt e é atualizada a cada dez minutos. Outro trecho do mesmo artigo trata o RAG com conteúdo completo como um item de roadmap.

O código atual de [chat.ts](../netlify/functions/chat.ts) injeta a base biográfica e os trechos recuperados a cada pergunta, sem carregar a lista de posts. Logo, o conteúdo histórico do artigo não comprova o funcionamento atual do sistema.

O exemplo de automação em [blog-reindex-webhook.gs](blog-reindex-webhook.gs) instala um gatilho de **15 minutos** que chama `/api/blog/reindex`. A presença desse exemplo no repositório não confirma que o gatilho esteja instalado ou saudável no Google Apps Script. A integração automática não foi auditada na conta Google nesta investigação.

Há uma inconsistência adicional em [blog-revalidate.ts](../netlify/functions/blog-revalidate.ts): a reindexação por slug considera apenas `.md` e exclui Docs nativos, enquanto `/api/blog/reindex` aceita ambos. Não foi demonstrado que essa inconsistência causou a conversa relatada; o artigo de julho está acessível no RAG.

## Causas e correção recomendada

1. **Resolver “último post” pela data publicada.** Consultar metadados dos posts, selecionar a maior data válida entre publicados e carregar seu texto. A lista visual prioriza `featured`, portanto não basta usar seu primeiro item. Enviar ao modelo título, data e evidência explícita da seleção cronológica.
2. **Separar fatos atuais do sistema de relatos históricos.** Fornecer uma descrição atual da capacidade de consulta do chat e instruir que artigos sobre versões antigas não confirmam a configuração em execução. Não prometer periodicidade automática sem verificar a automação.
3. **Tratar rejeições sem entregar conteúdo inválido.** Registrar um código específico de validação e considerar uma única reparação limitada da saída com as mesmas fontes, preservando as barreiras factuais. Para indisponibilidade final, mostrar a mensagem útil do servidor em vez de substituir tudo por “Ops”.
4. **Limpar imagens embutidas antes da indexação.** Remover dados binários/base64 do texto usado em embeddings e contexto; reindexar após essa mudança. O payload observado confirma a presença de base64, mas esta investigação não mediu isoladamente seu impacto no ranking.

Apenas trocar o modelo, ampliar o limite ou desativar a conferência de citações não resolve a seleção cronológica. A segunda geração local já passou no contrato e ainda indicou o post errado.

## Verificação dos testes existentes

Comando executado: `npm test -- --run netlify/functions/__tests__/chat.test.ts netlify/functions/_lib/__tests__/chat-knowledge.test.ts src/lib/__tests__/chat-grounding.test.ts`.

Resultado: **três arquivos e 40 testes passaram**. Esses testes verificam mecanismos de histórico, consulta e validação com mocks; não cobrem a seleção cronológica do post nem garantem que o modelo real produzirá citações válidas. O contraste com as chamadas reais documentadas acima mostra essa lacuna de cobertura.

## Correções implementadas e validação após a retomada

As mudanças locais agora selecionam o post mais recente pela data de publicação do catálogo completo, incluindo Google Docs e excluindo rascunhos. Datas inválidas, falhas parciais e timeout impedem uma afirmação de recência sem comprovação. Perguntas sobre o funcionamento atual do assistente recebem a fonte operacional atual, sem recuperar descrições históricas como configuração vigente.

A geração de texto escolhe IDs curtos de trechos fornecidos pelo servidor. O servidor resolve esses IDs para as citações literais e mantém a validação de fontes, URLs e anos. Isso elimina a necessidade de o modelo reproduzir capitalização e pontuação das citações. Uma reparação limitada continua disponível para respostas rejeitadas. IDs desconhecidos são recusados. Afirmações sobre automação que citam a fonte operacional precisam preservar a incerteza registrada, em vez de afirmar categoricamente que a automação funciona ou não funciona. A mensagem de erro do servidor passa a ser exibida no chat.

Imagens em base64 são removidas do texto antes da indexação e do contexto recuperado quando possuem os marcadores de imagem. Caudas de base64 isoladas pelo overlap de índices antigos podem não conter esses marcadores: a limpeza completa desses trechos e dos embeddings já existentes requer uma reindexação posterior. A revalidação por slug também aceita posts nativos do Google Docs.

Verificação em 08/10/2026: **38 arquivos e 301 testes passaram** com `npm test -- --run`; **build do site e das funções passou** com `npm run build`. Permanecem avisos já existentes de ferramentas e tamanho de bundle. A revisão também levou a testes que preservam pedidos explícitos de resumo e de conteúdo histórico, mesmo quando o título do artigo contém “prompt” ou “RAG”, e que diferenciam incerteza sobre automação de certeza sobre acesso ao blog, inclusive em inglês.

O script [verify-blog-chat-fix.mjs](../tmp/verify-blog-chat-fix.mjs) repetiu cinco perguntas com o Gemini real e fontes reais. Todas as respostas passaram na validação: acesso ao blog, atualização do RAG, último post, projetos e resumo do artigo pelo título. O artigo de julho foi selecionado e citado; o assistente informou que a atualização automática não está confirmada. Resultado salvo em `tmp/verify-blog-chat-fix-results.json`. Essa execução valida o código local; não comprova o comportamento de uma versão ainda não publicada.

**Estado:** mudanças locais verificadas; nenhuma publicação ou reindexação em produção foi executada nesta retomada.
