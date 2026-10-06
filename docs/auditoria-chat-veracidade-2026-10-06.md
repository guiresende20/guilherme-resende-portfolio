# Auditoria do chat: evidência e veracidade

Data: 06/10/2026. Portfólio analisado no commit `bcd7fbe`; comparação com o checkout local do `aerolito_gd`, branch `main`, commit `16da858`.

## Parecer

É possível melhorar o chat aproveitando mecanismos do `aerolito_gd`. A primeira etapa recomendada é organizar os fatos, aplicar uma política explícita de evidência, melhorar a recuperação de fontes e validar a saída antes da entrega. O verificador generativo deve ser avaliado separadamente: os próprios relatórios do outro projeto registram erros de aprovação.

A análise foi feita no código, nos testes existentes e nos relatórios locais. Não foi executada uma campanha com o modelo real nem medido o índice de erros factual do portfólio. Os achados abaixo descrevem barreiras ausentes e riscos demonstrados pelo fluxo do código; não afirmam que uma determinada resposta falsa já ocorreu em produção.

## Fluxo atual e achados

### 1. Há contexto, mas não uma verificação factual antes da entrega

O [chat de texto](../netlify/functions/chat.ts) junta biografia, resumos dos posts e trechos recuperados do blog, faz uma geração e entrega o resultado. A instrução para não inventar está presente, mas não há conferência posterior de afirmações, datas, autoria ou referências. A validação atual protege a estrutura das ações, não o suporte factual da resposta.

Melhoria: separar fatos pessoais, opiniões publicadas e conhecimento geral. Exigir sustentação para experiências, datas, resultados e autoria; responder a parte confirmada e indicar a lacuna restante. Uma pergunta ou contestação do visitante deve motivar consulta, sem se tornar uma atualização da biografia. A resposta anterior do assistente também não deve ser tratada como prova.

### 2. Texto e voz mantêm bases separadas

A biografia do texto está embutida em `netlify/functions/chat.ts`; a voz recebe [outro prompt](../src/lib/system-prompt.ts), pelo `ChatWidget.tsx:249`. Eles já têm diferenças: CAPES aparece no bloco factual do texto e não no equivalente da voz; o total de anos de experiência aparece no texto e a linha de números da voz termina incompleta. A página, por sua vez, descreve o cargo como Head de Pesquisa e de IA, enquanto os prompts dizem Head de Pesquisa. Isso exige alinhamento editorial, não uma conclusão automática sobre qual versão é verdadeira.

Melhoria: uma base de fatos versionada, compartilhada por texto e voz, com campos de período, origem e revisão. Estilo, pronúncia e formato de resposta ficam separados dessa base. O aplicativo Portobello deve preservar o escopo informado: foi desenvolvido com IA para uma palestra a pedido da empresa; isso não comprova preço, contrato comercial, implantação oficial ou resultados de vendas.

### 3. A voz principal não consulta as fontes do blog

O [cliente Live](../src/lib/gemini-live.ts) envia o prompt estático e reproduz o áudio recebido diretamente. Não declara uma ferramenta de busca de conhecimento. A frase do prompt que manda procurar informações no site não fornece essa capacidade. Perguntas sobre posts novos ou detalhes ausentes não terão a mesma evidência disponível no texto.

A página `/aerolito` tem um fluxo diferente: `netlify/functions/aerolito-chat.ts:137` carrega trechos e atribuições publicadas ao iniciar a sessão; `AerolitoChatWidget.tsx` reutiliza a conexão. Esse contexto inicial não equivale a uma nova consulta para cada assunto da conversa.

Melhoria: adaptar a ferramenta de busca do outro projeto para o índice já existente no portfólio, retornando fontes e estados explícitos. Na voz, isso melhora o acesso a evidência, mas não constitui aprovação de cada frase antes de sua reprodução. Aplicar um verificador de texto depois da emissão do áudio não impediria que uma resposta incorreta já fosse ouvida.

### 4. Falha de consulta e ausência de resultado são indistinguíveis para o modelo

