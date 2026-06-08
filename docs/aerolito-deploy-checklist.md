# Aerolito — Deploy Checklist

Antes de divulgar o link `/aerolito` para o time:

## Pré-flight (uma vez)

- [ ] Aplicar schema SQL: copiar `docs/aerolito-supabase-schema.sql` no Supabase SQL Editor e executar
- [ ] Gerar `AEROLITO_ADMIN_TOKEN`: `openssl rand -hex 32`
- [ ] Gerar `AEROLITO_IP_HASH_SALT`: `openssl rand -hex 16`
- [ ] Setar no Netlify: UI → Site → Env vars → criar `AEROLITO_ADMIN_TOKEN` e `AEROLITO_IP_HASH_SALT` (production scope)
- [ ] Preencher os 2 blocos TODO em `src/lib/system-prompt-aerolito.ts`: `## CONTEXTO AEROLITO` e `## HEAD DE PESQUISA — VISÃO`
- [ ] Fornecer e integrar a animação HTML em `src/components/aerolito/AerolitoIntro.tsx` (substituir o placeholder)
- [ ] Deploy para produção

## Teste end-to-end no preview

- [ ] Rodar: `node scripts/smoke-aerolito.mjs <preview-url> <AEROLITO_ADMIN_TOKEN>` → todos verdes
- [ ] Abrir `/aerolito` num browser, esperar a animação, escrolar pro chat
- [ ] Mandar uma pergunta texto e confirmar: áudio toca + texto aparece em sync
- [ ] Clicar "🤝 Contribuir como colega Aerolito" → IA fala a 1ª pergunta → digitar resposta → avança
- [ ] Completar as 5 perguntas
- [ ] Abrir `/aerolito/admin?token=<AEROLITO_ADMIN_TOKEN>`: ver a sessão de teste
- [ ] Clicar "Gerar proposta de bullets com IA": editar texto se preciso
- [ ] Clicar "Publicar na trajetória"
- [ ] Abrir `/` (homepage) → seção Trajetória → confirmar card "Head de Pesquisa" aparece como primeiro
- [ ] Digitar "RESETAR" e clicar "Resetar tudo" → confirmar backup baixado, card some da homepage

## Divulgação

- [ ] Compartilhar link `https://guiresende20.netlify.app/aerolito` (sem indexação — `noindex` ativo)
- [ ] Aguardar respostas
- [ ] Quando satisfeito com volume: abrir admin → consolidar → publicar
