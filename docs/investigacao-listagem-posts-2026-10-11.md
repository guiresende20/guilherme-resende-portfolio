# Investigação da listagem de posts no chat

Data: 11/10/2026. Base: `98dbbc4`. Site consultado: https://guiresende20.netlify.app.

## Evidência e limites do diagnóstico

O catálogo público `/api/blog/list` retornou oito posts publicados. Ao repetir
`lista os meus posts e os titulos deles` no `/api/chat`, com histórico vazio,
o servidor respondeu HTTP 200, mas enumerou somente quatro títulos e apresentou
essa resposta como o catálogo atual. A única fonte citada era um trecho de
“Hello World! Por trás deste blog: Drive, IA e automação ao vivo”.

A consulta regular do RAG busca no máximo cinco trechos, com até dois por post.
Ela não fornece um inventário dos títulos. A rota específica de último post
já consultava os metadados publicados, o que explica a diferença entre os dois
caminhos de recuperação.

No componente de chat, uma falha exibia o erro, mas não guardava a pergunta
nem a mensagem de erro no histórico enviado ao servidor. Assim, a pergunta
seguinte `pq nao conseguiu ?` chegava sem contexto daquela tentativa. O prompt
também continha um “exemplo obrigatório” sobre contrato e data de palestra;
o texto desse exemplo coincide com a resposta fora de assunto relatada.
Isso identifica uma provável origem do conteúdo, mas não demonstra o processo
interno da geração original. Nesta investigação, repetir a pergunta sem
histórico produziu um pedido de esclarecimento, não a resposta sobre contrato.

Não foi capturada a saída bruta nem o código de validação da primeira tentativa
do diálogo relatado. A mensagem genérica mostrada ao visitante é usada tanto
para respostas recusadas pela validação quanto para erros do provedor. Portanto,
não é possível atribuir aquela falha específica a uma regra, timeout ou erro
do Gemini com certeza.

## Correção

- Pedidos de listagem consultam todos os arquivos de posts no Drive, tanto
  Markdown quanto Google Docs, excluem rascunhos e ordenam pela data publicada.
- Listagem e último post compartilham o leitor de catálogo, com validação de
  datas e slugs. Uma falha em qualquer arquivo impede apresentar uma lista
  parcial como catálogo completo.
- O servidor monta a resposta de títulos diretamente dos metadados. Esse
  caminho funciona sem chave Gemini e preserva os títulos publicados.
- O pedido atual de catálogo tem prioridade sobre assuntos antigos no histórico.
  “Procure e liste seus posts” também consulta o catálogo local; pedidos
  explícitos de pesquisa externa mantêm o caminho de pesquisa.
- Pedidos de pontos, argumentos e resumos de artigos continuam consultando
  conteúdo, em vez de serem desviados para o catálogo de títulos.
- Falhas guardam o turno de conversa no navegador, com limite para o texto
  retido. Esse histórico é contexto de diálogo, nunca evidência factual.
- A pergunta curta sobre uma falha recebe uma resposta do servidor que reconhece
  a falha quando ela aparece no histórico e informa que sua causa não está
  confirmada. Sem esse contexto, pede o referente.
- O exemplo de contrato/palestra agora está explicitamente restrito a perguntas
  sobre esses assuntos.

O limite existente de 800 caracteres foi mantido. Os oito títulos atuais cabem
na resposta. Caso o catálogo cresça além desse limite, a resposta encaminha à
lista completa na seção Blog, sem alegar ter enumerado todos os títulos.

## Verificação

Os novos testes foram executados antes da correção e falharam pelas diferenças
esperadas de comportamento. Após a implementação e a revisão, passaram.

- `npm test -- --run`: **38 arquivos, 321 testes passaram**.
- `npm run build`: **passou**, incluindo TypeScript das funções. Permanecem
  avisos preexistentes de ferramentas, Browserslist e tamanho de bundle.
