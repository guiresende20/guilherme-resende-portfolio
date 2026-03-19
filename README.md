# Guilherme Resende — Portfolio

Portfolio pessoal com tema dark Awwwards-inspired.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** + **tailwindcss-animate**
- Fontes: Clash Display, Satoshi, JetBrains Mono

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Build para produção

```bash
npm run build
```

Os arquivos são gerados em `dist/`.

## Deploy no Netlify

1. Crie um novo site no Netlify
2. Conecte ao repositório GitHub
3. Settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy automático a cada push

O arquivo `netlify.toml` já configura o redirect SPA.

## Estrutura

```
src/
├── components/
│   ├── Navbar.tsx          # Navegação fixa com links âncora
│   ├── Hero.tsx            # Seção hero com tipografia animada + marquee
│   ├── About.tsx           # Sobre mim + cards de expertise
│   ├── Experience.tsx      # Timeline de experiência profissional
│   ├── Projects.tsx        # Projetos, publicações, patente, prêmios
│   ├── Education.tsx       # Formação acadêmica
│   ├── Skills.tsx          # Barras de progresso por categoria
│   ├── Contact.tsx         # E-mail, WhatsApp, localização
│   ├── Footer.tsx          # Links rápidos + copyright
│   ├── ScrollProgress.tsx  # Barra de progresso neon no topo
│   ├── SectionHeader.tsx   # Header padronizado (estilo Awwwards)
│   └── Reveal.tsx          # Animação scroll-triggered
├── pages/
│   └── Index.tsx           # Página principal
├── lib/
│   └── utils.ts            # cn() helper
├── index.css               # Tema dark, variáveis, utilities
├── main.tsx                # Entry point
└── App.tsx                 # Router
```
