/* ============================================================
   starfield.js — partículas/estrelas (design.md §2.3 / §8)
   Fábrica reutilizável: anima um <canvas> com pontinhos brancos +
   acentos violeta/rosa/ciano, cintilação lenta e halo suave nas
   estrelas maiores. Respeita prefers-reduced-motion (estático).
   Instâncias:
     • #starfield  — atmosfera global (densidade baixa)
     • #cover-stars — fundo da capa (mais denso/brilhante)
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // branco domina; acentos do design.md aparecem aqui e ali
  var COLORS = [
    "255,255,255", "255,255,255", "255,255,255", "255,255,255",
    "108,92,231",  // violeta
    "244,83,138",  // rosa
    "92,225,230"   // ciano
  ];

  function vw() { return (window.visualViewport && window.visualViewport.width) || window.innerWidth; }
  function vh() { return (window.visualViewport && window.visualViewport.height) || window.innerHeight; }

  function createField(canvas, cfg) {
    var ctx = canvas.getContext("2d");
    var field = [];
    var raf = null;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = vw(), h = vh();
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.min(cfg.maxCount, Math.round((w * h) / cfg.divisor));
      field = [];
      for (var i = 0; i < count; i++) {
        field.push({
          x: Math.random() * w,
          y: Math.random() * h,
          // maioria pequena, poucas maiores (curva exponencial)
          r: Math.pow(Math.random(), 1.7) * cfg.rMax + 0.45,
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
          base: cfg.baseMin + Math.random() * cfg.baseSpan,
          phase: Math.random() * Math.PI * 2,
          speed: 0.25 + Math.random() * 0.6,
          halo: Math.random() < cfg.halo
        });
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, vw(), vh());
      for (var i = 0; i < field.length; i++) {
        var s = field[i];
        var tw = reduceMotion ? 0.85 : (0.55 + 0.45 * Math.sin(now / 1000 * s.speed + s.phase));
        var a = s.base * tw;
        if (s.halo) {
          ctx.fillStyle = "rgba(" + s.c + "," + (a * 0.16).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(" + s.c + "," + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }

    function onResize() {
      size();
      if (reduceMotion) draw(performance.now());
    }

    window.addEventListener("resize", onResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", function () { setTimeout(onResize, 300); });

    size();
    if (reduceMotion) draw(performance.now());
    else raf = requestAnimationFrame(draw);
  }

  var globalCanvas = document.getElementById("starfield");
  if (globalCanvas) {
    createField(globalCanvas, {
      divisor: 26000, maxCount: 90, rMax: 1.2,
      baseMin: 0.10, baseSpan: 0.25, halo: 0
    });
  }

  var coverCanvas = document.getElementById("cover-stars");
  if (coverCanvas) {
    createField(coverCanvas, {
      divisor: 14000, maxCount: 190, rMax: 1.8,
      baseMin: 0.16, baseSpan: 0.5, halo: 0.22
    });
  }
})();