- `node tmp/verify-blog-listing-20261011.mjs`: o handler local consultou o Drive
  real e listou os oito títulos, em português, com a chave Gemini desativada.
  HTTP 200 em aproximadamente 3,8 segundos.
- No mesmo script, uma pergunta sobre falha com histórico de erro recebeu
  HTTP 200 e uma resposta pertinente, sem contrato ou palestra.
- A listagem após uma pergunta sobre último post incluiu os oito títulos.
- A consulta `lista seu ultimo post`, com Gemini real, recebeu HTTP 200 e citou
  o post de 25/07/2026 como o mais recente, em aproximadamente 4,4 segundos.

Resultados locais: `tmp/verify-blog-listing-20261011-results.json`.
O script não publica o site, reindexa posts, edita documentos ou grava chat logs.

## Generalização das consultas

A listagem passou a usar uma camada compartilhada para inventários de posts,
projetos exibidos no portfólio e artigos científicos mencionados nas fontes.
O leitor retorna registros e indica se o catálogo é completo. O executor faz
contagem, filtros por datas inclusivas, texto em títulos/resumos/tags, tag exata,
ordenação e paginação. A contagem sempre ocorre antes de limitar a listagem.

Pedidos simples de lista ou total dispensam geração. Pedidos com filtros e
continuações usam Gemini apenas para interpretar parâmetros JSON, validados
antes da execução. O modelo não calcula totais e não cria registros. Modificadores
desconhecidos não são descartados; consultas não representáveis pedem
esclarecimento. Pedidos com múltiplos catálogos pedem qual consultar primeiro.
Se a interpretação escolher conteúdo, essa decisão força a recuperação RAG.

O histórico existente mantém até seis trocas recentes. O interpretador recebe
as seis perguntas mais recentes do visitante para resolver referências e
preservar filtros, sem tratar as respostas anteriores do modelo como fatos.
Não foi necessária infraestrutura nova para memória de conversa.

Projetos são contados como os dez registros exibidos no site, sem alegar total
da carreira. O catálogo acadêmico tem dois artigos explicitamente documentados
e é parcial: a resposta declara que não confirma o total publicado. Projetos
e artigos científicos não têm datas completas e não recebem datas inventadas.

O botão e a fonte do catálogo do blog apontam para `/blog`, pois o blog é uma
página própria. Os validadores do cliente aceitam esse caminho e os caminhos
dos posts; continuam recusando outros caminhos relativos.

### Verificação da generalização

A suíte final passou com **40 arquivos e 388 testes**. O build passou com
TypeScript do frontend e das funções. A revisão final confirmou o encaminhamento
de todos os casos de múltiplas coleções ao interpretador.

`node scripts/smoke-catalog-chat.mjs` verifica o handler local com Drive e Gemini
reais, sem gravar chat logs. Foram confirmadas dez respostas HTTP 200:

- Todos os oito títulos publicados, com datas e link ao catálogo.
- Contagem de oito posts em inglês.
- Três posts publicados em junho de 2026, excluindo os demais meses.
- Continuação “e quantos posts?” preservando junho de 2026 e retornando três.
- Os três últimos posts selecionados pela data publicada.
- Dez projetos exibidos no portfólio.
- Dois artigos científicos mencionados, com ressalva de catálogo parcial.
- Pedido de ano quando a pergunta menciona junho sem ano.
- Explicação pertinente após uma resposta de erro.
- Seis posts contendo IA ou seus aliases nos metadados, com escopo explícito.

Relatórios: `tmp/catalog-chat-local-smoke.json` e, após a publicação,
`tmp/catalog-chat-production-smoke.json`. Para verificar o site publicado, use
`node scripts/smoke-catalog-chat.mjs --production`.

A publicação usa o deploy contínuo do Netlify conectado à branch `main`;
é necessário confirmar que o deploy publicado corresponde ao SHA enviado e
repetir a verificação HTTP em produção.
