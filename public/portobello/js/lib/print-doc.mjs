/* ============================================================
   print-doc.mjs — construção pura do documento de impressão (PDF).
   Sem DOM: recebe os slides e devolve strings de HTML/CSS.
   Testável com `node --test`. No browser, expõe window.PrintDoc.
   (esc/fmtInline duplicam deck.js de propósito — ver plano, nota DRY.)
   ============================================================ */

export function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

export function fmtInline(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="stat-hl">$1</strong>')
    .replace(/\n/g, "<br>");
}

// imagem-placeholder (logo Aerolito) — igual ao deck.js. Território/hero sem
// imagem própria usam este PNG pequeno (262×240); marcamos com is-placeholder
// para o CSS não ampliá-lo além do nativo (senão fica "estourado").
export var PLACEHOLDER_IMAGE = "assets/logo-aero.png";

// marca Aerolito (PNG) — mesmo logo do canto dos slides e da capa ao vivo.
export function staticMarkIMG() {
  return '<img class="print-mark" src="assets/logo-aero.png" alt="" aria-hidden="true">';
}

// <img> de fundo da página; recebe is-placeholder quando é o logo (sem imagem
// própria), para o CSS renderizar contido/nítido em vez de esticado.
export function bgIMG(image) {
  var cls = "print-bg" + (image === PLACEHOLDER_IMAGE ? " is-placeholder" : "");
  return '<img class="' + cls + '" src="' + esc(image) + '" alt="">';
}

