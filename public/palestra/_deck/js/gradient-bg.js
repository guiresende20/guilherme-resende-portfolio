/* ============================================================
   gradient-bg.js — fundo animado do slide de abertura
   Port vanilla do componente React <AnimatedGradient> (WebGL2,
   shader de gradiente com distorção + swirl). Preset "Aurora"
   com a paleta trocada para tons de verde do portfólio.
   Renderiza no <canvas id="index-gradient">; só desenha enquanto
   body.on-intro (o canvas fica invisível fora da capa).
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("index-gradient");
  if (!canvas) return;

  // preset Aurora do componente original, cores verdes no lugar das roxas
  var PARAMS = {
    color1: [0x02 / 255, 0x12 / 255, 0x0a / 255, 1],   // preto-esverdeado
    color2: [0x0b / 255, 0x2e / 255, 0x1c / 255, 1],   // verde escuro
    color3: [0x00 / 255, 0x8f / 255, 0x48 / 255, 1],   // verde médio (era #00ff80, escurecido p/ contraste)
    rotation: -45,
    proportion: 60,
    scale: 0.6,
    speed: 15,
    distortion: 40,
    swirl: 80,
    swirlIterations: 10,
    softness: 100,
    offset: 200,
    shape: 2,        // "Edge"
    shapeSize: 50
  };

  var VERTEX_SHADER =
    "#version 300 es\n" +
    "in vec4 a_position;\n" +
    "void main() { gl_Position = a_position; }";

  var FRAGMENT_SHADER =
    "#version 300 es\n" +
    "precision highp float;\n" +
    "uniform float u_time;\n" +
    "uniform float u_pixelRatio;\n" +
    "uniform vec2 u_resolution;\n" +
    "uniform float u_scale;\n" +
    "uniform float u_rotation;\n" +
    "uniform vec4 u_color1;\n" +
    "uniform vec4 u_color2;\n" +
    "uniform vec4 u_color3;\n" +
    "uniform float u_proportion;\n" +
    "uniform float u_softness;\n" +
    "uniform float u_shape;\n" +
    "uniform float u_shapeScale;\n" +
    "uniform float u_distortion;\n" +
    "uniform float u_swirl;\n" +
    "uniform float u_swirlIterations;\n" +
    "out vec4 fragColor;\n" +
    "#define TWO_PI 6.28318530718\n" +
    "#define PI 3.14159265358979323846\n" +
    "vec2 rotate(vec2 uv, float th) {\n" +
    "  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;\n" +
    "}\n" +
    "float random(vec2 st) {\n" +
    "  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);\n" +
    "}\n" +
    "float noise(vec2 st) {\n" +
    "  vec2 i = floor(st);\n" +
    "  vec2 f = fract(st);\n" +
    "  float a = random(i);\n" +
    "  float b = random(i + vec2(1.0, 0.0));\n" +
    "  float c = random(i + vec2(0.0, 1.0));\n" +
    "  float d = random(i + vec2(1.0, 1.0));\n" +
    "  vec2 u = f * f * (3.0 - 2.0 * f);\n" +
    "  float x1 = mix(a, b, u.x);\n" +
    "  float x2 = mix(c, d, u.x);\n" +
    "  return mix(x1, x2, u.y);\n" +
    "}\n" +
    "vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {\n" +
    "  vec3 color1 = c1.rgb * c1.a;\n" +
    "  vec3 color2 = c2.rgb * c2.a;\n" +
    "  vec3 color3 = c3.rgb * c3.a;\n" +
    "  float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);\n" +
    "  float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);\n" +
    "  vec3 blended_color_2 = mix(color1, color2, r1);\n" +
    "  float blended_opacity_2 = mix(c1.a, c2.a, r1);\n" +
    "  vec3 c = mix(blended_color_2, color3, r2);\n" +
    "  float o = mix(blended_opacity_2, c3.a, r2);\n" +
    "  return vec4(c, o);\n" +
    "}\n" +
    "void main() {\n" +
    "  vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n" +
    "  float t = .5 * u_time;\n" +
    "  float noise_scale = .0005 + .006 * u_scale;\n" +
    "  uv -= .5;\n" +
    "  uv *= (noise_scale * u_resolution);\n" +
    "  uv = rotate(uv, u_rotation * .5 * PI);\n" +
    "  uv /= u_pixelRatio;\n" +
    "  uv += .5;\n" +
    "  float n1 = noise(uv * 1. + t);\n" +
    "  float n2 = noise(uv * 2. - t);\n" +
    "  float angle = n1 * TWO_PI;\n" +
    "  uv.x += 4. * u_distortion * n2 * cos(angle);\n" +
    "  uv.y += 4. * u_distortion * n2 * sin(angle);\n" +
    "  float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));\n" +
    "  for (float i = 1.; i <= iterations_number; i++) {\n" +
    "    uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);\n" +
    "    uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);\n" +
    "  }\n" +
    "  float proportion = clamp(u_proportion, 0., 1.);\n" +
    "  float shape = 0.;\n" +
    "  float mixer = 0.;\n" +
    "  if (u_shape < .5) {\n" +
    "    vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);\n" +
    "    shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);\n" +
    "    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);\n" +
    "  } else if (u_shape < 1.5) {\n" +
    "    vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);\n" +
    "    float f = fract(stripes_shape_uv.y);\n" +
    "    shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);\n" +
    "    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);\n" +
    "  } else {\n" +
    "    float sh = 1. - uv.y;\n" +
    "    sh -= .5;\n" +
    "    sh /= (noise_scale * u_resolution.y);\n" +
    "    sh += .5;\n" +
    "    float shape_scaling = .2 * (1. - u_shapeScale);\n" +
    "    shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));\n" +
    "    mixer = shape;\n" +
    "  }\n" +
    "  vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);\n" +
    "  fragColor = vec4(color_mix.rgb, color_mix.a);\n" +
    "}";

  var gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) return;   // sem WebGL2: canvas fica transparente sobre o fundo preto

  function compile(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["u_time", "u_resolution", "u_pixelRatio", "u_scale", "u_rotation",
   "u_color1", "u_color2", "u_color3", "u_proportion", "u_softness",
   "u_shape", "u_shapeScale", "u_distortion", "u_swirl", "u_swirlIterations"
  ].forEach(function (name) { U[name] = gl.getUniformLocation(program, name); });

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  // uniforms fixos (o preset não muda em runtime)
  gl.uniform1f(U.u_scale, PARAMS.scale);
  gl.uniform1f(U.u_rotation, PARAMS.rotation * Math.PI / 180);
  gl.uniform4fv(U.u_color1, PARAMS.color1);
  gl.uniform4fv(U.u_color2, PARAMS.color2);
  gl.uniform4fv(U.u_color3, PARAMS.color3);
  gl.uniform1f(U.u_proportion, PARAMS.proportion / 100);
  gl.uniform1f(U.u_softness, PARAMS.softness / 100);
  gl.uniform1f(U.u_shape, PARAMS.shape);
  gl.uniform1f(U.u_shapeScale, PARAMS.shapeSize / 100);
  gl.uniform1f(U.u_distortion, PARAMS.distortion / 50);
  gl.uniform1f(U.u_swirl, PARAMS.swirl / 100);
  gl.uniform1f(U.u_swirlIterations, PARAMS.swirl === 0 ? 0 : PARAMS.swirlIterations);

  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var start = performance.now();

  function draw(now) {
    var elapsed = (now - start) / 1000;
    var speed = (PARAMS.speed / 100) * 5;
    gl.uniform1f(U.u_time, elapsed * speed + PARAMS.offset * 0.01);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(U.u_pixelRatio, window.devicePixelRatio || 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  if (reducedMotion) {
    draw(start);   // um frame estático
    return;
  }

  function loop(now) {
    // o canvas é visível na capa (on-intro) e nos slides "background1"
    // (on-gradient) — fora deles, não desenha p/ poupar GPU
    var b = document.body.classList;
    if (b.contains("on-intro") || b.contains("on-gradient")) draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
