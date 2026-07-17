/* ============================================================
   particles.js — fundo de partículas compartilhado
   (réplica do ParticleBackground da demo aerolito-login-entrada).
   UMA única simulação é renderizada em todos os canvas .particle-bg
   (o do login e o do índice), garantindo que o fundo seja contínuo —
   o mesmo campo de partículas atravessa a entrada login→índice.
   ============================================================ */
(function () {
  "use strict";

  var canvasList = document.querySelectorAll("canvas.particle-bg");
  if (!canvasList.length) return;

  var COLORS = ['#FC8DC4','#B74A95','#9A1985','#3C3AA0','#6753F9','#4141FF','#18A4FF','#67E7FC','#3AC7BA','#227869'];
  var COUNT = 420, SEED = 20260611;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rnd = mulberry32(SEED);
  var mouse = { x: -9999, y: -9999 };
  var balls = [], dpr = 1, W = 0, H = 0;

  function gauss(mean, sd) { var u1 = rnd() || 1e-9, u2 = rnd(); return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)*sd + mean; }

  function setSize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth * dpr; H = window.innerHeight * dpr;
  }
  function init() {
    balls = [];
    for (var i = 0; i < COUNT; i++) {
      balls.push({
        x: gauss(W/1.5, W/1.5), y: gauss(H/1.5, H/1.5), size: (0.9 + rnd()*1.8) * dpr,
        color: COLORS[Math.floor(rnd() * COLORS.length)],
        xs: (-0.1 + rnd()*0.2) * dpr, ys: (-0.1 + rnd()*0.2) * dpr
      });
    }
  }
  function sizeAll() {
    for (var i = 0; i < canvasList.length; i++) {
      var c = canvasList[i];
      c.width = W; c.height = H;
      c.style.width = window.innerWidth + "px"; c.style.height = window.innerHeight + "px";
    }
  }

  setSize(); init(); sizeAll();
  window.addEventListener("resize", function () { setSize(); init(); sizeAll(); });
  window.addEventListener("mousemove", function (e) { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });

  function step() {
    var m = 0.2 * dpr;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      b.x += b.xs; b.y += b.ys;
      b.xs += (-0.05 + rnd()*0.1) * dpr; b.ys += (-0.05 + rnd()*0.1) * dpr;
      b.xs = Math.max(-m, Math.min(m, b.xs)); b.ys = Math.max(-m, Math.min(m, b.ys));
      var dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.sqrt(dx*dx + dy*dy);
      if (d < 50*dpr) { var a = Math.atan2(dy, dx); var f = (1 - d/(100*dpr)) * dpr; b.xs += Math.cos(a)*f; b.ys += Math.sin(a)*f; }
      if (b.x < 0 || b.x > W) b.xs *= -1; if (b.y < 0 || b.y > H) b.ys *= -1;
    }
  }
  function render() {
    for (var j = 0; j < canvasList.length; j++) {
      var c = canvasList[j];
      if (!c.isConnected) continue; // ex.: #login removido após a entrada — ignora seu canvas
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); ctx.fillStyle = b.color; ctx.fill();
      }
    }
  }
  function loop() { step(); render(); requestAnimationFrame(loop); }
  loop();
})();
