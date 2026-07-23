/* ============================================================
   deck.js — slideshow
   Carrega slides.json, renderiza cada slide a partir do template
   e cuida da navegação (setas, teclado, swipe, contador, fullscreen,
   deep-link por hash). Ativado pelo evento "enter-deck" da capa.
   ============================================================ */
(function () {
  "use strict";

  var ACCENTS = {
    violet: "var(--accent-violet)",
    pink:   "var(--accent-pink)",
    cyan:   "var(--accent-cyan)",
    green:  "var(--accent-green)"
  };

  // instrução fixa enviada junto com a frase ao /api/chat no layout "frase-ia".
  // Curta de propósito: resposta menor = /api/chat e a voz (TTS) bem mais rápidos.
  var FRASE_IA_INSTRUCTION =
    "Reaja a esta frase em 1 parágrafo curto (no máximo 3 frases), em português, " +
    "conectando com a visão do Guilherme. Seja direto, sem rodeios.";

  // imagem-placeholder do território novo (glifo neutro de imagem): renderizada
  // "contida" e centralizada (sem cover/zoom) até o usuário trocar a imagem.
  var PLACEHOLDER_IMAGE = "assets/placeholder.svg";
  // valor antigo (logo Aerolito) que pode ter sido persistido em overrides/added
  // no servidor — normalizado para o placeholder atual ao montar o deck.
  var LEGACY_PLACEHOLDER = "assets/logo-aero.png";

  // layouts-base adicionais (além do território clássico): mesmo modelo de dados
  // e mesmo DOM — a diferença é só visual, por classe "slide--<layout>" no
  // <section>. Assim a edição inline, o índice, o PDF e a visibilidade do
  // cliente continuam funcionando iguais aos territórios.
  var LAYOUTS = { grid: 1, wordmark: 1, hero: 1, "hero-static": 1, manifesto: 1, "frase-ia": 1, pontos: 1, background1: 1, video: 1, media: 1 };

  // ícones (SVG de traço) para os cards do layout "pontos". Cada chave é um
  // nome usado no campo `points[].icon`; o glifo procura representar o conceito.
  var POINT_ICONS = {
    eye:        '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    bulb:       '<path d="M9.5 18h5M10 21h4"/><path d="M12 3a6 6 0 0 0-3.9 10.6c.6.5 1 1.2 1.1 2h5.6c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
    user:       '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.4-6 7.5-6s7.5 2 7.5 6"/>',
    code:       '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
    funnel:     '<path d="M3 4.5h18l-7 8.5v5.5l-4 2v-7.5z"/>',
    palette:    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-1 1.6-2 0-1.6 1.1-2 2.2-2H18a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="12" cy="7.6" r="1.1"/><circle cx="16.4" cy="11" r="1.1"/>',
    nodes:      '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.8 7.4l2.9 8.9M16.2 7.4l-2.9 8.9M8.2 6h7.6"/>',
    target:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
    dot:        '<circle cx="12" cy="12" r="4"/>'
  };
  function iconSVG(name) {
    var path = POINT_ICONS[name] || POINT_ICONS.dot;
    return '<svg class="point-icon" viewBox="0 0 24 24" aria-hidden="true">' + path + "</svg>";
  }

  // opções do seletor de layout no botão "+ Novo slide" (índice, só @aeroli.to).
  // value "" = território clássico (imagem de fundo + painel de texto).
  var LAYOUT_CHOICES = [
    { value: "",            name: "Abertura + Texto",              desc: "Imagem de fundo + painel de texto" },
    { value: "grid",        name: "Grade de miniaturas",           desc: "Vários cards/logos placeholder" },
    { value: "wordmark",    name: "Thumbs",                        desc: "Nome grande + linha" },
    { value: "hero",        name: "Imagem em destaque",            desc: "Imagem cheia + legenda" },
    { value: "hero-static", name: "Imagem em destaque (sem zoom)",  desc: "Imagem cheia + legenda" },
    { value: "manifesto",   name: "Frase-manifesto",               desc: "Texto grande centralizado" },
    { value: "frase-ia",    name: "Frase + IA",                   desc: "Frase-manifesto + resposta da IA" },
    { value: "pontos",      name: "Pontos com ícones",            desc: "Título + grade de cards (ícone + texto)" },
    { value: "background1",  name: "Texto destaque + fundo gradiente", desc: "Frase grande sobre o gradiente verde da capa" },
    { value: "video",       name: "Vídeo",                         desc: "YouTube embed centralizado" },
    { value: "media",       name: "GIF / Vídeo",                   desc: "GIF ou MP4 em loop, centralizado" }
  ];

  // "Território" de verdade = só o layout clássico (sem s.layout). Intro
  // e os layouts-base novos (grade/wordmark/hero/manifesto) NÃO contam como
  // território — usado na numeração e na contagem do índice.
  function isTerritorySlide(s) {
    return !!s && s.type !== "intro" && !s.layout;
  }

  // slug do título para a URL (#): minúsculas, sem acento, hífens no lugar de
  // símbolos. Ex.: "Território dos Dados" -> "territorio-dos-dados".
  function slugify(str) {
    return String(str == null ? "" : str)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  // slug do slide: do título; se vazio, cai no id; por fim, no número.
  function slugForSlide(s, i) {
    return (s && slugify(s.title)) || (s && s.id) || String((i || 0) + 1);
  }

  var deck = document.getElementById("deck");
  var stage = document.getElementById("deck-stage");
  var controls = document.getElementById("deck-controls");
  var btnIndex = document.getElementById("nav-index");
  var btnPrev = document.getElementById("nav-prev");
  var btnNext = document.getElementById("nav-next");
  var btnFull = document.getElementById("nav-full");
  var counterCur = document.getElementById("counter-cur");
  var counterTot = document.getElementById("counter-tot");
  var progressBar = document.getElementById("deck-progress-bar");
  var overview = document.getElementById("overview");
  var overviewGrid = document.getElementById("overview-grid");
  var overviewClose = document.getElementById("overview-close");

  var slides = [];
  var els = [];
  var deckMeta = null;   // meta do deck (slides.json) p/ o nome do arquivo PPTX
  var thumbs = [];
  var fullAccess = false;   // chave de edição na sessão: controles de edição visíveis
  var publishedHidden = [];   // ids ocultados publicados (servidor): somem para todos
  var index = 0;
  var ready = false;
  var overviewOpen = false;
  var entered = false, loaded = false, activated = false;
  var pendingData = null, built = false;   // monta os slides só após "enter-deck" (login já definiu o perfil)

  /* reordenar miniaturas (arrastar) — desktop, persistido em localStorage */
  // v2: a intro entrou como 1º slide; ordens v1 salvas empurrariam a intro
  // para o fim (applySavedOrder anexa ids novos ao final). Orfana ordens antigas.
  var ORDER_KEY = "portobello-deck-order-v1";
  var dragFrom = -1;
  var justDragged = false;

  /* auto-ocultar dos controles após inatividade */
  var HIDE_DELAY = 3000;
  var hideTimer = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // formatação inline aplicada sobre texto JÁ escapado:
  // **trecho** -> destaque (cor de acento) e \n -> quebra de linha
  function fmtInline(escaped) {
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong class="stat-hl">$1</strong>')
      .replace(/\n/g, "<br>");
  }

  // número por extenso (pt-BR), capitalizado; fallback p/ dígito.
  // usado para "{n} territórios" se atualizar conforme a quantidade real.
  function numWordPt(n) {
    var words = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete",
      "Oito", "Nove", "Dez", "Onze", "Doze", "Treze", "Quatorze", "Quinze",
      "Dezesseis", "Dezessete", "Dezoito", "Dezenove", "Vinte"];
    return words[n] || String(n);
  }

  function buildSlide(s, i) {
    if (s.type === "intro") return buildIntroSlide(s, i);
    if (s.layout === "grid") return buildGridSlide(s, i);
    if (s.layout === "video") return buildVideoSlide(s, i);
    if (s.layout === "media") return buildMediaSlide(s, i);
    var el = document.createElement("section");
    el.className = "slide";
    if (s.id) el.dataset.id = s.id;
    // layout-base opcional: classe visual + data-attr (mesmo DOM do território)
    if (s.layout && LAYOUTS[s.layout]) {
      el.classList.add("slide--" + s.layout);
      el.dataset.layout = s.layout;
    }
    el.setAttribute("aria-roledescription", "slide");
    el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + s.title);
    el.style.setProperty("--accent", ACCENTS[s.accent] || ACCENTS.violet);

    // aceita string (formato antigo) ou objeto { label, url, description }.
    // Regra: objeto com `url` e SEM `description` vira botão de link direto
    // (abre em nova aba, empilhado, fora do PDF). Com description (ou sem url)
    // segue como chip de sinal (abre o diálogo) ou chip simples.
    var chips = "", actionBtns = "";
    (s.items || []).forEach(function (it, k) {
      var isObj = it && typeof it === "object";
      var label = isObj ? it.label : it;
      var url = isObj ? it.url : "";
      var desc = isObj ? it.description : "";
      if (url && !desc) {
        actionBtns += '<a class="link-btn" href="' + esc(url) + '" ' +
          'target="_blank" rel="noopener noreferrer">' + esc(label) + "</a>";
        return;
      }
      var hasPanel = !!(isObj && (url || desc));
      if (hasPanel) {
        chips += '<li><button type="button" class="chip chip-btn" data-item="' + k + '" ' +
                 'aria-haspopup="dialog">' + esc(label) + "</button></li>";
      } else {
        chips += '<li><span class="chip">' + esc(label) + "</span></li>";
      }
    });

    // links externos (abrem em nova aba) — distintos dos chips de sinal (items)
    var linkChips = (s.links || []).map(function (lk) {
      if (!lk || !lk.url) return "";
      return '<li><a class="chip chip-link" href="' + esc(lk.url) + '" ' +
        'target="_blank" rel="noopener noreferrer">' + esc(lk.label || lk.url) + "</a></li>";
    }).join("");

    // body aceita string (formato antigo) ou array de parágrafos (formato novo).
    // descarta entradas não-string (slide sem body não deve quebrar o deck inteiro)
    var paras = (Array.isArray(s.body) ? s.body : [s.body]).filter(function (p) {
      return typeof p === "string";
    });
    var bodyHtml = paras.map(function (p) {
      // "### Texto" vira subtítulo; "> Texto" vira citação (pull-quote);
      // \n dentro do parágrafo vira quebra de linha. Numa citação, a última
      // linha iniciada por "—" é tratada como atribuição.
      if (p.indexOf("### ") === 0) {
        return '<h3 class="panel-subhead">' + esc(p.slice(4)) + "</h3>";
      }
      if (p.indexOf("> ") === 0) {
        var lines = p.slice(2).split("\n");
        var cite = "";
        if (lines.length > 1 && /^—/.test(lines[lines.length - 1].trim())) {
          cite = lines.pop().trim();
        }
        return '<blockquote class="panel-quote">' +
          fmtInline(esc(lines.join("\n"))) +
          (cite ? '<cite class="panel-quote-cite">' + esc(cite) + "</cite>" : "") +
          "</blockquote>";
      }
      return '<p class="panel-body">' + fmtInline(esc(p)) + "</p>";
    }).join("");

    // eyebrow editorial: "Território 03 / 10". O número é preenchido por
    // updateTerritoryNumbers() — assim acompanha a reordenação em tempo real.
    // Só o layout clássico é território; os layouts-base novos não recebem eyebrow.
    // perfil não recebe o rótulo "Slide NN / NN"
    var eyebrowHtml = (isTerritorySlide(s) && !s.portrait) ? '<p class="panel-eyebrow"></p>' : "";

    // epígrafe flutuante (fora do card de texto), ex.: citação de abertura
    var epigraphHtml = s.epigraph ?
      '<blockquote class="slide-epigraph">' + fmtInline(esc(s.epigraph.text)) +
        (s.epigraph.cite ? '<cite>— ' + esc(s.epigraph.cite) + "</cite>" : "") +
      "</blockquote>" : "";

    // botão X (canto sup. esquerdo): volta para o índice — só no modo edição.
    var closeHtml = fullAccess ?
      '<button type="button" class="slide-close" data-slide-close ' +
        'aria-label="Voltar ao índice" title="Voltar ao índice">×</button>' : "";

    // slide de perfil: retrato circular ao lado do nome, sobre fundo neutro
    // (sem foto full-bleed). O DOM e os campos continuam os do slide clássico.
    var isProfile = !!s.portrait;
    if (isProfile) el.classList.add("slide--profile");

    var bgClass = "slide-bg" + (s.image === PLACEHOLDER_IMAGE ? " is-placeholder" : "");
    var bgHtml = isProfile ? "" :
      '<img class="' + bgClass + '" src="' + esc(s.image) + '" alt="" ' +
        (i === 0 ? "" : 'loading="lazy" ') + 'decoding="async">';

    var titleHtml = isProfile ?
      '<div class="panel-headline">' +
        '<img class="panel-portrait" src="' + esc(s.portrait) + '" ' +
          'alt="' + esc(s.title) + '" loading="lazy" decoding="async">' +
        '<h2 class="panel-title">' + esc(s.title) + "</h2>" +
      "</div>" :
      '<h2 class="panel-title">' + esc(s.title) + "</h2>";

    // bloco interativo do layout "frase-ia": botão + área de resposta digitada
    var fraseIaHtml = s.layout === "frase-ia" ?
      '<div class="frase-ia">' +
        '<button type="button" class="frase-ia-btn" data-ai-ask>' +
          '<span class="frase-ia-ico" aria-hidden="true">▶</span>' +
          esc(s.aiButtonLabel || "Perguntar para a IA do Gui") +
        '</button>' +
        '<div class="frase-ia-answer" data-ai-answer hidden></div>' +
      "</div>" : "";

    // layout "pontos": grade de cards, cada um com ícone (por conceito) + texto
    var pointsHtml = s.layout === "pontos" ?
      '<ul class="points-grid">' + (s.points || []).map(function (p) {
        var txt = (p && typeof p === "object") ? (p.text || p.label || "") : p;
        var ico = (p && typeof p === "object") ? p.icon : "";
        return '<li class="point-card">' + iconSVG(ico) +
          '<span class="point-label">' + esc(txt) + "</span></li>";
      }).join("") + "</ul>" : "";

    el.innerHTML =
      bgHtml +
      '<div class="slide-scrim"></div>' +
      closeHtml +
      epigraphHtml +
      '<div class="panel">' +
        eyebrowHtml +
        titleHtml +
        '<p class="panel-subtitle" data-placeholder="Subtítulo (opcional)">' + esc(s.subtitle || "") + "</p>" +
        '<div class="panel-copy">' + bodyHtml + "</div>" +
        '<ul class="chips">' + chips + linkChips + "</ul>" +
        (actionBtns ? '<div class="link-actions">' + actionBtns + "</div>" : "") +
        fraseIaHtml +
        pointsHtml +
      "</div>";

    // fecha sobre o objeto s (sobrevive ao reorder — nunca usa índice posicional)
    Array.prototype.forEach.call(el.querySelectorAll(".chip-btn"), function (btn) {
      btn.addEventListener("click", function () {
        openSignal(s, parseInt(btn.getAttribute("data-item"), 10), btn);
      });
    });

    var askBtn = el.querySelector("[data-ai-ask]");
    if (askBtn) {
      var answerEl = el.querySelector("[data-ai-answer]");
      askBtn.addEventListener("click", function () { askAI(s, askBtn, answerEl); });
    }

    var closeBtn = el.querySelector("[data-slide-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openOverview();   // volta para o índice (visão geral)
      });
    }

    return el;
  }

  // frase-ia: a geração (resposta do /api/chat + voz TTS) começa ASSIM que o
  // slide abre (prewarmFraseIa em go()), em background, e o resultado fica
  // cacheado na própria slide (s._ai). O botão só REVELA o que já foi gerado —
  // se ainda estiver gerando, mostra "Pensando…" até ficar pronto. Isso paga o
  // cold-start + a geração antes do clique, então a voz é ouvida na íntegra.
  var ttsGen = 0;   // guarda: só toca o áudio da revelação mais recente

  // gera uma vez por slide (cacheado em s._ai): { text, audioP }.
  // audioP é a Promise da voz (não bloqueia o texto). Falha → limpa p/ retentar.
  function generateFraseIa(s) {
    if (s._ai) return s._ai;
    var instr = s.aiInstruction || FRASE_IA_INSTRUCTION;
    var message = instr + "\n\n\"" + String(s.title || "") + "\"";
    var p = fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: message, history: [] }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("chat " + r.status);
        return r.json();
      })
      .then(function (j) {
        var text = (j && typeof j.text === "string") ? j.text : "";
        if (!text) throw new Error("resposta vazia");
        // voz começa a ser gerada já (em background); null se o TTS falhar
        var audioP = fetchTts(text).then(function (a) { return a; }, function () { return null; });
        return { text: text, audioP: audioP };
      });
    p.catch(function () { if (s._ai === p) s._ai = null; });   // permite nova tentativa
    s._ai = p;
    return p;
  }

  // dispara a geração ao abrir o slide (fora do modo de edição)
  function prewarmFraseIa(s) {
    if (s && s.layout === "frase-ia" && !editing) {
      try { generateFraseIa(s); } catch (_) {}
    }
  }

  // botão: só revela o resultado (gerado no open) — digita o texto e toca a voz
  function askAI(s, btn, answerEl) {
    if (!answerEl || btn.disabled) return;
    var gen = ++ttsGen;
    btn.disabled = true;
    answerEl.hidden = false;
    answerEl.textContent = "Pensando…";
    stopTts();
    var reenable = function () { btn.disabled = false; };
    generateFraseIa(s).then(function (res) {
      if (gen !== ttsGen) return;   // outra revelação assumiu
      typeOut(answerEl, res.text, 0, reenable);
      res.audioP.then(function (audio) {
        if (audio && gen === ttsGen) playPcm(audio.audioBase64, audio.sampleRate);
      });
    }, function () {
      answerEl.textContent = "Não consegui responder agora — tente de novo.";
      reenable();
    });
  }

  // busca o áudio da resposta (PCM base64 24kHz) na voz da IA
  function fetchTts(text) {
    return fetch("/api/portobello-tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("tts " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.audioBase64) throw new Error("sem áudio");
        return j;
      });
  }

  // reprodução de PCM (Web Audio) — reusa um AudioContext do módulo.
  // retorna a duração em ms (0 se não deu pra tocar).
  var ttsCtx = null, ttsSources = [];
  function stopTts() {
    ttsSources.forEach(function (src) { try { src.stop(); } catch (_) {} });
    ttsSources = [];
  }
  function playPcm(base64, sampleRate) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return 0;
      if (!ttsCtx) ttsCtx = new Ctx();
      if (ttsCtx.state === "suspended") ttsCtx.resume();
      var bin = window.atob(base64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var int16 = new Int16Array(bytes.buffer);
      var f32 = new Float32Array(int16.length);
      for (var j = 0; j < int16.length; j++) f32[j] = int16[j] / 32768;
      var buf = ttsCtx.createBuffer(1, f32.length, sampleRate || 24000);
      buf.copyToChannel(f32, 0);
      var src = ttsCtx.createBufferSource();
      src.buffer = buf;
      src.connect(ttsCtx.destination);
      src.start();
      ttsSources.push(src);
      src.onended = function () {
        ttsSources = ttsSources.filter(function (x) { return x !== src; });
      };
      return buf.duration * 1000;
    } catch (_) {
      return 0;
    }
  }

  // efeito máquina de escrever: revela `text` por palavras; clicar revela tudo.
  // Se durationMs > 0, ritma a digitação para terminar junto com o áudio.
  function typeOut(el, text, durationMs, done) {
    el.textContent = "";
    var tokens = text.match(/\S+\s*|\s+/g) || [text];
    var interval = durationMs > 0
      ? Math.max(18, Math.min(140, durationMs / tokens.length))
      : 45;
    var i = 0, timer = null, finished = false;
    function complete() {
      if (finished) return;
      finished = true;
      if (timer) { clearInterval(timer); timer = null; }
      el.textContent = text;
      el.removeEventListener("click", reveal);
      if (done) done();
    }
    // clique = "pular": revela tudo E corta a voz. Fim natural NÃO corta a voz
    // (ela é mais lenta e precisa ser ouvida na íntegra).
    function reveal() { complete(); stopTts(); }
    el.addEventListener("click", reveal);
    timer = setInterval(function () {
      if (i >= tokens.length) { complete(); return; }
      el.textContent += tokens[i++];
    }, interval);
  }

  /* slide de introdução: miniaturas dos territórios + download do report em PDF.
     As miniaturas levam ao slide correspondente; o índice é resolvido em tempo
     de clique (slides.indexOf) para sobreviver a reordenações do deck. */
  function buildIntroSlide(s, i) {
    var el = document.createElement("section");
    el.className = "slide slide-intro";
    if (s.id) el.dataset.id = s.id;
    el.dataset.type = "intro";
    el.setAttribute("aria-roledescription", "slide");
    el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + s.title);
    el.style.setProperty("--accent", ACCENTS[s.accent] || ACCENTS.violet);

    // territórios = só o layout clássico (com imagem). Os layouts-base novos
    // (grade/wordmark/hero/manifesto) não entram no índice nem na contagem {n}.
    var territories = slides.filter(function (t) {
      return isTerritorySlide(t) && t.image;
    });

    var thumbsHtml = territories.map(function (t, n) {
      return '<li>' +
        '<button type="button" class="thumb intro-thumb" data-tid="' + esc(t.id) + '" ' +
          'aria-label="Ir para: ' + esc(t.title) + '">' +
          '<span class="thumb-figure">' +
            '<img src="' + esc(t.image) + '" alt="" loading="lazy" decoding="async">' +
            '<span class="thumb-num">' + (n + 1) + '</span>' +
            '<span class="thumb-title">' + esc(t.title) + '</span>' +
          '</span>' +
        '</button>' +
      '</li>';
    }).join("");

    var generateHtml =
      '<div class="intro-actions">' +
        (fullAccess ? '<button type="button" class="intro-generate-pdf intro-backups-btn" data-backups ' +
          'aria-haspopup="dialog" aria-label="Abrir backups do deck">' +
          '<span class="intro-download-icon">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M6 4h9l4 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" ' +
              'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
              '<path d="M8 4v4h6V4" fill="none" stroke="currentColor" stroke-width="1.6" ' +
              'stroke-linecap="round" stroke-linejoin="round"/>' +
              '<rect x="8" y="12" width="8" height="7" rx="1" ' +
              'fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '</svg>' +
          '</span>' +
          '<span class="intro-download-label">Backups</span>' +
        '</button>' : '') +
      '<div class="intro-pdf">' +
        '<button type="button" class="intro-generate-pdf" data-pdf-toggle ' +
          'aria-haspopup="dialog" aria-expanded="false" ' +
          'aria-label="Gerar PDF com todos os slides">' +
          '<span class="intro-download-icon">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" ' +
              'fill="none" stroke="currentColor" stroke-width="1.6" ' +
              'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<span class="intro-download-label">Gerar PDF</span>' +
        '</button>' +
        '<div class="intro-pdf-menu" data-pdf-menu hidden role="dialog" aria-label="Opções do PDF">' +
          '<div class="pdf-field">' +
            '<span class="pdf-field-label">Orientação</span>' +
            '<div class="pdf-seg" role="radiogroup" aria-label="Orientação">' +
              '<button type="button" class="pdf-seg-btn is-active" data-orientation="landscape" ' +
                'role="radio" aria-checked="true">Horizontal</button>' +
              '<button type="button" class="pdf-seg-btn" data-orientation="portrait" ' +
                'role="radio" aria-checked="false">Vertical</button>' +
            '</div>' +
          '</div>' +
          '<p class="pdf-all-note">O PDF inclui todos os slides do deck.</p>' +
          '<button type="button" class="pdf-generate-btn" data-pdf-go>Gerar PDF</button>' +
          '<button type="button" class="pdf-generate-btn pdf-generate-pptx" data-pptx-go>Exportar PPTX</button>' +
        '</div>' +
      '</div>' +
      '</div>';

    el.innerHTML =
      '<div class="intro-wrap">' +
        '<header class="intro-head">' +
          (s.eyebrow ? '<p class="intro-eyebrow">' + esc(s.eyebrow) + '</p>' : '') +
          '<h2 class="intro-title">' + esc(s.title) + '</h2>' +
          (s.lead ? '<p class="intro-lead">' + esc(s.lead.replace(/\{n\}/gi, numWordPt(territories.length))) + '</p>' : '') +
          generateHtml +
        '</header>' +
        '<ul class="intro-grid">' + thumbsHtml + '</ul>' +
      '</div>';

    Array.prototype.forEach.call(el.querySelectorAll(".intro-thumb"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-tid");
        var ix = slides.findIndex(function (x) { return x.id === id; });
        if (ix >= 0) go(ix);
      });
    });

    var pdfToggle = el.querySelector("[data-pdf-toggle]");
    var pdfMenu = el.querySelector("[data-pdf-menu]");
    if (pdfToggle && pdfMenu) {
      var pdfOrientation = "landscape";
      var closePdfMenu = function () {
        pdfMenu.hidden = true;
        pdfToggle.setAttribute("aria-expanded", "false");
      };

      pdfToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = pdfMenu.hidden;
        pdfMenu.hidden = !willOpen;
        pdfToggle.setAttribute("aria-expanded", String(willOpen));
      });
      // cliques dentro do painel não fecham (interagir com checkboxes/segmented)
      pdfMenu.addEventListener("click", function (e) { e.stopPropagation(); });
      // clique fora fecha
      document.addEventListener("click", function () {
        if (!pdfMenu.hidden) closePdfMenu();
      });

      // orientação (segmented control)
      Array.prototype.forEach.call(pdfMenu.querySelectorAll(".pdf-seg-btn"), function (btn) {
        btn.addEventListener("click", function () {
          pdfOrientation = btn.getAttribute("data-orientation");
          Array.prototype.forEach.call(pdfMenu.querySelectorAll(".pdf-seg-btn"), function (b) {
            var on = b === btn;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-checked", String(on));
          });
        });
      });

      // gerar com a orientação escolhida — sempre TODOS os slides
      pdfMenu.querySelector("[data-pdf-go]").addEventListener("click", function () {
        closePdfMenu();
        generatePDF(pdfOrientation);
      });

      // exportar PPTX — todos os slides de conteúdo (sem intro)
      var pptxGo = pdfMenu.querySelector("[data-pptx-go]");
      if (pptxGo) {
        pptxGo.addEventListener("click", function () {
          closePdfMenu();
          exportPPTX(pdfToggle);
        });
      }
    }

    var backupsBtn = el.querySelector("[data-backups]");
    if (backupsBtn) backupsBtn.addEventListener("click", openBackupsPanel);

    return el;
  }

  /* slide "grade de referências": galeria de imagens em thumbs pequenas, lado a
     lado. Modelo próprio (s.gallery = lista de URLs) — não usa chips/sinais.
     Mantém os hooks .panel-title/.panel-subtitle p/ a edição inline. */
  function buildGridSlide(s, i) {
    var el = document.createElement("section");
    el.className = "slide slide--grid";
    if (s.id) el.dataset.id = s.id;
    el.dataset.layout = "grid";
    el.setAttribute("aria-roledescription", "slide");
    el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + s.title);
    el.style.setProperty("--accent", ACCENTS[s.accent] || ACCENTS.violet);

    var gallery = Array.isArray(s.gallery) ? s.gallery : [];
    var thumbs = gallery.map(function (url) {
      return '<li class="grid-thumb"><img src="' + esc(url) + '" alt="" ' +
        'loading="lazy" decoding="async"></li>';
    }).join("");

    var closeHtml = fullAccess ?
      '<button type="button" class="slide-close" data-slide-close ' +
        'aria-label="Voltar ao índice" title="Voltar ao índice">×</button>' : "";

    el.innerHTML =
      closeHtml +
      '<div class="panel">' +
        '<h2 class="panel-title">' + esc(s.title) + "</h2>" +
        '<p class="panel-subtitle" data-placeholder="Subtítulo (opcional)">' + esc(s.subtitle || "") + "</p>" +
        '<ul class="grid-gallery">' + thumbs + "</ul>" +
      "</div>";

    var closeBtn = el.querySelector("[data-slide-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openOverview();
      });
    }
    return el;
  }

  /* slide "vídeo": retângulo 16:9 com borda branca, centralizado, embedando um
     vídeo do YouTube. Título opcional acima. O link é definido no modo de edição. */
  // extrai o ID de 11 chars de várias formas de link do YouTube (ou aceita o ID cru)
  function youtubeId(url) {
    if (!url) return "";
    url = String(url).trim();
    if (/^[\w-]{11}$/.test(url)) return url;
    var m =
      url.match(/[?&]v=([\w-]{11})/) ||
      url.match(/youtu\.be\/([\w-]{11})/) ||
      url.match(/\/embed\/([\w-]{11})/) ||
      url.match(/\/shorts\/([\w-]{11})/) ||
      url.match(/\/live\/([\w-]{11})/);
    return m ? m[1] : "";
  }

  function videoEmbedHTML(video, title) {
    var vid = youtubeId(video);
    if (vid) {
      return '<iframe class="video-embed" ' +
        'src="https://www.youtube.com/embed/' + esc(vid) + '?rel=0" ' +
        'title="' + esc(title || "Vídeo") + '" ' +
        'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; ' +
        'picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>';
    }
    return '<div class="video-empty">' +
      (fullAccess ? "Cole o link do YouTube no modo de edição." : "Vídeo não configurado.") +
      "</div>";
  }

  function buildVideoSlide(s, i) {
    var el = document.createElement("section");
    el.className = "slide slide--video";
    if (s.id) el.dataset.id = s.id;
    el.dataset.layout = "video";
    el.setAttribute("aria-roledescription", "slide");
    el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + s.title);
    el.style.setProperty("--accent", ACCENTS[s.accent] || ACCENTS.violet);

    var closeHtml = fullAccess ?
      '<button type="button" class="slide-close" data-slide-close ' +
        'aria-label="Voltar ao índice" title="Voltar ao índice">×</button>' : "";

    el.innerHTML =
      closeHtml +
      '<div class="panel">' +
        '<h2 class="panel-title">' + esc(s.title || "") + "</h2>" +
        '<div class="video-frame">' + videoEmbedHTML(s.video, s.title) + "</div>" +
      "</div>";

    var closeBtn = el.querySelector("[data-slide-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openOverview();
      });
    }
    return el;
  }

  /* slide "media": GIF ou MP4 em loop (sem som/controles), centralizado numa
     moldura branca, com título opcional. A mídia é definida no modo de edição
     (upload ou URL). Espelha o layout de vídeo. */
  // deduz "video"/"image" pela extensão (fallback quando o slide só tem URL).
  function mediaKind(url) {
    return /\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(String(url || "")) ? "video" : "image";
  }

  function mediaEmbedHTML(media) {
    var url = media && media.url;
    if (url) {
      var kind = (media && media.kind) || mediaKind(url);
      if (kind === "video") {
        return '<video class="media-embed" src="' + esc(url) + '" ' +
          'autoplay loop muted playsinline></video>';
      }
      return '<img class="media-embed" src="' + esc(url) + '" alt="">';
    }
    return '<div class="media-empty">' +
      (fullAccess ? "Envie um GIF/MP4 ou cole uma URL no modo de edição." : "Mídia não configurada.") +
      "</div>";
  }

  function buildMediaSlide(s, i) {
    var el = document.createElement("section");
    el.className = "slide slide--media";
    if (s.id) el.dataset.id = s.id;
    el.dataset.layout = "media";
    el.setAttribute("aria-roledescription", "slide");
    el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + s.title);
    el.style.setProperty("--accent", ACCENTS[s.accent] || ACCENTS.violet);

    var closeHtml = fullAccess ?
      '<button type="button" class="slide-close" data-slide-close ' +
        'aria-label="Voltar ao índice" title="Voltar ao índice">×</button>' : "";

    el.innerHTML =
      closeHtml +
      '<div class="panel">' +
        '<h2 class="panel-title">' + esc(s.title || "") + "</h2>" +
        '<div class="media-frame">' + mediaEmbedHTML(s.media) + "</div>" +
      "</div>";

    var closeBtn = el.querySelector("[data-slide-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openOverview();
      });
    }
    return el;
  }

  /* ---------- edição: chave (validada no servidor via PORTOBELLO_EDIT_KEY) ---------- */
  var EDIT_KEY_STORE = "portobello-edit-key";

  function storedEditKey() {
    try { return sessionStorage.getItem(EDIT_KEY_STORE); } catch (_) { return null; }
  }

  function clearEditKey() {
    try { sessionStorage.removeItem(EDIT_KEY_STORE); } catch (_) {}
  }

  // pede a chave, valida no servidor e recarrega com o modo edição ativo.
  // O reload reconstrói o deck com fullAccess=true (controles de edição).
  function requestEditMode() {
    var k = window.prompt("Chave de edição:");
    if (!k) return;
    fetch("/api/portobello-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "verify", key: k })
    })
      .then(function (r) {
        if (r.status === 401) { window.alert("Chave incorreta."); throw new Error("401"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        try { sessionStorage.setItem(EDIT_KEY_STORE, k); } catch (_) {}
        // remove ?edit=1 da URL antes do reload (evita novo prompt)
        try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) {}
        location.reload();
      })
      .catch(function (err) {
        if (err && err.message === "401") return;
        window.alert("Erro ao validar a chave. Tente novamente.");
      });
  }

  function download(filename, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- backups (histórico + export), gated por EDIT_KEY ---------- */
  function backupPost(action, extra) {
    var key = storedEditKey();
    if (!key) return Promise.reject(new Error("no-key"));
    return fetch("/api/portobello-backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action, key: key }, extra || {}))
    }).then(function (r) {
      if (r.status === 401) {
        clearEditKey();
        window.alert("Chave incorreta.");
        throw new Error("401");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function doExport() {
    backupPost("export")
      .then(function (bundle) {
        var stamp = new Date().toISOString().slice(0, 10);
        download("portobello-backup-" + stamp + ".json", JSON.stringify(bundle, null, 2), "application/json");
      })
      .catch(function (err) {
        if (err && (err.message === "401" || err.message === "no-key")) return;
        window.alert("Erro ao exportar. Tente novamente.");
      });
  }

  function doManualSnapshot() {
    return backupPost("manual").catch(function (err) {
      if (err && (err.message === "401" || err.message === "no-key")) return;
      window.alert("Erro ao criar snapshot.");
    });
  }

  function doRestore(id, closePanel) {
    backupPost("restore", { id: id })
      .then(function () {
        if (closePanel) closePanel();
        window.alert("Backup restaurado. A página será recarregada.");
        location.reload();
      })
      .catch(function (err) {
        if (err && (err.message === "401" || err.message === "no-key")) return;
        window.alert("Erro ao restaurar. Tente novamente.");
      });
  }

  function renderBackupsList(list, backups, closePanel) {
    if (!backups.length) { list.innerHTML = '<li class="backups-empty">Nenhum backup ainda.</li>'; return; }
    list.innerHTML = "";
    backups.forEach(function (b) {
      var li = document.createElement("li");
      li.className = "backups-item";
      var when = new Date(b.at).toLocaleString("pt-BR");
      var c = b.counts || {};
      var sum = "ed " + (c.overrides || 0) + " · novos " + (c.added || 0) + " · ocultos " + (c.hidden || 0);
      li.innerHTML =
        '<div class="backups-item-info">' +
          '<span class="backups-item-when">' + esc(when) + '</span>' +
          '<span class="backups-item-sum">' + esc(sum) + ' · ' + esc(b.reason) + '</span>' +
        '</div>' +
        '<button type="button" class="backups-restore">Restaurar</button>';
      li.querySelector(".backups-restore").addEventListener("click", function () {
        if (!window.confirm("Restaurar este backup? O estado atual será salvo antes.")) return;
        doRestore(b.id, closePanel);
      });
      list.appendChild(li);
    });
  }

  function openBackupsPanel() {
    var overlay = document.createElement("div");
    overlay.className = "backups-overlay";
    overlay.innerHTML =
      '<div class="backups-modal" role="dialog" aria-label="Backups" aria-modal="true">' +
        '<header class="backups-head">' +
          '<h3 class="backups-title">Backups</h3>' +
          '<button type="button" class="backups-close" data-close aria-label="Fechar">×</button>' +
        '</header>' +
        '<div class="backups-actions">' +
          '<button type="button" class="backups-action" data-manual>Criar snapshot agora</button>' +
          '<button type="button" class="backups-action" data-export>Baixar backup completo</button>' +
        '</div>' +
        '<ul class="backups-list" data-list><li class="backups-empty">Carregando…</li></ul>' +
      '</div>';
    document.body.appendChild(overlay);

    function close() {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
    }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    }
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector("[data-close]").addEventListener("click", close);
    overlay.querySelector("[data-export]").addEventListener("click", doExport);
    overlay.querySelector("[data-manual]").addEventListener("click", function () {
      doManualSnapshot().then(refresh);
    });

    function refresh() {
      var list = overlay.querySelector("[data-list]");
      return fetch("/api/portobello-backup", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : { backups: [] }; })
        .then(function (data) { renderBackupsList(list, data.backups || [], close); })
        .catch(function () { list.innerHTML = '<li class="backups-empty">Erro ao carregar.</li>'; });
    }
    refresh();
  }

  /* ---------- gerar PDF (impressão nativa do documento de territórios) ---------- */
  function preloadImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(function () {});
      return new Promise(function (res) {
        img.onload = function () { res(); };
        img.onerror = function () { res(); };
      });
    }));
  }

  /* As imagens de fundo são WebP; o PDF não suporta WebP, então o navegador as
     embute como pixels crus (FlateDecode) — ~35 MB. Reamostramos cada fundo num
     canvas e trocamos por um JPEG menor (DCTDecode), derrubando o tamanho para
     poucos MB sem perda visível na impressão. Same-origin: o canvas não taint-a. */
  var PRINT_BG_MAX_W = 1600; // largura máxima do JPEG embutido
  var PRINT_BG_QUALITY = 0.82;
  function rasterizeBackgrounds(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img.print-bg"));
    return Promise.all(imgs.map(function (img) {
      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return Promise.resolve(); // não decodificou: mantém original
      var scale = Math.min(1, PRINT_BG_MAX_W / nw);
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(nw * scale);
      canvas.height = Math.round(nh * scale);
      try {
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = canvas.toDataURL("image/jpeg", PRINT_BG_QUALITY);
      } catch (e) {
        return Promise.resolve(); // canvas tainted/sem suporte: mantém original
      }
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    }));
  }

  function generatePDF(orientation, ids) {
    if (!window.PrintDoc) { window.print(); return; }

    // limpa resíduo de um print anterior
    var prev = document.getElementById("print-root");
    if (prev) prev.remove();
    var prevRule = document.getElementById("print-page-rule");
    if (prevRule) prevRule.remove();

    // regra @page (orientação dinâmica)
    var rule = document.createElement("style");
    rule.id = "print-page-rule";
    rule.media = "print";
    rule.textContent = window.PrintDoc.pageRuleCSS(orientation);
    document.head.appendChild(rule);

    // monta o DOM de impressão (escondido na tela; visível só no @media print)
    var holder = document.createElement("div");
    holder.innerHTML = window.PrintDoc.buildPrintDocHTML(slides, { orientation: orientation, ids: ids });
    var root = holder.firstChild;
    document.body.appendChild(root);

    // limpeza cobrindo Chrome (afterprint) e Safari (matchMedia change)
    var mql = window.matchMedia ? window.matchMedia("print") : null;
    function cleanup() {
      if (root && root.parentNode) root.remove();
      if (rule && rule.parentNode) rule.remove();
      window.removeEventListener("afterprint", cleanup);
      if (mql && mql.removeEventListener) mql.removeEventListener("change", onMqlChange);
    }
    function onMqlChange(m) { if (!m.matches) cleanup(); }
    window.addEventListener("afterprint", cleanup);
    if (mql && mql.addEventListener) mql.addEventListener("change", onMqlChange);

    // Safari renderiza em branco se a imagem não terminou de decodificar;
    // depois de carregar, reamostra os fundos para JPEG (PDF mais leve).
    preloadImages(root)
      .then(function () { return rasterizeBackgrounds(root); })
      .then(function () { window.print(); });
  }

  /* ---------- exportar PPTX (imagem por slide, client-side) ---------- */
  // carrega um <script> sob demanda; cacheia a Promise por src.
  var scriptCache = {};
  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise(function (resolve, reject) {
      var sc = document.createElement("script");
      sc.src = src; sc.async = true;
      sc.onload = function () { resolve(); };
      sc.onerror = function () { reject(new Error("falha ao carregar " + src)); };
      document.head.appendChild(sc);
    });
    return scriptCache[src];
  }

  function ensurePptxLibs() {
    return Promise.all([
      window.htmlToImage ? Promise.resolve() : loadScript("js/vendor/html-to-image.js"),
      window.PptxGenJS ? Promise.resolve() : loadScript("js/vendor/pptxgen.bundle.js")
    ]);
  }

  // renderiza cada slide selecionado num palco oculto 1920x1080, rasteriza para
  // PNG e monta um .pptx (uma imagem full-bleed por slide). btn = o botão da UI
  // (p/ travar + rótulo "Gerando…").
  function exportPPTX(btn) {
    if (!window.PptxDoc) { window.alert("Exportação indisponível."); return; }
    var sel = window.PptxDoc.selectPptxSlides(slides, null, publishedHidden);
    if (!sel.length) { window.alert("Nenhum slide visível para exportar."); return; }

    var DIMS = window.PptxDoc.PPTX_DIMS;
    var label = btn && btn.querySelector(".intro-download-label");
    var orig = label ? label.textContent : "";
    if (btn) btn.disabled = true;
    if (label) label.textContent = "Gerando…";

    var holder = document.createElement("div");
    holder.style.cssText = "position:fixed; left:-99999px; top:0; width:" + DIMS.w +
      "px; height:" + DIMS.h + "px; overflow:hidden; background:#000; z-index:-1;";
    document.body.appendChild(holder);

    function finishPptx() {
      if (holder.parentNode) holder.remove();
      if (btn) btn.disabled = false;
      if (label) label.textContent = orig;
    }

    ensurePptxLibs()
      .then(function () {
        var pngs = [];
        // captura sequencial (uma por vez) p/ não estourar memória
        return sel.reduce(function (chain, s, i) {
          return chain.then(function () {
            holder.innerHTML = "";
            var node = buildSlide(s, i);
            // força visível e no tamanho-alvo; SEM is-current (não dispara o Ken Burns)
            node.style.cssText = "position:relative; inset:auto; width:" + DIMS.w +
              "px; height:" + DIMS.h + "px; opacity:1; visibility:visible; " +
              "transition:none; animation:none;";
            holder.appendChild(node);
            return preloadImages(node)
              .then(function () {
                return window.htmlToImage.toPng(node, {
                  width: DIMS.w, height: DIMS.h, pixelRatio: 1,
                  cacheBust: false, backgroundColor: "#000000"
                });
              })
              .then(function (png) { pngs.push(png); });
          }).catch(function (err) {
            throw new Error('slide "' + (s.title || s.id) + '": ' + ((err && err.message) || err));
          });
        }, Promise.resolve()).then(function () { return pngs; });
      })
      .then(function (pngs) {
        var pptx = new window.PptxGenJS();
        var LAY = window.PptxDoc.PPTX_LAYOUT;
        pptx.defineLayout({ name: LAY.name, width: LAY.width, height: LAY.height });
        pptx.layout = LAY.name;
        pngs.forEach(function (png) {
          var slide = pptx.addSlide();
          slide.background = { color: "000000" };
          slide.addImage({ data: png, x: 0, y: 0, w: "100%", h: "100%" });
        });
        return pptx.writeFile({ fileName: window.PptxDoc.pptxFileName(deckMeta) });
      })
      .then(function () { finishPptx(); })
      .catch(function (err) {
        finishPptx();
        window.alert("Erro ao exportar PPTX — " + ((err && err.message) || "tente novamente."));
      });
  }

  function go(i, fromHash) {
    closeSignal();
    if (!slides.length) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    index = i;
    els.forEach(function (el, n) { el.classList.toggle("is-current", n === i); });
    thumbs.forEach(function (el, n) { el.classList.toggle("is-current", n === i); });
    if (counterCur) counterCur.textContent = String(i + 1);
    if (progressBar) {
      var pct = Math.round(((i + 1) / slides.length) * 100);
      progressBar.style.width = pct + "%";
      var pb = progressBar.parentNode;
      if (pb && pb.setAttribute) pb.setAttribute("aria-valuenow", String(pct));
    }
    if (btnPrev) btnPrev.disabled = (i === 0);
    if (btnNext) btnNext.disabled = (i === slides.length - 1);
    // só o slide de abertura (intro) usa as partículas como fundo (no lugar do starfield)
    document.body.classList.toggle("on-intro", !!slides[i] && slides[i].type === "intro");
    // background1: reusa o canvas do gradiente da capa atrás do texto destaque
    document.body.classList.toggle("on-gradient", !!slides[i] && slides[i].layout === "background1");
    if (!fromHash) {
      var slug = slugForSlide(slides[i], i);
      try { history.replaceState(null, "", "#" + slug); } catch (e) {}
    }
    // frase-ia: começa a gerar a resposta + voz já na abertura (o botão só revela)
    prewarmFraseIa(slides[i]);
  }

  function next() { if (editing) return; go(index + 1); }
  function prev() { if (editing) return; go(index - 1); }

  /* ---------- visão geral / índice (grade de miniaturas) ---------- */
  // selo ▶ (slides de vídeo: layout video e media/MP4) — sem imagem externa
  function thumbVideoBadge() {
    return '<span class="thumb-fig-badge" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';
  }

  // tile de texto (manifesto/wordmark): mini-render da frase/nome, truncado
  function thumbTextTile(text) {
    return '<span class="thumb-fig-text" aria-hidden="true">' +
      '<span class="thumb-fig-text-in">' + esc(text) + "</span></span>";
  }

  // tile de vídeo: selo ▶ + título (mostra qual é o vídeo na miniatura)
  function thumbVideoTile(title) {
    return '<span class="thumb-fig-text thumb-fig-video" aria-hidden="true">' +
      '<svg class="thumb-fig-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' +
      (title ? '<span class="thumb-fig-text-in">' + esc(title) + "</span>" : "") +
      "</span>";
  }

  // <img> comum da miniatura (foto real, GIF ou 1ª imagem da galeria)
  function thumbImg(src, placeholder) {
    return '<img' + (placeholder ? ' class="is-placeholder"' : '') +
      ' src="' + esc(src) + '" alt="" loading="lazy" decoding="async">';
  }

  // fundo da .thumb-figure: escolhe a miniatura conforme o layout do slide
  function thumbBgHTML(s) {
    // imagem real (não-placeholder) tem precedência sobre a miniatura por layout
    if (s.image && s.image !== PLACEHOLDER_IMAGE) return thumbImg(s.image, false);
    // vídeo: selo ▶ + título na miniatura (media com GIF mostra o próprio GIF)
    if (s.layout === "video") return thumbVideoTile(s.title);
    if (s.layout === "media") {
      var m = s.media || {};
      var kind = m.kind || (m.url ? mediaKind(m.url) : "");
      if (m.url && kind === "image") return thumbImg(m.url, false);
      return thumbVideoBadge();
    }
    // layouts de texto: mini-render da frase/nome
    if ((s.layout === "manifesto" || s.layout === "wordmark" || s.layout === "frase-ia") && s.title) {
      return thumbTextTile(s.title);
    }
    // galeria: 1ª imagem, se houver
    if (s.layout === "grid") {
      var g = Array.isArray(s.gallery) ? s.gallery : [];
      if (g.length) return thumbImg(g[0], false);
    }
    // sem conteúdo próprio: placeholder (logo), ícone da intro ou ✦ genérico
    if (s.image) return thumbImg(s.image, s.image === PLACEHOLDER_IMAGE);
    if (s.type === "intro") {
      return '<span class="thumb-figure-intro" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24">' +
          '<path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</span>";
    }
    return '<span class="thumb-figure-fallback" aria-hidden="true">✦</span>';
  }

  // miolo completo da .thumb-figure: fundo + número + grip + título
  function thumbFigureHTML(s, i) {
    return thumbBgHTML(s) +
      '<span class="thumb-num">' + (i + 1) + "</span>" +
      '<span class="thumb-grip" aria-hidden="true">⠿</span>' +
      '<span class="thumb-title">' + esc(s.title) + "</span>";
  }

  function buildOverview() {
    if (!overviewGrid) return;
    overviewGrid.innerHTML = "";   // re-renderizável (após reordenar)

    thumbs = slides.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "thumb thumb-slide";
      b.setAttribute("role", "listitem");
      b.setAttribute("draggable", "true");
      b.setAttribute("aria-label", "Ir para o slide " + (i + 1) + ": " + s.title);
      b.innerHTML =
        '<span class="thumb-figure">' + thumbFigureHTML(s, i) + "</span>";
      b.addEventListener("click", function () {
        if (justDragged) return;
        go(i); closeOverview();
      });
      b.addEventListener("dragstart", function (e) { onDragStart(e, i, b); });
      b.addEventListener("dragover", function (e) { onDragOver(e, b); });
      b.addEventListener("dragleave", function () { b.classList.remove("drop-before", "drop-after"); });
      b.addEventListener("drop", function (e) { onDrop(e, i, b); });
      b.addEventListener("dragend", onDragEnd);

      // botão de deletar (canto sup. direito), só @aeroli.to e só territórios.
      // span (não button) para não aninhar botões; fecha sobre o objeto s.
      if (fullAccess && s.type !== "intro") {
        var del = document.createElement("span");
        del.className = "thumb-del";
        del.setAttribute("role", "button");
        del.setAttribute("tabindex", "0");
        del.setAttribute("aria-label", "Deletar slide");
        del.title = "Deletar slide";
        del.textContent = "×";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          requestDeleteSlide(s);
        });
        del.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault(); e.stopPropagation(); requestDeleteSlide(s);
          }
        });
        b.appendChild(del);
      }

      overviewGrid.appendChild(b);
      return b;
    });
  }

  /* ---------- reordenar por arrastar (desktop) ---------- */
  function onDragStart(e, i, b) {
    dragFrom = i;
    b.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(i)); } catch (_) {}
    }
  }
  function dropAfter(e, b) {
    var r = b.getBoundingClientRect();
    return e.clientX > r.left + r.width / 2;
  }
  function onDragOver(e, b) {
    if (dragFrom === -1) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    var after = dropAfter(e, b);
    b.classList.toggle("drop-after", after);
    b.classList.toggle("drop-before", !after);
  }
  function onDrop(e, i, b) {
    if (dragFrom === -1) return;
    e.preventDefault();
    var after = dropAfter(e, b);
    b.classList.remove("drop-before", "drop-after");
    reorder(dragFrom, after ? i + 1 : i);   // before = índice-alvo (inserir antes dele)
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
  }
  function onDragEnd() {
    dragFrom = -1;
    thumbs.forEach(function (t) { t.classList.remove("dragging", "drop-before", "drop-after"); });
  }

  function reorder(from, before) {
    if (from < 0 || from >= slides.length) { onDragEnd(); return; }
    if (before === from || before === from + 1) { onDragEnd(); return; } // sem mudança real
    var currentId = slides[index] && slides[index].id;

    var s = slides.splice(from, 1)[0];
    var el = els.splice(from, 1)[0];
    var to = before > from ? before - 1 : before;
    slides.splice(to, 0, s);
    els.splice(to, 0, el);

    els.forEach(function (node) { stage.appendChild(node); }); // reordena o DOM dos slides
    updateSlideMeta();
    updateTerritoryNumbers();   // renumera "Território NN / 10" pela nova ordem
    buildOverview();   // reconstrói as miniaturas na nova ordem
    saveOrder();

    var ni = currentId ? slides.findIndex(function (x) { return x.id === currentId; }) : index;
    go(ni < 0 ? Math.min(index, slides.length - 1) : ni);
  }

  function updateSlideMeta() {
    els.forEach(function (el, i) {
      el.setAttribute("aria-label", (i + 1) + " de " + slides.length + ": " + slides[i].title);
    });
  }

  /* renumera os eyebrows "Território NN / 10" pela ordem atual dos territórios
     no deck — chamado no build inicial e a cada reordenação. */
  function updateTerritoryNumbers() {
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    var territories = slides.filter(isTerritorySlide);
    var total = territories.length;
    slides.forEach(function (s, i) {
      var pos = territories.indexOf(s);
      if (pos < 0 || !els[i]) return;
      var eb = els[i].querySelector(".panel-eyebrow");
      if (eb) eb.textContent = "Slide " + pad(pos + 1) + " / " + pad(total);
    });
  }

  /* ---------- persistência da ordem (localStorage) ---------- */
  function saveOrder() {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(slides.map(function (s) { return s.id; })));
    } catch (_) {}
  }
  function applySavedOrder(arr) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "null"); } catch (_) {}
    if (!saved || !Array.isArray(saved)) return arr;
    var byId = {};
    arr.forEach(function (s) { byId[s.id] = s; });
    var out = [];
    saved.forEach(function (id) { if (byId[id]) { out.push(byId[id]); delete byId[id]; } });
    arr.forEach(function (s) { if (byId[s.id]) out.push(s); }); // slides novos vão ao fim
    return out.length === arr.length ? out : arr;
  }

  // remove um slide do deck ao vivo (mesma mecânica do reorder), preservando o
  // slide atual quando possível. Não persiste nada — quem chama decide o registro.
  function spliceSlideLive(s) {
    var i = slides.indexOf(s);
    if (i === -1) return;
    var curId = slides[index] && slides[index].id;
    slides.splice(i, 1);
    var el = els.splice(i, 1)[0];
    if (el && el.parentNode) el.parentNode.removeChild(el);
    updateSlideMeta();
    updateTerritoryNumbers();
    buildOverview();
    if (counterTot) counterTot.textContent = String(slides.length);
    var ni = -1;
    if (curId && curId !== s.id) {   // a ação veio de outro slide: mantém o atual
      ni = slides.findIndex(function (x) { return x.id === curId; });
    }
    if (ni < 0) ni = Math.min(i, slides.length - 1);   // era o slide atual: vai ao próximo (ou último)
    go(Math.max(0, ni));
  }

  function openOverview() {
    if (overviewOpen || !overview) return;
    overviewOpen = true;
    deck.classList.add("overview-open");
    overview.hidden = false;
    clearTimeout(hideTimer);
  }
  function closeOverview() {
    if (!overviewOpen) return;
    overviewOpen = false;
    deck.classList.remove("overview-open");
    if (overview) overview.hidden = true;
    poke();
  }
  function toggleOverview() { if (editing) return; overviewOpen ? closeOverview() : openOverview(); }

  /* ---------- painel de sinal ---------- */
  var sigPanel = document.getElementById("signal-panel");
  var sigPos = document.getElementById("signal-pos");
  var sigTitle = document.getElementById("signal-title");
  var sigDesc = document.getElementById("signal-desc");
  var sigLink = document.getElementById("signal-link");
  var sigClose = document.getElementById("signal-close");
  var sigSlide = null;      // objeto do slide dono do sinal aberto (null = fechado)
  var sigIndex = -1;
  var sigReturnFocus = null;

  function signalOpen() { return sigSlide !== null; }

  function renderSignal() {
    var it = sigSlide.items[sigIndex];
    var label = (it && typeof it === "object") ? it.label : it;
    if (sigPos) sigPos.textContent = (sigIndex + 1) + " / " + sigSlide.items.length;
    if (sigTitle) sigTitle.textContent = label || "";
    var desc = (it && typeof it === "object" && it.description) || "";
    if (sigDesc) { sigDesc.textContent = desc; sigDesc.hidden = !desc; }
    var url = (it && typeof it === "object" && it.url) || "";
    if (sigLink) {
      if (url) { sigLink.href = url; sigLink.hidden = false; } else { sigLink.hidden = true; }
    }
    markActiveChip();
  }

  function markActiveChip() {
    var cur = els[index];
    if (!cur) return;
    Array.prototype.forEach.call(cur.querySelectorAll(".chip-btn"), function (b) {
      var on = signalOpen() && parseInt(b.getAttribute("data-item"), 10) === sigIndex;
      b.classList.toggle("is-open", on);
    });
  }

  function openSignal(s, k, btn) {
    sigSlide = s; sigIndex = k; sigReturnFocus = btn || null;
    renderSignal();
    if (sigPanel) { sigPanel.hidden = false; sigPanel.focus(); }
    clearTimeout(hideTimer);
  }

  function closeSignal() {
    if (!signalOpen()) return;
    sigSlide = null; sigIndex = -1;
    if (sigPanel) sigPanel.hidden = true;
    markActiveChip();
    if (sigReturnFocus) { try { sigReturnFocus.focus(); } catch (_) {} }
    sigReturnFocus = null;
    poke();
  }

  function stepSignal(d) {
    if (!signalOpen()) return;
    var n = sigSlide.items.length;
    if (n === 0) return;
    sigIndex = (sigIndex + d + n) % n;
    renderSignal();
  }

  /* ---------- auto-ocultar dos controles ---------- */
  function poke() {
    if (!ready || overviewOpen) return;
    deck.classList.remove("controls-hidden");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!overviewOpen) deck.classList.add("controls-hidden");
    }, HIDE_DELAY);
  }

  /* ---------- entrada e navegação ---------- */
  function onKey(e) {
    if (!ready) return;
    if (editing) {
      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
      return;   // deixa o contenteditable receber digitação e setas
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (signalOpen()) { closeSignal(); } else { toggleOverview(); }
      return;
    }
    poke();
    if (overviewOpen) return;
    if (signalOpen()) {
      // com o painel aberto, setas navegam entre os sinais do slide
      if (e.key === "ArrowRight") { e.preventDefault(); stepSignal(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepSignal(-1); }
      return;
    }
    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ": case "Spacebar":
        e.preventDefault(); next(); break;
      case "ArrowLeft": case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home": e.preventDefault(); go(0); break;
      case "End": e.preventDefault(); go(slides.length - 1); break;
      case "f": case "F": toggleFull(); break;
      case "e": case "E":
        e.preventDefault();
        if (!fullAccess) requestEditMode(); else toggleEdit();
        break;
    }
  }

  var tsX = 0, tsY = 0, tracking = false;
  function onTouchStart(e) {
    if (!ready || !e.touches || e.touches.length !== 1) return;
    tracking = true; tsX = e.touches[0].clientX; tsY = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    var t = (e.changedTouches && e.changedTouches[0]) || null;
    if (!t) return;
    var dx = t.clientX - tsX, dy = t.clientY - tsY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
  }

  function toggleFull() {
    var d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      var root = d.documentElement;
      (root.requestFullscreen || root.webkitRequestFullscreen || function () {}).call(root);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    }
  }

  function hashIndex() {
    var h = "";
    try { h = decodeURIComponent((location.hash || "").slice(1)); } catch (_) {}
    if (!h) return 0;
    if (/^\d+$/.test(h)) return Math.max(0, parseInt(h, 10) - 1); // links antigos #2
    // casa pelo slug do título; se não achar, tenta pelo id (links por id)
    var ix = slides.findIndex(function (s) { return slugify(s.title) === h; });
    if (ix < 0) ix = slides.findIndex(function (s) { return s.id === h; });
    return ix < 0 ? 0 : ix;
  }

  function activate() {
    if (activated) return;
    activated = true;
    deck.classList.add("is-active");
    if (controls) controls.hidden = false;
    ready = true;
    go(hashIndex(), true);
    poke(); // inicia o ciclo de auto-ocultar
  }

  // registrado de forma síncrona (antes do login disparar "enter-deck") p/ não perder o evento
  function requestEnter() { entered = true; maybeBuild(); }
  function maybeActivate() { if (entered && loaded) activate(); }

  // só monta o deck depois que o usuário entrou — assim storedEditKey()
  // já está disponível quando buildDeck lê fullAccess. Sem capa (dev/visão direta),
  // entered já é true e monta assim que os dados chegam.
  function onData(data) { pendingData = data; maybeBuild(); }
  function maybeBuild() {
    if (built || !pendingData || !entered) return;
    built = true;
    buildDeck(pendingData);
  }

  /* ---------- modo edição (só @aeroli.to / fullAccess) ---------- */
  var editing = false;
  var editBtn = null, editBar = null;
  var pendingImage = null;   // { dataBase64, contentType } da imagem nova (antes de salvar)
  var pendingImageRemove = false;   // "Remover imagem": volta ao placeholder ao salvar
  var pendingGallery = null;   // grid: lista de URLs de imagens sendo editada
  var pendingVideo = null;   // video: link do YouTube sendo editado
  var pendingMedia = null;   // media: { url, kind } sendo editado

  function buildEditControls() {
    if (!fullAccess || !controls || editBtn) return;
    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "nav-btn nav-edit";
    editBtn.setAttribute("aria-label", "Editar slide");
    editBtn.title = "Editar slide";
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    editBtn.addEventListener("click", toggleEdit);
    controls.appendChild(editBtn);

    editBar = document.createElement("div");
    editBar.className = "edit-bar";
    editBar.hidden = true;
    editBar.innerHTML =
      '<span class="edit-bar-hint">Editando — texto cru (use ** para destaque)</span>' +
      '<button type="button" class="edit-btn edit-save" data-edit="save">Salvar</button>' +
      '<button type="button" class="edit-btn edit-cancel" data-edit="cancel">Cancelar</button>';
    editBar.querySelector('[data-edit="save"]').addEventListener("click", saveEdit);
    editBar.querySelector('[data-edit="cancel"]').addEventListener("click", cancelEdit);
    deck.appendChild(editBar);

    // botão "+ Novo slide" no cabeçalho do índice, com seletor de layout
    var ovHead = overview && overview.querySelector(".overview-head");
    if (ovHead && !ovHead.querySelector(".overview-add")) {
      var addWrap = document.createElement("div");
      addWrap.className = "overview-add-wrap";

      var addSlideBtn = document.createElement("button");
      addSlideBtn.type = "button";
      addSlideBtn.className = "nav-btn overview-add";
      addSlideBtn.setAttribute("aria-label", "Adicionar slide");
      addSlideBtn.setAttribute("aria-haspopup", "menu");
      addSlideBtn.setAttribute("aria-expanded", "false");
      addSlideBtn.title = "Adicionar slide";
      addSlideBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" ' +
        'stroke-width="1.8" stroke-linecap="round"/></svg>';

      var addMenu = document.createElement("div");
      addMenu.className = "overview-add-menu";
      addMenu.hidden = true;
      addMenu.setAttribute("role", "menu");
      addMenu.innerHTML = LAYOUT_CHOICES.map(function (o) {
        return '<button type="button" class="overview-add-opt" role="menuitem" ' +
          'data-layout="' + o.value + '">' +
          '<span class="overview-add-opt-name">' + esc(o.name) + '</span>' +
          '<span class="overview-add-opt-desc">' + esc(o.desc) + '</span>' +
        '</button>';
      }).join("");

      var closeAddMenu = function () {
        addMenu.hidden = true;
        addSlideBtn.setAttribute("aria-expanded", "false");
      };
      addSlideBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = addMenu.hidden;
        addMenu.hidden = !willOpen;
        addSlideBtn.setAttribute("aria-expanded", String(willOpen));
      });
      addMenu.addEventListener("click", function (e) {
        var opt = e.target.closest ? e.target.closest("[data-layout]") : null;
        if (!opt) return;
        e.stopPropagation();
        closeAddMenu();
        addNewSlide(opt.getAttribute("data-layout") || "");
      });
      document.addEventListener("click", function () {
        if (!addMenu.hidden) closeAddMenu();
      });

      addWrap.appendChild(addSlideBtn);
      addWrap.appendChild(addMenu);
      var closeBtn = ovHead.querySelector("#overview-close");
      if (closeBtn) ovHead.insertBefore(addWrap, closeBtn);
      else ovHead.appendChild(addWrap);

    }
  }

  /* ---------- adicionar / deletar slide (publicado, só @aeroli.to) ---------- */
  // template por layout. Todos mantêm image=PLACEHOLDER p/ entrarem nas miniaturas
  // da intro e na geração de PDF (são "territórios" com layout diferente).
  function makeNewSlideTemplate(layout) {
    var rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var base = { id: "novo-" + rand, image: PLACEHOLDER_IMAGE, accent: "violet", _added: true };
    switch (layout) {
      case "grid":
        base.layout = "grid";
        base.title = "Referências";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        base.gallery = [];   // preenchida ao subir imagens no modo de edição
        break;
      case "wordmark":
        base.layout = "wordmark";
        base.title = "Marca";
        base.subtitle = "assinatura ou tagline da marca";
        base.body = [];
        base.items = [];
        break;
      case "hero":
        base.layout = "hero";
        base.title = "Legenda da imagem";
        base.subtitle = "";
        base.body = [""];
        base.items = [];
        break;
      case "hero-static":
        base.layout = "hero-static";
        base.title = "Legenda da imagem";
        base.subtitle = "";
        base.body = [""];
        base.items = [];
        break;
      case "manifesto":
        base.layout = "manifesto";
        base.title = "Uma frase-manifesto que resume a visão.";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        break;
      case "frase-ia":
        base.layout = "frase-ia";
        base.title = "Uma frase-manifesto que a IA vai comentar.";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        break;
      case "pontos":
        base.layout = "pontos";
        base.title = "Título do slide";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        base.points = [
          { icon: "bulb",   text: "Ponto 1" },
          { icon: "target", text: "Ponto 2" },
          { icon: "user",   text: "Ponto 3" },
          { icon: "nodes",  text: "Ponto 4" }
        ];
        break;
      case "background1":
        base.layout = "background1";
        base.title = "Texto em destaque sobre o gradiente.";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        break;
      case "video":
        base.layout = "video";
        base.title = "Vídeo";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        base.video = "";   // link do YouTube, definido no modo de edição
        break;
      case "media":
        base.layout = "media";
        base.title = "GIF / Vídeo";
        base.subtitle = "";
        base.body = [];
        base.items = [];
        base.media = {};   // { url, kind }, definido no modo de edição
        break;
      default:   // clássico (imagem de fundo + painel de texto)
        base.title = "Novo Slide";
        base.body = [""];
        base.items = [];
    }
    return base;
  }

  function addNewSlide(layout) {
    if (!fullAccess) return;
    var slide = makeNewSlideTemplate(layout);
    postContent({ action: "addSlide", slide: slide })
      .then(function () {
        var i = slides.length;
        slides.splice(i, 0, slide);
        var el = buildSlide(slide, i);
        els.splice(i, 0, el);
        stage.insertBefore(el, els[i + 1] || null);
        updateSlideMeta();
        updateTerritoryNumbers();
        buildOverview();
        if (counterTot) counterTot.textContent = String(slides.length);
        closeOverview();
        go(i);
        enterEdit(slide);   // abre o novo slide já no modo edição
      })
      .catch(reportSaveError);
  }

  function requestDeleteSlide(s) {
    if (!fullAccess || !s) return;
    confirmModal(
      "Deletar slide",
      "Tem certeza que deseja deletar “" + (s.title || "este slide") +
        "”? Ele sairá do deck para todos.",
      function () {
        postContent({ action: "hideSlide", slideId: s.id })
          .then(function () {
            spliceSlideLive(s);
          })
          .catch(reportSaveError);
      });
  }

  /* ---------- modal de confirmação reutilizável ---------- */
  var confirmEl = null;
  function confirmModal(title, message, onConfirm) {
    if (!confirmEl) {
      confirmEl = document.createElement("div");
      confirmEl.className = "confirm-overlay";
      confirmEl.hidden = true;
      confirmEl.innerHTML =
        '<div class="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">' +
          '<h3 class="confirm-title" id="confirm-title"></h3>' +
          '<p class="confirm-msg"></p>' +
          '<div class="confirm-actions">' +
            '<button type="button" class="confirm-cancel">Cancelar</button>' +
            '<button type="button" class="confirm-ok">Deletar</button>' +
          '</div>' +
        '</div>';
      confirmEl.addEventListener("click", function (e) {
        if (e.target === confirmEl) hideConfirm();   // clique fora fecha
      });
      deck.appendChild(confirmEl);
    }
    confirmEl.querySelector(".confirm-title").textContent = title;
    confirmEl.querySelector(".confirm-msg").textContent = message;
    // re-vincula os botões limpando handlers antigos (clonando)
    var ok = confirmEl.querySelector(".confirm-ok");
    var cancel = confirmEl.querySelector(".confirm-cancel");
    var ok2 = ok.cloneNode(true); ok.parentNode.replaceChild(ok2, ok);
    var cancel2 = cancel.cloneNode(true); cancel.parentNode.replaceChild(cancel2, cancel);
    ok2.addEventListener("click", function () { hideConfirm(); onConfirm(); });
    cancel2.addEventListener("click", hideConfirm);
    confirmEl.hidden = false;
    ok2.focus();
  }
  function hideConfirm() { if (confirmEl) confirmEl.hidden = true; }

  function toggleEdit() {
    if (editing) { cancelEdit(); return; }
    var s = slides[index];
    if (!s || s.type === "intro") {
      window.alert("Só slides de conteúdo podem ser editados (título, corpo e imagem).");
      return;
    }
    enterEdit(s);
  }

  function enterEdit(s) {
    editing = true;
    pendingImage = null;
    pendingImageRemove = false;
    pendingGallery = null;
    pendingVideo = null;
    pendingMedia = null;
    deck.classList.add("is-editing");
    if (editBar) editBar.hidden = false;
    var el = els[index];
    if (!el) return;

    var titleEl = el.querySelector(".panel-title");
    if (titleEl) { titleEl.contentEditable = "true"; titleEl.textContent = s.title; }

    var subtitleEl = el.querySelector(".panel-subtitle");
    if (subtitleEl) { subtitleEl.contentEditable = "true"; subtitleEl.textContent = s.subtitle || ""; }

    // grade de referências: editor de galeria (upload múltiplo), sem chips/imagem-fundo
    if (s.layout === "grid") {
      buildGalleryEditor(el, s);
      return;
    }

    // vídeo: campo de link do YouTube (sem chips/imagem-fundo)
    if (s.layout === "video") {
      buildVideoEditor(el, s);
      return;
    }

    // media: upload de GIF/MP4 + campo de URL (sem chips/imagem-fundo)
    if (s.layout === "media") {
      buildMediaEditor(el, s);
      return;
    }

    // corpo: blocos editáveis com o TEXTO-FONTE cru (preserva **, >, ###, \n)
    var copy = el.querySelector(".panel-copy");
    if (copy) {
      var paras = Array.isArray(s.body) ? s.body : [s.body];
      // body vazio ([]) precisa de ao menos um bloco editável, senão não há
      // onde digitar (some a opção de adicionar corpo — ex.: hero/manifesto)
      if (!paras.length) paras = [""];
      copy.innerHTML = paras.map(function () {
        return '<p class="panel-body edit-block" contenteditable="true"></p>';
      }).join("");
      var blocks = copy.querySelectorAll(".edit-block");
      paras.forEach(function (p, i) { if (blocks[i]) blocks[i].textContent = p; });

      // botão "+ Parágrafo": acrescenta um bloco editável vazio e foca nele.
      // fica como último filho de .panel-copy; novos blocos entram antes dele,
      // então saveEdit (que lê .panel-copy .edit-block em ordem) os capta certo.
      var addPara = document.createElement("button");
      addPara.type = "button";
      addPara.className = "edit-add-para";
      addPara.textContent = "+ Parágrafo";
      addPara.addEventListener("click", function () {
        var p = document.createElement("p");
        p.className = "panel-body edit-block";
        p.contentEditable = "true";
        copy.insertBefore(p, addPara);
        p.focus();
      });
      copy.appendChild(addPara);
    }

    // ferramentas de imagem (sobrepostas): trocar + remover
    var tools = document.createElement("div");
    tools.className = "edit-image-tools";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "edit-image-btn";
    btn.textContent = "Trocar imagem";
    var input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.hidden = true;
    btn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (file) pickImage(file, el);
    });

    // remover imagem: volta ao placeholder (logo Aerolito); efetiva-se ao Salvar
    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "edit-image-btn edit-image-remove";
    rm.textContent = "Remover imagem";
    rm.addEventListener("click", function () { removeImage(el); });

    tools.appendChild(btn);
    tools.appendChild(rm);
    tools.appendChild(input);
    el.appendChild(tools);

    // editor de sinais (chips): label + url + descrição por chip, com add/remover
    buildChipEditor(el, s);
  }

  // marca a remoção da imagem e mostra o placeholder no preview (persiste ao salvar)
  function removeImage(el) {
    pendingImage = null;
    pendingImageRemove = true;
    var bg = el.querySelector(".slide-bg");
    if (bg) { bg.src = PLACEHOLDER_IMAGE; bg.classList.add("is-placeholder"); }
  }

  /* ---------- editor de vídeo (layout video) ---------- */
  // campo de link do YouTube; a prévia do embed atualiza ao confirmar (change).
  // O link só é PERSISTIDO ao "Salvar".
  function buildVideoEditor(el, s) {
    pendingVideo = s.video || "";
    var panel = el.querySelector(".panel");
    if (!panel) return;
    var wrap = document.createElement("div");
    wrap.className = "video-edit";
    var label = document.createElement("span");
    label.className = "video-edit-label";
    label.textContent = "Link do YouTube";
    var input = document.createElement("input");
    input.type = "url";
    input.className = "video-edit-input";
    input.placeholder = "https://youtu.be/… ou https://youtube.com/watch?v=…";
    input.value = pendingVideo;
    input.addEventListener("input", function () { pendingVideo = input.value.trim(); });
    input.addEventListener("change", function () { updateVideoPreview(el, s); });
    wrap.appendChild(label);
    wrap.appendChild(input);
    panel.appendChild(wrap);
  }

  function updateVideoPreview(el, s) {
    var frame = el.querySelector(".video-frame");
    if (frame) frame.innerHTML = videoEmbedHTML(pendingVideo, s.title);
  }

  /* ---------- editor de media (layout media) ---------- */
  // ~4 MB: acima disso o corpo base64 estoura o limite da função síncrona.
  var MEDIA_MAX_BYTES = 4.3 * 1024 * 1024;

  function buildMediaEditor(el, s) {
    pendingMedia = (s.media && typeof s.media === "object")
      ? { url: s.media.url || "", kind: s.media.kind || "" }
      : { url: "", kind: "" };
    var panel = el.querySelector(".panel");
    if (!panel) return;

    var wrap = document.createElement("div");
    wrap.className = "media-edit";

    var upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "media-edit-btn";
    upBtn.textContent = "Enviar arquivo";
    var file = document.createElement("input");
    file.type = "file"; file.accept = "image/gif,video/mp4"; file.hidden = true;
    upBtn.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (f) uploadMediaFile(f, el);
    });

    var hint = document.createElement("span");
    hint.className = "media-edit-hint";
    hint.textContent = "GIF ou MP4 até ~4 MB. Arquivos maiores: use uma URL.";

    var label = document.createElement("span");
    label.className = "media-edit-label";
    label.textContent = "ou cole uma URL (.gif / .mp4)";
    var url = document.createElement("input");
    url.type = "url";
    url.className = "media-edit-input";
    url.placeholder = "https://…/arquivo.gif ou .mp4";
    url.value = pendingMedia.url;
    url.addEventListener("input", function () {
      pendingMedia = { url: url.value.trim(), kind: mediaKind(url.value.trim()) };
    });
    url.addEventListener("change", function () { updateMediaPreview(el); });

    wrap.appendChild(upBtn);
    wrap.appendChild(hint);
    wrap.appendChild(label);
    wrap.appendChild(url);
    wrap.appendChild(file);
    panel.appendChild(wrap);
  }

  function updateMediaPreview(el) {
    var frame = el.querySelector(".media-frame");
    if (frame) frame.innerHTML = mediaEmbedHTML(pendingMedia);
  }

  // lê o arquivo como base64 (sem canvas: preserva o GIF e não quebra o MP4),
  // reusa o endpoint imageUpload e guarda { url, kind } em pendingMedia.
  function uploadMediaFile(file, el) {
    if (file.size > MEDIA_MAX_BYTES) {
      window.alert("Arquivo grande demais (máx ~4 MB). Hospede o arquivo e cole a URL.");
      return;
    }
    var slideId = slides[index].id;
    var upBtn = el.querySelector(".media-edit-btn");
    if (upBtn) upBtn.disabled = true;
    var kind = /^video\//.test(file.type) ? "video" : "image";
    var reader = new FileReader();
    reader.onload = function () {
      var dataBase64 = String(reader.result).split(",")[1];
      var up = { contentType: file.type || "application/octet-stream", dataBase64: dataBase64 };
      postContent({ slideId: slideId, imageUpload: up })
        .then(function (j) {
          if (j && j.imageUrl) {
            pendingMedia = { url: j.imageUrl, kind: kind };
            updateMediaPreview(el);
            var inp = el.querySelector(".media-edit-input");
            if (inp) inp.value = j.imageUrl;
          }
          if (upBtn) upBtn.disabled = false;
        })
        .catch(function (err) {
          if (upBtn) upBtn.disabled = false;
          reportSaveError(err);
        });
    };
    reader.onerror = function () {
      if (upBtn) upBtn.disabled = false;
      window.alert("Não foi possível ler o arquivo.");
    };
    reader.readAsDataURL(file);
  }

  /* ---------- editor de galeria (layout grid) ---------- */
  // upload múltiplo: cada arquivo é reamostrado e enviado na hora; a URL entra
  // em pendingGallery e vira uma thumb. A lista só é PERSISTIDA ao "Salvar".
  function buildGalleryEditor(el, s) {
    pendingGallery = (Array.isArray(s.gallery) ? s.gallery : []).slice();
    var gal = el.querySelector(".grid-gallery");
    if (!gal) return;
    renderGalleryEditor(gal, s);
  }

  function renderGalleryEditor(gal, s) {
    gal.classList.add("grid-gallery-edit");
    gal.innerHTML =
      pendingGallery.map(function (url, k) {
        return '<li class="grid-thumb"><img src="' + esc(url) + '" alt="">' +
          '<button type="button" class="grid-thumb-del" data-k="' + k + '" ' +
          'aria-label="Remover imagem" title="Remover">×</button></li>';
      }).join("") +
      '<li class="grid-thumb grid-thumb-add">' +
        '<button type="button" class="grid-add-btn" aria-label="Adicionar imagens">' +
          '<span class="grid-add-plus">+</span><span class="grid-add-txt">imagens</span>' +
        '</button>' +
        '<input type="file" accept="image/*" multiple hidden>' +
      '</li>';

    Array.prototype.forEach.call(gal.querySelectorAll(".grid-thumb-del"), function (btn) {
      btn.addEventListener("click", function () {
        pendingGallery.splice(parseInt(btn.getAttribute("data-k"), 10), 1);
        renderGalleryEditor(gal, s);
      });
    });
    var addBtn = gal.querySelector(".grid-add-btn");
    var input = gal.querySelector('input[type="file"]');
    addBtn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      uploadGalleryFiles(input.files, gal, s);
      input.value = "";
    });
  }

  // teto de reamostragem no upload. 2560px + qualidade alta para não pixelar
  // em telão/projetor (o slide é full-bleed e ainda leva zoom Ken Burns até 112%).
  // Nunca faz upscale: Math.min(1, ...) mantém originais menores como estão.
  var UPLOAD_MAX_W = 2560;
  var UPLOAD_QUALITY = 0.92;

  // reamostra (máx UPLOAD_MAX_W, JPEG) e devolve { contentType, dataBase64 } via Promise
  function resizeToUpload(file) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, UPLOAD_MAX_W / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        try {
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          var d = c.toDataURL("image/jpeg", UPLOAD_QUALITY);
          resolve({ contentType: "image/jpeg", dataBase64: d.split(",")[1] });
        } catch (e) { resolve(null); }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { resolve(null); };
      img.src = URL.createObjectURL(file);
    });
  }

  function uploadGalleryFiles(files, gal, s) {
    var arr = Array.prototype.slice.call(files || []);
    if (!arr.length) return;
    gal.classList.add("is-uploading");
    var chain = Promise.resolve();
    arr.forEach(function (file) {
      chain = chain.then(function () {
        return resizeToUpload(file).then(function (up) {
          if (!up) return;
          return postContent({ slideId: s.id, imageUpload: up }).then(function (j) {
            if (j && j.imageUrl) {
              pendingGallery.push(j.imageUrl);
              renderGalleryEditor(gal, s);
            }
          });
        });
      });
    });
    chain
      .then(function () { gal.classList.remove("is-uploading"); })
      .catch(function (err) { gal.classList.remove("is-uploading"); reportSaveError(err); });
  }

  // troca a lista .chips do slide por um editor; uma linha por sinal
  function buildChipEditor(el, s) {
    var chips = el.querySelector(".chips");
    if (!chips) return;
    chips.classList.add("chip-editor");
    chips.innerHTML = "";
    var items = Array.isArray(s.items) ? s.items : [];
    items.forEach(function (it) {
      var o = (it && typeof it === "object") ? it : { label: String(it || "") };
      chips.appendChild(makeChipRow(o.label || "", o.url || "", o.description || ""));
    });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "chip-add-btn";
    add.textContent = "+ adicionar sinal";
    add.addEventListener("click", function () {
      chips.insertBefore(makeChipRow("", "", ""), add);
    });
    chips.appendChild(add);
  }

  function makeChipRow(label, url, description) {
    var li = document.createElement("li");
    li.className = "chip-row";
    var lab = document.createElement("input");
    lab.type = "text"; lab.className = "chip-edit chip-edit-label";
    lab.placeholder = "Nome do sinal"; lab.value = label;
    var u = document.createElement("input");
    u.type = "url"; u.className = "chip-edit chip-edit-url";
    u.placeholder = "Link (https://…)"; u.value = url;
    var desc = document.createElement("textarea");
    desc.className = "chip-edit chip-edit-desc";
    desc.rows = 3; desc.placeholder = "Texto que aparece ao clicar"; desc.value = description;
    var rm = document.createElement("button");
    rm.type = "button"; rm.className = "chip-remove-btn";
    rm.setAttribute("aria-label", "Remover sinal"); rm.title = "Remover sinal";
    rm.textContent = "×";
    rm.addEventListener("click", function () { li.remove(); });
    li.appendChild(lab); li.appendChild(u); li.appendChild(desc); li.appendChild(rm);
    return li;
  }

  // reamostra a imagem escolhida (máx UPLOAD_MAX_W, JPEG) e mostra preview no fundo
  function pickImage(file, el) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, UPLOAD_MAX_W / img.naturalWidth);
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      try {
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL("image/jpeg", UPLOAD_QUALITY);
        pendingImage = { contentType: "image/jpeg", dataBase64: dataUrl.split(",")[1] };
        pendingImageRemove = false;   // escolher imagem cancela a remoção pendente
        var bg = el.querySelector(".slide-bg");
        if (bg) { bg.src = dataUrl; bg.classList.remove("is-placeholder"); }   // preview imediato
      } catch (e) {
        window.alert("Não foi possível processar a imagem.");
      }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = function () { window.alert("Arquivo de imagem inválido."); };
    img.src = URL.createObjectURL(file);
  }

  function collectPatch(s, el) {
    var patch = {};
    var titleEl = el.querySelector(".panel-title");
    if (titleEl) {
      var t = titleEl.textContent.trim();
      if (t && t !== s.title) patch.title = t;
    }
    var subEl = el.querySelector(".panel-subtitle");
    if (subEl) {
      var sub = (subEl.innerText || subEl.textContent || "").trim();
      if (sub !== (s.subtitle || "")) patch.subtitle = sub;   // "" limpa o subtítulo
    }
    var blocks = el.querySelectorAll(".panel-copy .edit-block");
    if (blocks.length) {
      var body = Array.prototype.map.call(blocks, function (b) {
        return (b.innerText || b.textContent || "").replace(/\r/g, "").trim();
      }).filter(function (p) { return p.length; });
      var orig = Array.isArray(s.body) ? s.body : [s.body];
      if (JSON.stringify(body) !== JSON.stringify(orig)) patch.body = body;
    }

    // sinais (chips): um objeto por linha; descarta linhas sem label
    var rows = el.querySelectorAll(".chip-editor .chip-row");
    var items = Array.prototype.map.call(rows, function (row) {
      return {
        label: (row.querySelector(".chip-edit-label").value || "").trim(),
        url: (row.querySelector(".chip-edit-url").value || "").trim(),
        description: (row.querySelector(".chip-edit-desc").value || "").trim()
      };
    }).filter(function (it) { return it.label.length; });
    var origItems = (Array.isArray(s.items) ? s.items : []).map(function (it) {
      var o = (it && typeof it === "object") ? it : { label: String(it || "") };
      return { label: o.label || "", url: o.url || "", description: o.description || "" };
    });
    if (JSON.stringify(items) !== JSON.stringify(origItems)) patch.items = items;

    return patch;
  }

  function postContent(payload) {
    payload = Object.assign({ key: storedEditKey() }, payload);
    return fetch("/api/portobello-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 401) {
        clearEditKey();
        throw new Error("401");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function reportSaveError(err) {
    if (err && err.message === "401") { window.alert("Chave incorreta."); return; }
    window.alert("Erro ao salvar. Tente novamente.");
  }

  function saveEdit() {
    var s = slides[index];
    var el = els[index];
    if (!s || !el) return;
    var patch = collectPatch(s, el);

    // grid: galeria de imagens (persiste a lista de URLs, se mudou)
    if (s.layout === "grid" && pendingGallery) {
      var origGal = Array.isArray(s.gallery) ? s.gallery : [];
      if (JSON.stringify(pendingGallery) !== JSON.stringify(origGal)) {
        patch.gallery = pendingGallery.slice();
      }
    }

    // remover imagem: volta ao placeholder (logo) — só se ainda não for o placeholder
    if (pendingImageRemove && s.image !== PLACEHOLDER_IMAGE) {
      patch.image = PLACEHOLDER_IMAGE;
    }

    // vídeo: link do YouTube (persiste se mudou)
    if (s.layout === "video" && pendingVideo != null && pendingVideo !== (s.video || "")) {
      patch.video = pendingVideo;
    }

    // media: { url, kind } (persiste se mudou)
    if (s.layout === "media" && pendingMedia != null) {
      var origMedia = (s.media && typeof s.media === "object") ? s.media : {};
      if (JSON.stringify(pendingMedia) !== JSON.stringify({ url: origMedia.url || "", kind: origMedia.kind || "" })) {
        patch.media = pendingMedia;
      }
    }

    var finish = function (imageUrl) {
      if (imageUrl) patch.image = imageUrl;
      if (Object.keys(patch).length === 0) { exitEdit(); return; }   // nada mudou
      postContent({ slideId: s.id, patch: patch })
        .then(function () {
          if (patch.title != null) s.title = patch.title;
          if (patch.subtitle != null) s.subtitle = patch.subtitle;
          if (patch.body != null) s.body = patch.body;
          if (patch.image != null) s.image = patch.image;
          if (patch.items != null) s.items = patch.items;
          if (patch.gallery != null) s.gallery = patch.gallery;
          if (patch.video != null) s.video = patch.video;
          if (patch.media != null) s.media = patch.media;
          exitEdit();
        })
        .catch(reportSaveError);
    };

    if (pendingImage) {
      postContent({ slideId: s.id, imageUpload: pendingImage })
        .then(function (j) { finish(j.imageUrl); })
        .catch(reportSaveError);
    } else {
      finish(null);
    }
  }

  function cancelEdit() { exitEdit(); }

  function exitEdit() {
    editing = false;
    pendingImage = null;
    pendingImageRemove = false;
    pendingGallery = null;
    pendingVideo = null;
    pendingMedia = null;
    deck.classList.remove("is-editing");
    if (editBar) editBar.hidden = true;
    rerenderCurrent();   // reconstrói o slide a partir do objeto (reaplica formatação)
    buildOverview();     // reflete nome/imagem editados na thumb do índice
  }

  function rerenderCurrent() {
    var i = index;
    if (!slides[i]) return;
    var fresh = buildSlide(slides[i], i);
    if (els[i] && els[i].parentNode) els[i].parentNode.replaceChild(fresh, els[i]);
    els[i] = fresh;
    go(i);
  }

  function wire() {
    if (btnIndex) btnIndex.addEventListener("click", function () { toggleOverview(); });
    if (btnPrev) btnPrev.addEventListener("click", prev);
    if (btnNext) btnNext.addEventListener("click", next);
    if (btnFull) btnFull.addEventListener("click", toggleFull);
    if (overviewClose) overviewClose.addEventListener("click", closeOverview);
    if (sigClose) sigClose.addEventListener("click", closeSignal);
    document.addEventListener("pointerdown", function (e) {
      if (!signalOpen()) return;
      if (!sigPanel || sigPanel.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".chip-btn")) return; // clique noutro chip troca o sinal
      closeSignal();
    });
    document.addEventListener("keydown", onKey);
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("hashchange", function () { if (ready) go(hashIndex(), true); });
    // qualquer atividade traz a barra de volta
    document.addEventListener("mousemove", poke, { passive: true });
    document.addEventListener("pointerdown", poke, { passive: true });
    document.addEventListener("touchstart", poke, { passive: true });
  }

  function buildDeck(data) {
    slides = (data && data.slides) || [];
    deckMeta = (data && data.meta) || null;
    fullAccess = !!storedEditKey();
    slides = slides.filter(function (s) {
      // hidden publicado (deletar pelo índice): some para todos
      return publishedHidden.indexOf(s.id) === -1;
    });
    // slides salvos com o placeholder antigo (logo Aerolito) migram pro atual
    slides.forEach(function (s) {
      if (s.image === LEGACY_PLACEHOLDER) s.image = PLACEHOLDER_IMAGE;
    });
    slides = applySavedOrder(slides);   // restaura ordem reordenada anteriormente
    els = slides.map(buildSlide);
    els.forEach(function (el) { stage.appendChild(el); });
    updateTerritoryNumbers();   // preenche os eyebrows "Território NN / 10"
    buildOverview();
    if (counterTot) counterTot.textContent = String(slides.length);
    wire();
    buildEditControls();
    loaded = true;
    maybeActivate();
  }

  // o listener vai no topo (síncrono): a capa pode disparar antes do fetch resolver
  document.addEventListener("enter-deck", requestEnter, { once: true });
  // com #login presente, o deck espera o "enter-deck" do fim da introdução do login;
  // sem login (dev/visão direta), ativa assim que os dados chegam.
  if (!document.getElementById("login")) entered = true;
  // ?edit=1: pede a chave sem teclado (útil no mobile); com chave já salva, só limpa o parâmetro
  try {
    if (new URLSearchParams(location.search).get("edit") === "1") {
      if (storedEditKey()) {
        history.replaceState(null, "", location.pathname + location.hash);
      } else {
        requestEditMode();
      }
    }
  } catch (_) {}

  // aplica o conteúdo publicado sobre os slides-base:
  // - overrides (texto/imagem/sinais) por id
  // - added: anexa slides novos ao fim (marcados como criados pelo editor)
  // - hidden: guarda ids ocultados publicados (filtrados em buildDeck)
  function applyContent(data, content) {
    if (!content || !data || !Array.isArray(data.slides)) return data;
    var overrides = content.overrides || {};
    // anexa os slides novos ANTES dos overrides, p/ que edições (nome/imagem/
    // corpo/sinais) de um território criado também sejam reaplicadas ao recarregar
    (content.added || []).forEach(function (s) {
      if (s && s.id) { s._added = true; data.slides.push(s); }
    });
    data.slides.forEach(function (s) {
      var o = overrides[s.id];
      if (!o) return;
      if (typeof o.title === "string") s.title = o.title;
      if (typeof o.layout === "string") s.layout = o.layout;
      if (typeof o.subtitle === "string") s.subtitle = o.subtitle;
      if (Array.isArray(o.body)) s.body = o.body;
      if (typeof o.image === "string") s.image = o.image;
      if (Array.isArray(o.items)) s.items = o.items;
      if (Array.isArray(o.gallery)) s.gallery = o.gallery;
      if (typeof o.video === "string") s.video = o.video;
      if (o.media && typeof o.media === "object") s.media = o.media;
    });
    publishedHidden = Array.isArray(content.hidden) ? content.hidden : [];
    return data;
  }

  // conteúdo do servidor; falha de rede / dev sem functions => null (usa a base)
  function loadContent() {
    return fetch("/api/portobello-content", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  Promise.all([
    fetch("slides.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }),
    loadContent()
  ])
    .then(function (arr) { onData(applyContent(arr[0], arr[1])); })
    .catch(function (err) {
      stage.innerHTML =
        '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
        'justify-content:center;color:var(--text-secondary);font-size:14px;padding:24px;' +
        'text-align:center">Não foi possível carregar os slides (slides.json).<br>' +
        esc(err.message) + "</div>";
      loaded = true;      // mesmo em erro, ativa para mostrar a mensagem
      maybeActivate();
      console.error("[deck] erro ao carregar slides.json:", err);
    });
})();