Em [rag.ts](../netlify/functions/_lib/rag.ts), erro de embedding, erro de armazenamento e ausência de trechos retornam a mesma string vazia. O timeout de 1,5 segundo em `chat.ts:46` também retorna vazio. O modelo continua respondendo com a biografia e os resumos. Isso permite confundir uma consulta indisponível com informação que não foi publicada.

Melhoria: devolver `{ status, sources }`, distinguindo sucesso, ausência de resultados, timeout e erro. Se a pergunta depender da fonte indisponível, informar a falha temporária. Fatos já presentes na base biográfica podem continuar sendo respondidos. O índice em memória também merece validade ou versão: `vector-store.ts:69` reutiliza seu cache sem prazo, e uma atualização feita por outra instância pode não aparecer imediatamente numa instância já aquecida.

### 5. A busca não resolve bem perguntas de continuidade

O servidor recupera fontes somente para `message`, sem usar perguntas anteriores. Uma continuação como “e quando foi?” perde o projeto de referência. Além disso, `ChatWidget.tsx:263` inclui a pergunta atual no histórico e `chat.ts:575` envia essa mesma pergunta novamente por `sendMessage`; o SDK instalado monta `contents` adicionando a mensagem ao histórico recebido. A pergunta entra duas vezes no contexto de geração.

Melhoria: enviar cada mensagem uma vez e adaptar `buildRetrievalQuery` do outro projeto. O helper usa perguntas anteriores do usuário para continuações simples e limita o tamanho da consulta. Sua heurística não resolve toda ambiguidade; quando faltar referente, pedir esclarecimento. O histórico serve para localizar o assunto, não para comprovar os fatos.

### 6. O JSON e os links não possuem um contrato factual

Em `chat.ts:589`, `parsed.text` é aceito sem checagem de tipo ou limite. JSON inválido é transformado em texto por expressões regulares e entregue. Não há verificação do motivo de término da geração. A limitação de 400 caracteres é apenas uma instrução ao modelo.

[chat-actions.ts](../src/lib/chat-actions.ts) aceita qualquer endereço HTTPS como `link`, qualquer destino `wa.me` e qualquer e-mail sintaticamente válido. Isso não confirma que sejam os contatos ou materiais do Guilherme. Ações de blog com `/blog/<slug>` também não são aceitas como links por essa validação, embora o prompt sugira esse formato.

Melhoria: schema de saída e validação em runtime; rejeitar saída vazia, com tipo errado ou truncada, sem publicar texto bruto como resposta normal. Resolver ações por um catálogo de contatos, vídeos, projetos e posts realmente disponíveis. Para fontes, conferir pertencimento ao conjunto recuperado e a existência literal da citação. Essas checagens confirmam origem e formato, não a implicação semântica da afirmação.

### 7. O modo de busca web precisa de ajuste

`chat.ts:540` aciona busca por palavras amplas como “internet”, inclusive em perguntas biográficas sobre o TCC. O caminho usa `googleSearchRetrieval` com Gemini 3.1 Flash-Lite e aproveita somente `.text()`, sem processar `groundingMetadata` para apresentar as fontes.

