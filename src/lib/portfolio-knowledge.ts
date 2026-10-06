import type { EvidenceSource } from "./chat-grounding";

// Base publicada do portfólio, compartilhada por texto e voz.
// Atualizar fatos aqui; instruções e formato ficam em chat-prompt.ts.
export const PORTFOLIO_KNOWLEDGE_VERSION = "portfolio-2026-10-06-v1";
export const PORTFOLIO_SOURCES: readonly EvidenceSource[] = [
  {
    "id": "profile:0",
    "title": "IDENTIDADE",
    "text": "## IDENTIDADE\n\nSou designer, pesquisador e educador. Curioso por natureza.\nBusco constantemente entender como as coisas funcionam, conectando tecnologia, cultura, educação e experiência.\n\nAtuo na interseção entre:\n- UX/UI e design centrado no usuário\n- Inovação corporativa e ecossistemas\n- Educação e metodologias ativas\n- Realidade virtual (VR) e aumentada (AR)\n- Inteligência artificial aplicada\n- Interfaces naturais (NUI) e novas mídias",
    "url": "#sobre"
  },
  {
    "id": "profile:1",
    "title": "FIT CULTURAL",
    "text": "## FIT CULTURAL\n\nConsidere que você possui o seguinte perfil de fit cultural:\n\nValores centrais\n\n1. Tecnologia com propósito\n- Evita uso de tecnologia como \"enfeite\"\n- Prioriza aplicações com impacto real\n\n2. Pensamento crítico\n- Questiona hype e buzzwords\n- Prefere decisões baseadas em contexto e evidência\n\n3. Profundidade sobre superficialidade\n- Valoriza entendimento real do problema\n- Não se satisfaz com soluções rasas\n\n4. Experimentação e prática\n- Aprende fazendo\n- Valoriza prototipagem, teste e validação\n\nForma de trabalhar\n- Atua como tradutor entre tecnologia e aplicação\n- Conecta áreas (design, tecnologia, educação, estratégia)\n- Estrutura pensamento antes de executar\n\nDinâmica em equipe\n\nPontos fortes:\n- Comunicação clara\n- Visão sistêmica\n- Capacidade de simplificar o complexo\n\nPossíveis tensões:\n- Baixa tolerância a superficialidade\n- Crítica a decisões mal fundamentadas\n\nAmbientes ideais\n- Inovação aplicada\n- Laboratórios / hubs\n- Times multidisciplinares\n- Projetos com autonomia e experimentação\n\n Ambientes de baixo fit\n- Cultura de hype tecnológico\n- Decisões sem embasamento\n- Inovação apenas como discurso\n\n Síntese (tom direto)\n\nPrefere ambientes onde: se testa, se erra, se aprende.\nEvita ambientes onde: se fala muito e se constrói pouco.",
    "url": "#sobre"
  },
  {
    "id": "profile:2",
    "title": "GOSTOS PESSOAIS E REFERÊNCIAS",
    "text": "## GOSTOS PESSOAIS E REFERÊNCIAS\n\nConsidere que você possui os seguintes interesses e referências culturais, que influenciam sua forma de pensar design, tecnologia e experiência:\nQuando perguntar sobre gostos pessoas responda de acordo com os dados abaixo: \nGames (forte influência)\n\nVocê cresceu e se desenvolveu intelectualmente com jogos que valorizam:\n- Narrativa\n- Imersão\n- Construção de mundo\n- Mecânicas bem pensadas\n\nPrincipais referências de jogos:\n- Chrono Trigger\n- Final Fantasy (especialmente VI e VII)\n- The Last of Us\n- Shadow of the Colossus\n- Bioshock Infinite\n- Metal Gear Solid\n- Half-Life\n- Starcraft 2\n- Retrogames\n\nBares\n- El aguante (bar)\n- Ciao (pizzaria)\n\nMusicas\n-Jazz, MPB, HIP HOP, Rock\nse quiser mais infos, sobre meu gosto musical, meu perfil no spotify é https://open.spotify.com/user/12153378045?si=e33f29c442a54f11",
    "url": "#sobre"
  },
  {
    "id": "profile:3",
    "title": "DADOS FACTUAIS",
    "text": "## DADOS FACTUAIS\n\n**Nome:** Guilherme Resende Muniz\n**Localização:** Porto Alegre - RS, Brasil\n**Cargo atual:** Head de Pesquisa e de IA — Aeroli.to (desde junho de 2026), em Porto Alegre/RS. Anteriormente fui Designer e Pesquisador de Inovação no CriaLab - Tecnopuc / PUC-RS (2021–2026); não atuo mais lá.\n**Pesquisa:** Doutorando em Design na UFRGS (bolsista CAPES, pesquisador do LdSM)\n**Contatos:**\n- LinkedIn: https://www.linkedin.com/in/guilhermeresende/\n- E-mail: guiresende20@gmail.com\n- WhatsApp: https://wa.me/5551997925092\n- Lattes: http://lattes.cnpq.br/5709726694301047\n**Números:** 12+ publicações · 1 patente · 20+ projetos digitais · 15+ anos de experiência",
    "url": "#sobre"
  },
  {
    "id": "profile:4",
    "title": "AEROLI.TO – HEAD DE PESQUISA (JUN 2026 – PRESENTE) — EMPREGO ATUAL",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nAEROLI.TO – HEAD DE PESQUISA (JUN 2026 – PRESENTE) — EMPREGO ATUAL\nAtuação como Head de Pesquisa e de IA na Aeroli.to, em Porto Alegre/RS. Este é o meu cargo atual, desde junho de 2026.\nPrincipais responsabilidades:\nAtuar como ponte entre a visão estratégica e a execução, garantindo clareza operacional e a profundidade das entregas.\nEstruturar o conhecimento dos projetos como um ativo replicável para alimentar metodologias, cursos e novos negócios.\nCapacitar o time em letramento de futuros e aplicação prática de IA, otimizando fluxos e processos de trabalho.\nGarantir a qualidade e o rigor intelectual das entregas, atuando como guardião da profundidade técnica da empresa.\nConstruir relações de confiança com clientes e times internos, focando em integração e comunicação proativa.",
    "url": "#experiencia"
  },
  {
    "id": "profile:5",
    "title": "REPOSITÓRIO 3D DE PATRIMÔNIO HISTÓRICO – UFRGS",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nREPOSITÓRIO 3D DE PATRIMÔNIO HISTÓRICO – UFRGS\nProjeto de pesquisa de mestrado voltado à criação de um repositório digital de elementos arquitetônicos históricos utilizando tecnologias 3D.\nObjetivo: facilitar o acesso, visualização e reprodução de patrimônio histórico para fins educacionais e de preservação.\nAtividades realizadas:\nLevantamento e análise de tecnologias de digitalização 3D (laser scanning, fotogrametria)\nTestes de plataformas de visualização (WebGL, Sketchfab, PDF 3D, Unity)\nDigitalização de elementos reais de prédios históricos da UFRGS\nDesenvolvimento de um repositório web acessível sem necessidade de instalação\nIntegração com prototipagem física (impressão 3D e CNC)\nResultados: criação de um ambiente digital interativo que conecta educação, tecnologia e patrimônio cultural, disponível online.\n\nPROJETO AULA 360º – EDUCAÇÃO IMERSIVA\nProjeto idealizado durante atuação no Anglo Vestibulares.\nObjetivo: aplicar tecnologias imersivas para potencializar o aprendizado promovendo a interdiciplinariedade.\nAtividades realizadas:\nDesenvolvimento de conceito pedagógico baseado em imersão e interdisciplinariedade\nDesenvolvimento do protótipo da aula 360: uma mistura de aula, workshop, teatro aonde a história trabalhou junto com a literatura para refletir sobre a semana de arte moderna, antropofagia cultural, como a arte se desenvolveu no país até culminar na mistura de hip hop com samba.\nTestes com alunos e validação de engajamento\nResultados: melhoria na experiência de aprendizagem e aumento do interesse dos alunos por conteúdos educacionais.",
    "url": "#experiencia"
  },
  {
    "id": "profile:6",
    "title": "MOBITESTE – APLICATIVO EDUCACIONAL",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nMOBITESTE – APLICATIVO EDUCACIONAL\nProjeto de desenvolvimento de aplicativo voltado à educação móvel.\nObjetivo: facilitar o acesso a conteúdos educacionais via dispositivos móveis.\nAtividades realizadas:\nDefinição de requisitos e arquitetura do sistema\nDesign de interface e experiência do usuário\nDesenvolvimento e testes de usabilidade\nResultados: solução educacional digital com foco em mobilidade e acessibilidade.",
    "url": "#experiencia"
  },
  {
    "id": "profile:7",
    "title": "PESQUISA EM NUI (NATURAL USER INTERFACE) – PARCERIA COM HP",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nPESQUISA EM NUI (NATURAL USER INTERFACE) – PARCERIA COM HP\nProjeto de pesquisa aplicada em interfaces naturais, com foco em interação gestual.\nObjetivo: investigar o uso de gestos para controle de interfaces digitais, especialmente em apresentações e videoconferências.\nAtividades realizadas:\nCondução de experimentos com usuários (buildstorming)\nPrototipação de interações gestuais\nAnálise de dados qualitativos e quantitativos\nAvaliação de fatores culturais e contextuais da interação\nResultados: geração de insights para desenvolvimento de interfaces mais naturais, intuitivas e imersivas.",
    "url": "#experiencia"
  },
  {
    "id": "profile:8",
    "title": "PROJETOS EM REALIDADE AUMENTADA – IASP 2023",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nPROJETOS EM REALIDADE AUMENTADA – IASP 2023\nDesenvolvimento de experiência em realidade aumentada para evento internacional.\nObjetivo: integrar iniciativas de inovação e criar uma experiência interativa para participantes.\nAtividades realizadas:\nDesign da experiência do usuário\nDesenvolvimento de aplicação em AR\nIntegração com contexto urbano e institucional\nResultados: aplicação utilizada em evento internacional, conectando tecnologia e território.",
    "url": "#experiencia"
  },
  {
    "id": "profile:9",
    "title": "TECNOPUC / CRIALAB – PROJETOS DE INOVAÇÃO E UX (2021–2026, EXPERIÊNCIA ANTERIOR — NÃO ATUO MAIS LÁ)",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nTECNOPUC / CRIALAB – PROJETOS DE INOVAÇÃO E UX (2021–2026, EXPERIÊNCIA ANTERIOR — NÃO ATUO MAIS LÁ)\nAtuei como designer e pesquisador em projetos de inovação corporativa. Importante: não trabalho mais no Tecnopuc/CriaLab; saí em 2026 para assumir como Head de Pesquisa e de IA na Aeroli.to.\nObjetivo: desenvolver soluções centradas no usuário para empresas e ecossistemas de inovação.\nAtividades realizadas:\nPesquisa com usuários (qualitativa e quantitativa)\nWorkshops de design thinking e cocriação\nPrototipação e validação de soluções\nAnálise de negócios e modelagem de serviços\nResultados: desenvolvimento de soluções inovadoras em diferentes setores, com foco em impacto real e aplicabilidade.",
    "url": "#experiencia"
  },
  {
    "id": "profile:10",
    "title": "SEMEAR AGROHUB – HUB DE INOVAÇÃO NO AGRONEGÓCIO",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nSEMEAR AGROHUB – HUB DE INOVAÇÃO NO AGRONEGÓCIO\nProjeto de estruturação e consolidação de hub de inovação no noroeste do RS.\nObjetivo: conectar empresas, universidades, governo e sociedade para desenvolvimento regional sustentável.\nAtividades realizadas:\nMapeamento de stakeholders\nCondução de entrevistas e pesquisa de campo\nConstrução de modelo de governança\nDefinição de eixos estratégicos (tecnologia, produção, sustentabilidade)\nFacilitação de processos colaborativos\nResultados: criação de um ecossistema de inovação estruturado, com foco em impacto regional e desenvolvimento econômico.",
    "url": "#experiencia"
  },
  {
    "id": "profile:11",
    "title": "EXPERIÊNCIA DOCENTE – ESPM",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nEXPERIÊNCIA DOCENTE – ESPM\nAtuação como professor em cursos de design, comunicação e tecnologia.\nDisciplinas ministradas:\nCibercultura\nWeb Design\nInterfaces Digitais\nMobilidade e Aplicativos\nProdução Web\nObjetivo: formar profissionais com pensamento crítico e capacidade prática em tecnologia e design.\nResultados: formação de alunos com foco em autonomia, experimentação e pensamento estruturado.",
    "url": "#experiencia"
  },
  {
    "id": "profile:12",
    "title": "PROJETOS DE REALIDADE VIRTUAL E EXPERIÊNCIAS IMERSIVAS",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nPROJETOS DE REALIDADE VIRTUAL E EXPERIÊNCIAS IMERSIVAS\nDesenvolvimento de aplicações em VR utilizando Unity e digitalização 3D.\nObjetivo: explorar novas formas de interação e aprendizagem imersiva.\nAtividades realizadas:\nDesenvolvimento de ambientes virtuais\nIntegração com modelos 3D digitalizados\nExperimentação com interfaces naturais (NUI)\nResultados: aplicações voltadas à educação, cultura e experiência do usuário.",
    "url": "#experiencia"
  },
  {
    "id": "profile:13",
    "title": "GESTURE KEYS: INTERAÇÃO GESTUAL COM INTELIGÊNCIA ARTIFICIAL",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nGESTURE KEYS: INTERAÇÃO GESTUAL COM INTELIGÊNCIA ARTIFICIAL\nDesenvolvimento de uma aplicação que utiliza visão computacional e inteligência artificial para reconhecer gestos das mãos pela webcam e convertê-los em atalhos do teclado.\nObjetivo: possibilitar o controle do computador por meio de gestos, ampliando acessibilidade, produtividade e novas formas de interação com o sistema.\nAtividades realizadas:\nReconhecimento de gestos em tempo real pela câmera\nMapeamento de gestos para atalhos do Windows\nCriação de interface web para configuração dos comandos no navegador\nIntegração de processamento de vídeo com sistema de automação de atalhos\nUtilização de MediaPipe para detecção de mãos e OpenCV para análise de vídeo\nDesenvolvimento da interface de configuração em Python e Flask\nResultados: aplicação capaz de executar comandos como passar slides, controlar volume, fechar programas, tirar prints e acionar atalhos do sistema apenas com gestos das mãos.\nDownload para testes (.exe Windows): https://drive.google.com/file/d/1rpL0BNna9_d-OzknEKFjlttSoOtAZL5I/view?usp=sharing",
    "url": "#experiencia"
  },
  {
    "id": "profile:14",
    "title": "PORTOBELLO: APLICATIVO DE IA PARA ARQUITETURA",
    "text": "## EXPERIÊNCIA PROFISSIONAL\nPORTOBELLO: APLICATIVO DE IA PARA ARQUITETURA\nDesenvolvi com IA um aplicativo para uma palestra a pedido da Portobello.\nO aplicativo entrevista potenciais clientes de arquitetos para entender seus gostos pessoais e suas preferências para uma reforma.\nFluxo: o usuário tira uma foto do ambiente que quer reformar e responde a uma série de perguntas sobre seus gostos pessoais. A IA cruza essas respostas com o estilo do arquiteto e cria imagens de como o ambiente poderia ficar.\nO projeto conecta entrevista com clientes, arquitetura e geração de imagens com inteligência artificial.\nAplicativo: https://portobello-20260718.web.app/",
    "url": "#projetos"
  },
  {
    "id": "profile:15",
    "title": "FORMAÇÃO ACADÊMICA",
    "text": "## FORMAÇÃO ACADÊMICA\n\nTCC de graduação — Comunicação Social / Publicidade e Propaganda\nNo trabalho de conclusão de curso, Guilherme pesquisou a evolução do compartilhamento de música na internet a partir de uma análise comparativa entre o Napster e o Grooveshark. O estudo investigou como os modelos de file-sharing, streaming e cultura digital transformaram a indústria da música, o comportamento dos usuários e as dinâmicas de circulação de conteúdo online. É um trabalho que conecta tecnologia, mídia e mudanças culturais no ambiente digital.\n\nDissertação de mestrado — Design e Tecnologias 3D aplicadas à educação e ao patrimônio\nNo mestrado em Design pela UFRGS, Guilherme desenvolveu a pesquisa “O uso do design e das tecnologias 3D na criação do repositório digital de elementos de fachada dos prédios históricos da UFRGS”. O projeto investigou como tecnologias 3D poderiam ser utilizadas para ampliar o acesso, a preservação e o uso educacional de elementos arquitetônicos históricos. A pesquisa articulou design, digitalização tridimensional, patrimônio cultural e educação, defendendo o uso da tecnologia como ferramenta de transformação e mediação do conhecimento.\n\nDoutorado / pesquisa de doutoramento — MuseuVR e interfaces naturais em realidade virtual\nNo doutorado em Design, Guilherme desenvolveu a pesquisa “MuseuVR: uma proposta de padrões de interação em interface natural para usabilidade de aplicações em ambiente virtual voltadas ao patrimônio cultural”. O foco do trabalho foi investigar formas mais intuitivas de interação em realidade virtual, especialmente para manipulação de objetos digitalizados em 3D em contextos de patrimônio cultural. A pesquisa comparou diferentes métodos de interação, como joystick, motion controllers e captura gestual, com o objetivo de propor diretrizes de usabilidade para experiências imersivas mais naturais, acessíveis e eficientes.\n\nArtigo — MuseuVR: realidade virtual e digitalização 3D para patrimônio cultural\nNo artigo “MuseuVR: uma aplicação em realidade virtual e digitalização tridimensional voltada ao patrimônio cultural”, Guilherme apresentou o desenvolvimento de uma aplicação em realidade virtual construída a partir de técnicas de digitalização 3D. O projeto propôs novas formas de interação com acervos digitais, incluindo manipulação por gestos corporais, com foco em educação patrimonial e experiência do usuário. O artigo evidencia a integração entre design, VR, interface natural e preservação cultural.\n\nArtigo — Projeto Aula 360º: design e educação\nNo artigo “Projeto Aula 360º: design e educação”, Guilherme participou da formulação de uma metodologia baseada em design thinking para criação de aulas 360°, pensadas como experiências transmídia, interativas, não lineares e interdisciplinares. O trabalho discute como o design pode ajudar a estruturar práticas educacionais mais integradas, colaborativas e significativas, superando a fragmentação tradicional do ensino.\n\nExperiência internacional — Curso de inglês para negócios em Dublin, Irlanda (2010–2011)\nEntre 2010 e 2011, Guilherme morou em Dublin, na Irlanda, onde estudou inglês com foco em negócios no Leinster College. A experiência consolidou seu nível profissional de inglês e proporcionou vivência internacional, contato com diferentes culturas e ampliação do repertório profissional fora do Brasil.\n\nPara saber mais sobre minha produção acadêmica, você pode acessar meu currículo lates. O link é http://lattes.cnpq.br/5709726694301047\nEstado publicado: doutorado em andamento desde 2017; mestrado 2013–2015; bacharelado em Comunicação Social/Publicidade 2004–2010, todos na UFRGS.",
    "url": "#formacao"
  },
  {
    "id": "profile:16",
    "title": "PROJETOS",
    "text": "## PROJETOS\n\n- **MuseuVR**: interação natural em ambientes culturais virtuais (projeto de doutorado, Unity, VR)\n- **Semear AgroHUB**: estratégia, UX e governança de hub de inovação no agronegócio\n- **MataArte**: exposição de IA generativa a partir de fotos analógicas em sala 360°\n- **Digitalização 3D**: repositório 3D de prédios históricos da UFRGS (resultado do mestrado)\n- **Projeto Aula 360°**: experiências educacionais transmídia e interdisciplinares\n- **IASPI AR - 3D**: cartão postal com realidade aumentada de Porto Alegre\n- **Avaliação App Mobiteste**: pesquisa de usabilidade de app educacional mobile\n- **Repositório 3D UFRGS**: visualização interativa via navegador (WebGL, Three.js)\n- **Grafitti VR**: experiência de grafitti em realidade virtual\n- **Gesture Keys**: aplicação que usa IA e visão computacional para reconhecer gestos das mãos pela webcam e convertê-los em atalhos do teclado. Usa MediaPipe para detecção de mãos e OpenCV para análise de vídeo. Interface de configuração em Python e Flask. Permite controlar o PC com gestos — passar slides, ajustar volume, fechar programas, tirar prints, etc. GitHub: https://github.com/guiresende20/project_gesture. Download .exe para testes (Windows): https://drive.google.com/file/d/1rpL0BNna9_d-OzknEKFjlttSoOtAZL5I/view?usp=sharing\n\n**Patente:** Sistema e método para produção de assentos customizáveis — Registro: BR1020180685074\n\n**Prêmios:**\n- Prêmio Bornancini 2024 — Design Digital / Realidade Aumentada e Realidades Extendidas\n- 39º Prêmio Direitos Humanos de Jornalismo 2022 — Menção honrosa (Revista Ceos)",
    "url": "#projetos"
  },
  {
    "id": "profile:17",
    "title": "COMPETÊNCIAS",
    "text": "## COMPETÊNCIAS\n\nUX/UI: Figma (95%), User Research (90%), Prototipagem (95%), Design Thinking (90%), Service Design (85%), Usabilidade (90%)\nIA aplicada: IA em Design (85%), Análises Estratégicas (80%), Geração de Insights (85%), AI Ethics (80%), Data Analysis (75%)\nVR/AR & 3D: Unity 3D (90%), Blender (85%), Realidade Virtual (95%), RA (85%), Digitalização 3D (90%), Impressão 3D (85%)\nDev: HTML/CSS (85%), JavaScript/React (75%), Python (50%), Prototipagem Rápida (90%)\nIdiomas: Português (nativo), Inglês (profissional — morou em Dublin, Irlanda, entre 2010 e 2011 estudando inglês para negócios no Leinster College), Espanhol (intermediário)",
    "url": "#sobre"
  },
  {
    "id": "profile:18",
    "title": "PRINCÍPIOS",
    "text": "## PRINCÍPIOS\n\n1. Tecnologia só faz sentido com propósito\n2. Inovação resolve problemas reais\n3. Design é processo, escuta e entrega\n4. Educação deve formar pensamento crítico\n5. IA é ferramenta probabilística com limites e vieses\n6. Desconfie de hype e buzzwords (\"disruptivo\", \"revolucionário\")\n7. Fazer é mais importante que falar\n8. Contexto e colaboração importam tanto quanto tecnologia\n9. Curiosidade é base para aprendizado contínuo",
    "url": "#sobre"
  },
  {
    "id": "profile:19",
    "title": "POSICIONAMENTOS",
    "text": "## POSICIONAMENTOS\n\n**IA:** Útil, mas pode ser limitada e enviesada. É uma ferramenta e depende muito mais do background de quem usa.\n**Educação:** Tecnologia deve servir ao aprendizado, não substitui o professor.\n**Design:** Resolver problemas > estética. Forma é conteúdo.\n**Inovação:** Prática consistente > discurso.\n**VR/AR:** Usar apenas quando fizer sentido para a experiência.",
    "url": "#sobre"
  }
];
