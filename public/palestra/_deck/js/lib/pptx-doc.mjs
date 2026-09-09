/* ============================================================
   pptx-doc.mjs — lógica pura da exportação PPTX (sem DOM).
   Seleção de slides, nome de arquivo e dimensões. Testável com node --test.
   No browser, expõe window.PptxDoc. A rasterização (html-to-image) e a
   montagem do .pptx (PptxGenJS) vivem no deck.js (exportPPTX), pois dependem
   de buildSlide(), que é fechado no closure do deck.
   ============================================================ */

// slides que entram no PPTX: exclui intro e votação; mantém só os visíveis ao
// cliente (regra injetada de deck.js); remove os ocultados publicados; preserva
// a ordem recebida.
export function selectPptxSlides(slides, isClientVisible, publishedHidden) {
  var hidden = Array.isArray(publishedHidden) ? publishedHidden : [];
  var visible = typeof isClientVisible === "function" ? isClientVisible : function () { return true; };
  return (Array.isArray(slides) ? slides : []).filter(function (s) {
    if (!s) return false;
    if (s.type === "intro" || s.type === "vote") return false;
    if (!visible(s)) return false;
    if (hidden.indexOf(s.id) !== -1) return false;
    return true;
  });
}

// AAAA-MM-DD em horário local
function isoDate(date) {
  var d = date || new Date();
  var p = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// slug seguro para nome de arquivo
function slug(str) {
  return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// nome do .pptx: <deck>-slides-AAAA-MM-DD.pptx
export function pptxFileName(meta, date) {
  var base = slug((meta && (meta.deck || meta.title)) || "portobello") || "portobello";
  return base + "-slides-" + isoDate(date) + ".pptx";
}

export const PPTX_DIMS = { w: 1920, h: 1080 };                         // px de captura
export const PPTX_LAYOUT = { name: "WIDE_16x9", width: 13.333, height: 7.5 }; // polegadas

// browser: expõe a API sem quebrar o uso como módulo ES nos testes.
if (typeof window !== "undefined") {
  window.PptxDoc = {
    selectPptxSlides: selectPptxSlides,
    pptxFileName: pptxFileName,
    PPTX_DIMS: PPTX_DIMS,
    PPTX_LAYOUT: PPTX_LAYOUT
  };
}
