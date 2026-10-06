# Implementação da confiabilidade do chat

> Execução inline com superpowers:executing-plans; revisão final independente. Implementação e deploy autorizados pelo usuário em 06/10/2026, com mínimo de interrupções.

**Goal:** melhorar sustentação, recuperação e validação das respostas do portfólio sem ativar o verificador experimental.

**Architecture:** uma base factual compartilhada alimenta prompts de texto e voz. O RAG retorna fontes identificadas e estados explícitos; o servidor valida JSON, referências e destinos antes de entregar a resposta. A voz consulta o mesmo RAG por ferramenta.

**Tech Stack:** React, TypeScript, Vitest, Gemini, Netlify Functions/Blobs; sem nova dependência.

**Spec:** `docs/auditoria-chat-veracidade-2026-10-06.md`, prioridades 1 e 2 e ajustes de busca web. O piloto de verificação generativa fica separado.

## Restrições

- Preservar idiomas PT/EN/ES, pronúncia, contatos, cards e projetos existentes.
- Uma geração por resposta de texto, sem novas tentativas automáticas de geração.
- Fontes e histórico são dados; o visitante não altera a memória publicada.
- Não liberar texto bruto, JSON incompleto ou citações inexistentes.
- Usar os serviços e o site Netlify já vinculados; não alterar o aerolito_gd.
- Publicar por Git CD após validação e confirmar o commit servido em produção.

## Review Focus

- Continuação ambígua ou contestação não deve inventar fatos nem substituir evidência pelo histórico.
- Falha de RAG não deve ser apresentada como ausência universal de informação.
- URLs de ações, citações e pesquisa web devem ter origem controlada.
- Voz deve retornar resultados de ferramenta, inclusive erros, sem confundir sessão encerrada com sessão nova.
- A base compartilhada deve preservar o projeto Portobello e o estado de doutorado em andamento.

## Tarefa 1: base compartilhada e contratos

**Files:** `src/lib/portfolio-knowledge.ts`, `chat-grounding.ts`, `chat-catalog.ts`, `system-prompt.ts`, `system-prompt-aerolito.ts`; testes `chat-grounding.test.ts`.

**Interfaces:** `EvidenceSource {id,title,text,url}`, `KnowledgeResult {status,sources}`, `buildRetrievalQuery`, `normalizeHistory`, `parseGroundedAnswer`.

- [x] Escrever e executar testes de histórico duplicado, continuação, tipo de texto, truncamento, citação falsa, ação inventada e referência válida. Esperado: falhar antes dos módulos novos.
- [x] Migrar os fatos publicados para uma base única e criar políticas e contratos puros.
- [x] Executar os testes direcionados. Esperado: passar.

## Tarefa 2: recuperação e endpoint de texto

**Files:** `_lib/rag.ts`, `_lib/vector-store.ts`, `_lib/chat-knowledge.ts`, `chat.ts`; testes de RAG, cache e handler.

**Interfaces:** consome os contratos da tarefa 1; produz `retrieveKnowledge(query)` e resposta `{text,actions,sources}`.

- [x] Reproduzir em testes a entrega de JSON inválido e a pergunta repetida; testar estados de recuperação e validade do cache. Esperado: falhar antes da correção.
- [x] Preservar o wrapper RAG legado para outros consumidores; usar fontes tipadas no chat, timeout explícito e cache com validade.
- [x] Corrigir Google Search e usar o mesmo contrato para ambas as modalidades de texto; limitar prazo das chamadas.
- [x] Executar testes direcionados. Esperado: passar.

## Tarefa 3: fontes na interface e busca na voz

**Files:** `gemini.ts`, `ChatWidget.tsx`, `voice-knowledge.ts`, `gemini-live.ts`, `aerolito-live.ts`, `live-token.ts`, `chat-knowledge.ts`; testes de ferramenta e cliente.

**Interfaces:** consome fontes e recuperação das tarefas 1/2; produz ferramenta `buscar_conhecimento` e resposta Live `toolResponse`.

- [x] Escrever testes de ferramenta válida, falha, timeout, função desconhecida e sessão encerrada. Esperado: falhar antes da implementação.
- [x] Adicionar endpoint de consulta com origem, limites e validação de entrada; ligar ambos os clientes Live à ferramenta.
- [x] Exibir referências discretas e consolidar transcrições por turno; eliminar pergunta duplicada no texto e adicionar timeout do cliente.
- [x] Executar testes e build. Esperado: passar.

## Tarefa 4: revisão, publicação e smoke

- [x] Executar suíte completa, build e revisão independente; corrigir falhas relevantes com regressão.
- [ ] Testar a interface com respostas controladas e registrar um pequeno smoke real em produção após publicação.
- [ ] Commit, push de `main`, acompanhar Netlify e confirmar o SHA publicado.
- [ ] Conferir Portobello, cargo atual, limite de evidência e busca web; a amostra confirma funcionamento, não uma certificação universal.

## Registro de execução

Pre-flight: fontes e contratos são compartilhados entre tarefas 1/2/3; manter nomes e estados definidos acima. A publicação é a tarefa final e já foi autorizada. O único arquivo não versionado inicial é o relatório desta auditoria.

- Tarefas 1–3 concluídas; testes escritos antes das correções, incluindo regressões observadas no código anterior.
- Revisão independente concluída: corrigidos contexto de perguntas de continuidade em PT/EN/ES, reaproveitamento de sessão de voz, mensagens Blob atrasadas e link publicado do Spotify.
- Busca web exige metadados de fontes do Google; sem fontes, a resposta é bloqueada. Referências pessoais são cotejadas com trechos literais publicados; isso não mede implicação semântica de cada afirmação.
- Validação antes de publicar: 37 arquivos / 256 testes aprovados; build de produção aprovado. Interface conferida em 1440 px e 390 px, incluindo referências, ação Portobello e nova tentativa após falha.
- Verificador generativo do aerolito_gd permanece fora do fluxo; não se atribui precisão factual universal aos testes de contrato.