// um chip de sinal: vira link (<a>) quando tem url; senão, <span>.
export function chipHTML(item) {
  var label = (item && typeof item === "object") ? item.label : item;
  var url = (item && typeof item === "object") ? item.url : null;
  if (url) {
    return '<a class="print-chip" href="' + esc(url) + '" ' +
      'target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  }
  return '<span class="print-chip">' + esc(label) + '</span>';
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// parágrafos do corpo — mesmas regras de buildSlide (###, >, **, \n).
function bodyHTML(body) {
  var paras = Array.isArray(body) ? body : [body];
  return paras.map(function (p) {
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
}

// uma página de território.
export function territoryPageHTML(slide, num) {
  var chips = (slide.items || []).map(chipHTML).join("");
  return '<section class="print-page print-territory">' +
    staticMarkIMG() +
    bgIMG(slide.image) +
    '<div class="print-scrim"></div>' +
    '<div class="print-panel">' +
      '<p class="print-eyebrow">Território ' + pad2(num) + '</p>' +
      '<h2 class="print-title">' + esc(slide.title) + '</h2>' +
      '<div class="print-copy">' + bodyHTML(slide.body) + '</div>' +
      (chips ? '<div class="print-chips">' + chips + '</div>' : '') +
    '</div>' +
  '</section>';
}

// território = só o layout clássico com imagem (exclui intro, votação e os
// layouts-base novos, que têm s.layout definido).
export function territories(slides) {
  return slides.filter(function (s) {
    return s.type !== "intro" && s.type !== "vote" && s.image && !s.layout;
  });
}

// página de capa, a partir do slide de intro.
export function coverPageHTML(intro) {
  var title = intro && intro.title ? intro.title : "";
  var subtitle = intro && intro.eyebrow ? intro.eyebrow : "";
  return '<section class="print-page print-cover">' +
    '<div class="print-cover-inner">' +
      '<div class="print-cover-mark">' + staticMarkIMG() + '</div>' +
      '<div class="print-wordmark">Aeroli<span class="tld">.to</span></div>' +
      (title ? '<h1 class="print-cover-title">' + esc(title) + '</h1>' : '') +
      (subtitle ? '<p class="print-cover-sub">' + esc(subtitle) + '</p>' : '') +
    '</div>' +
  '</section>';
}

// clássico (com imagem, sem layout) = território de verdade (recebe número).
export function isTerritory(s) {
  return s.type !== "intro" && s.type !== "vote" && s.image && !s.layout;
}

// todos os slides que entram no PDF: tudo menos a capa (intro) e a votação.
export function contentSlides(slides) {
  return slides.filter(function (s) {
    return s.type !== "intro" && s.type !== "vote";
  });
}

// --- páginas dos layouts-base (renderização fiel de cada um) ---

// grade de referências: título + galeria de imagens.
export function gridPageHTML(slide) {
  var gallery = Array.isArray(slide.gallery) ? slide.gallery : [];
  var thumbs = gallery.map(function (url) {
    return '<div class="print-grid-thumb"><img src="' + esc(url) + '" alt=""></div>';
  }).join("");
  return '<section class="print-page print-grid">' +
    staticMarkIMG() +
    '<div class="print-grid-inner">' +
      '<h2 class="print-grid-title">' + esc(slide.title) + '</h2>' +
      (thumbs ? '<div class="print-grid-gallery">' + thumbs + '</div>' : '') +
    '</div>' +
  '</section>';
}

// marca (wordmark): nome grande + linha + tagline.
export function brandPageHTML(slide) {
  return '<section class="print-page print-brand">' +
    staticMarkIMG() +
    '<div class="print-brand-inner">' +
      '<h2 class="print-brand-title">' + esc(slide.title) + '</h2>' +
      (slide.subtitle ? '<p class="print-brand-sub">' + esc(slide.subtitle) + '</p>' : '') +
    '</div>' +
  '</section>';
}

// imagem em destaque: foto full-bleed + legenda ao pé.
export function heroPageHTML(slide) {
  var body = Array.isArray(slide.body) ? slide.body.filter(function (p) { return p; }) : [];
  return '<section class="print-page print-hero">' +
    staticMarkIMG() +
    bgIMG(slide.image) +
    '<div class="print-hero-caption">' +
      '<h2 class="print-title">' + esc(slide.title) + '</h2>' +
      (slide.subtitle ? '<p class="print-hero-sub">' + esc(slide.subtitle) + '</p>' : '') +
      (body.length ? '<div class="print-copy">' + bodyHTML(body) + '</div>' : '') +
    '</div>' +
  '</section>';
}

// frase-manifesto: texto grande centralizado.
export function manifestoPageHTML(slide) {
  return '<section class="print-page print-manifesto">' +
    staticMarkIMG() +
    '<div class="print-manifesto-inner">' +
      '<h2 class="print-manifesto-title">' + fmtInline(esc(slide.title)) + '</h2>' +
      (slide.subtitle ? '<p class="print-manifesto-sub">' + esc(slide.subtitle) + '</p>' : '') +
    '</div>' +
  '</section>';
}

// normaliza o link do YouTube para uma URL de "watch" (aceita id cru).
export function youtubeWatchUrl(video) {
  if (!video) return "";
  video = String(video).trim();
  if (/^[\w-]{11}$/.test(video)) return "https://www.youtube.com/watch?v=" + video;
  return video;
}

// vídeo: não dá pra tocar em PDF — mostra título + link clicável do YouTube.
export function videoPageHTML(slide) {
  var url = youtubeWatchUrl(slide.video);
  return '<section class="print-page print-video">' +
    staticMarkIMG() +
    '<div class="print-video-inner">' +
      (slide.title ? '<h2 class="print-title">' + esc(slide.title) + '</h2>' : '') +
      '<div class="print-video-box">' +
        '<span class="print-video-badge">▶ YouTube</span>' +
        (url
          ? '<a class="print-video-link" href="' + esc(url) + '">' + esc(url) + '</a>'
          : '<span class="print-video-empty">Vídeo não configurado</span>') +
      '</div>' +
    '</div>' +
  '</section>';
}

// deduz o tipo da mídia por extensão da URL (.mp4 → vídeo; resto → imagem).
export function mediaKind(url) {
  return /\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(String(url || "")) ? "video" : "image";
}

// aceita só http(s) ou caminho relativo (upload) — barra javascript:/data: etc.
export function safeMediaUrl(url) {
  url = String(url || "").trim();
  return (/^https?:\/\//i.test(url) || url.charAt(0) === "/") ? url : "";
}

// media (GIF/MP4): não anima em PDF — mostra título + selo + link, se houver URL.
export function mediaPageHTML(slide) {
  var url = safeMediaUrl(slide.media && slide.media.url);
  return '<section class="print-page print-media">' +
    staticMarkIMG() +
    '<div class="print-media-inner">' +
      (slide.title ? '<h2 class="print-title">' + esc(slide.title) + '</h2>' : '') +
      '<div class="print-media-box">' +
        '<span class="print-media-badge">▶ GIF / Vídeo</span>' +
        (url
          ? '<a class="print-media-link" href="' + esc(url) + '">' + esc(url) + '</a>'
          : '<span class="print-media-empty">Mídia não configurada</span>') +
      '</div>' +
    '</div>' +
  '</section>';
}

// escolhe a página conforme o layout (território clássico recebe o número).
export function slidePageHTML(slide, territoryNum) {
  switch (slide.layout) {
    case "grid":      return gridPageHTML(slide);
    case "wordmark":  return brandPageHTML(slide);
    case "hero":      return heroPageHTML(slide);
    case "manifesto": return manifestoPageHTML(slide);
    case "video":     return videoPageHTML(slide);
    case "media":     return mediaPageHTML(slide);
    default:          return territoryPageHTML(slide, territoryNum);
  }
}

// documento completo: capa + TODOS os slides de conteúdo (cada layout com sua
// página). opts.orientation: "landscape" | "portrait". opts.ids (opcional):
// restringe por id; ausente = todos. Só o layout clássico recebe número de
// território, contado só entre os territórios (igual ao deck).
export function buildPrintDocHTML(slides, opts) {
  var orientation = (opts && opts.orientation) === "portrait" ? "portrait" : "landscape";
  var ids = opts && opts.ids;
  var intro = slides.find(function (s) { return s.type === "intro"; });
  var content = contentSlides(slides).filter(function (s) {
    return !ids || ids.indexOf(s.id) !== -1;
  });
  var terrNum = 0;
  var pages = content.map(function (s) {
    return slidePageHTML(s, isTerritory(s) ? ++terrNum : 0);
  }).join("");
  return '<div id="print-root" class="is-' + orientation + '">' + coverPageHTML(intro) + pages + '</div>';
}

// regra @page injetada no print (orientação dinâmica — @page não muda por classe).
// Página 16:9 widescreen (13.333in × 7.5in, o padrão de apresentação) em vez de
// A4 — o A4 landscape (~1.41:1) deixava o PDF com cara "quadrada". portrait = o
// mesmo formato em pé (9:16).
export function pageRuleCSS(orientation) {
  var size = orientation === "portrait" ? "7.5in 13.333in" : "13.333in 7.5in";
  return "@page { size: " + size + "; margin: 0; }";
}

// browser: expõe a API sem quebrar o uso como módulo ES nos testes.
if (typeof window !== "undefined") {
  window.PrintDoc = {
    buildPrintDocHTML: buildPrintDocHTML,
    pageRuleCSS: pageRuleCSS
  };
}