A [documentação do Google para a API Generate Content](https://ai.google.dev/gemini-api/docs/generate-content/google-search) orienta usar `google_search` nos modelos atuais e mostra como associar trechos às fontes com os metadados de grounding. A configuração atual diverge dessa orientação; não foi feita uma chamada real para medir sua falha operacional.

Melhoria: corrigir a ferramenta/adaptador compatível com o SDK escolhido, distinguir conhecimento profissional de notícias externas e apresentar as referências efetivamente retornadas. Informação pública sobre terceiros não deve virar experiência pessoal do Guilherme.

## O que aproveitar do aerolito_gd

| Componente | Aproveitamento recomendado | Adaptação necessária |
| --- | --- | --- |
| [grounding-policy.ts](../../aerolito_gd/src/lib/grounding-policy.ts) | Regras de autoria, período, lacunas, contestações e fontes como dados | Preservar o tom do portfólio; retirar dependência do template de gêmeos |
| [retrieval-query.ts](../../aerolito_gd/src/lib/retrieval-query.ts) | Consulta contextual para continuações | Mapear `model` para `assistant`; eliminar a pergunta duplicada |
| [grounded-answer/types.ts](../../aerolito_gd/src/lib/grounded-answer/types.ts) e [contracts.ts](../../aerolito_gd/src/lib/grounded-answer/contracts.ts) | Fontes identificadas, citações literais, validação de saída e URLs | Usar IDs do perfil/blog e incorporar as ações do portfólio |
| [profile.ts](../../aerolito_gd/src/lib/grounded-answer/profile.ts) | Separar biografia de instruções e limitar contexto | Seus delimitadores não correspondem aos prompts daqui; preferir fatos estruturados compartilhados |
| [voice-knowledge/tool-contract.ts](../../aerolito_gd/src/lib/voice-knowledge/tool-contract.ts) e [retrieval.ts](../../aerolito_gd/src/lib/voice-knowledge/retrieval.ts) | Busca durante a voz, fontes e estados de consulta | Usar Netlify Blobs/RAG existentes; adaptar sessão e endpoint, sem copiar o banco de gêmeos |
| [scripts/reliability](../../aerolito_gd/scripts/reliability/README.md) | Campanha reproduzível, revisão integral, latência e registro de resultados | Criar perguntas e fontes do Guilherme; não reutilizar métricas como se fossem deste chat |
| [grounded-answer/generate.ts](../../aerolito_gd/src/lib/grounded-answer/generate.ts) | Piloto de geração, verificação e uma reparação | Avaliar precisão, demora e custo com o modelo e as fontes deste projeto antes de ativar |

## Limites dos experimentos do outro projeto

O [relatório v6](../../aerolito_gd/docs/reliability-2026-10-04/julgamento-chat-texto-v6.md) registra 43/49 alvos semânticos corretos, quatro falsos aceites negativos e reprovação do critério de ativação. A mediana de 2,498 segundos e o p95 de 3,976 segundos são da chamada de verificação, não da conversa completa. O fluxo normalmente faz duas chamadas generativas e pode chegar a quatro com reparação, além da recuperação.

O [piloto de geração simples](../../aerolito_gd/docs/reliability-2026-10-04/piloto-geracao-simples-beta-2026-10-05.md) documenta 19/24 respostas sustentadas e úteis contra 11/24 no controle, em uma amostra conhecida. Também documenta o verificador factual desligado na publicação daquele piloto. Isso apoia testar uma política mais simples e restrita; não comprova ausência geral de erros nem verifica a configuração de produção em tempo real hoje.

Por isso, reaproveitar a arquitetura e as regras não equivale a copiar uma solução já certificada. Mesmo uma resposta com citação literal pode extrapolar autoria, causa, estágio ou formato. A [documentação de saída estruturada](https://ai.google.dev/gemini-api/docs/structured-output) também exige validação dos valores pela aplicação; JSON válido não basta para avaliar veracidade.

## Ordem proposta e critérios de avaliação

1. Unificar fatos, aplicar a política de evidência, corrigir histórico e consulta contextual, distinguir os estados de recuperação e validar resposta/ações. Essa etapa preserva uma geração por resposta.
2. Oferecer fontes provenientes do servidor e busca de conhecimento durante a voz. Identificar material consultado não deve sugerir que todas as afirmações foram verificadas.
3. Avaliar um verificador de texto sob flag, entregando somente o texto aprovado e permitindo uma reparação. Mantê-lo separado da voz e medir a espera adicional.

A avaliação deve incluir cargo atual versus experiência anterior; doutorado em andamento versus título concluído; Portobello para palestra versus produto comercial; autoria própria versus autoria de terceiros; datas ou resultados não registrados; contestação incorreta do visitante; continuidade ambígua; link inventado; trecho truncado; consulta indisponível; e perguntas equivalentes em português, inglês e espanhol. Incluir respostas corretas para detectar recusas desnecessárias. Julgar a resposta inteira junto das fontes, inclusive qualificações e perguntas finais.

Verificação executada nesta auditoria: `npm test -- --run`, com 29 arquivos e 210 testes aprovados. A suíte cobre componentes e mecanismos existentes, mas não é uma campanha de veracidade com Gemini. Esta entrega adiciona apenas o relatório; o comportamento publicado do chat permanece na versão auditada.
