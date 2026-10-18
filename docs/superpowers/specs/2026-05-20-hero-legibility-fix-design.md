# Hero — fix de legibilidade pós-lift do canvas 3D

**Data:** 2026-05-20 (sessão pós-PR #8 commit `4f9a9bd`)
**Contexto:** depois que o canvas 3D virou background fixo (PR #8), o owner reportou problema visual no hero. A causa: o gradient radial dentro do hero (`bg-[radial-gradient(...)]` com `opacity-70`) cria zonas mais claras (centro) e mais escuras (bordas) dentro da section, mas as outras sections abaixo não têm esse gradient. O resultado é uma "quebra" visual no boundary hero/sobre — uma faixa cinza esquisita.

## Decisões do brainstorm

1. **Tema permanece dark.** O owner picou opção A no mockup ("Dark uniforme + cards translúcidos"). "Fundo branco" no contexto significou "uniforme/limpo", não literalmente branco.
2. **Sem cards.** Depois de ver mockups de 3 estilos de card, owner decidiu que cards não são necessários — o texto fica legível direto sobre o canvas/grid.
3. **Causa do problema = gradient radial do hero.** Owner confirmou opção 1: remover esse gradient resolve a quebra.

## Mudança

Em `src/components/Hero.tsx`, remover o elemento:

```tsx
<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0a0f_100%)] pointer-events-none opacity-70" />
```

Resultado: o hero fica com apenas `bg-grid` (linhas sutis) + o canvas fixo do `HeroScene3D` (partículas/spiral) atrás do conteúdo de texto. Mesma stack visual das outras sections, sem quebra no boundary.

## Validação

- Smoke `scripts/smoke-hero-scene.mjs` captura screenshots do topo, da seção projetos, e do retorno ao hero. Comparar visualmente que:
  - Texto "GUILHERME RESENDE MUNIZ" continua legível (já tinha contraste alto: branco/neon bold sobre fundo escuro)
  - O parágrafo de descrição (muted-foreground gray) ainda lê — owner valida que tá ok
  - Não tem mais quebra cinza visível no boundary hero → sobre

## Fora do escopo

- Outras sections (sobre/experiência/educação/skills/contato) — owner vai testar uma a uma; se alguma ficar ilegível, abre como follow-up separado.
- Mudança de tema (light/hybrid) — descartado no brainstorm.
- Card style — descartado depois que owner viu o site sem cards e achou ok.
