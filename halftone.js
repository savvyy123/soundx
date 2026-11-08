// シンボルの網点（main3 の「円」の網点）
// ふだんのシンボルは、main3 のプリセット 10 と同じ網点（円・間隔 2pt・大きさ 1.07・角度 0°、
// 中心から離れるほど濃さを弱めるグラデーション 0.28／始まり 0.33・中心が濃い）。pt はシンボルの SVG の単位で、main3 のポスターと同じ
// 音が鳴った瞬間に網点が粗くなり（START_PITCH）、格子が回りながら、ふだんの網点へ戻る
// 網点の色はシンボルの色のまま（黒い所は黒、赤い所は赤）。白い所（白鍵の中と地）は紙なので網点にしない。数字は網点にしない
// 網点は WebGL で画素ごとに計算する。WebGL2 が使えない環境では、SVG のシンボルをそのまま見せる

const Halftone = (() => {
  // ふだんの網点（main3 のプリセット 10）。間隔は pt、角度は °
  const REST = { pitch: 2, size: 1.07, angle: 0, gradAmount: 0.28, gradStart: 0.33 };
  const GRAD_RADIUS = 658.86; // グラデーションの半径（pt。main3 と同じく、モチーフを囲む四角の半分）
  const START_PITCH = 4.5; // 鳴った瞬間の網点の間隔（画面の px）
  const TURN = 90; // ふだんの網点に戻るまでに回る角度（°）
  const BEATS = 2; // ふだんの網点に戻るまでの長さ（拍）
  const VIEW = 1600; // シンボルの SVG の viewBox の幅（pt）

  const svg = document.getElementById('symbol');
  const canvas = document.getElementById('halftone');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true });
  const noop = { burst() {}, stop() {} };
  if (!gl) return noop;

  // ---- 網点の計算（画素ごと） ----
  // 画素が入る格子のマスと、そのまわり 8 マスの円を調べる（濃い所は隣の円と重なるため）
  // マスの濃さと色は、シンボルの絵（色のある所の量を a に）を間隔ぶんぼかしたもの（ミップマップ）から引き、
  // 中心からの距離でグラデーションをかける（main3 と同じ）。1 画素を 4 か所で調べて平均する（網点が画素と同じくらい細かくても、面積どおりの濃さになるように）
  // 網点が画素の 0.35〜0.7 倍より細かいときは、網点の面積の割合（濃さ × 大きさ²）でそのまま塗る
  const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D src;   // シンボルの絵（色は乗算済み、色のある所の量を a に）
uniform sampler2D lut;   // 濃さ → 円の半径（格子の間隔 = 1、0.7071 で割って 0〜1 に）
uniform vec2 size;       // canvas の画素
uniform vec2 origin;     // シンボルの中心（canvas の画素、上から下へ）
uniform float pitch;     // 格子の間隔（画素）
uniform float angle;     // 格子の角度（ラジアン）
uniform float dotSize;   // 網点の大きさ（main3 の「大きさ」）
uniform vec3 grad;       // グラデーションの強さ、始まり、半径（画素）
out vec4 color;

float fade(float dist) { return 1.0 - grad.x * smoothstep(grad.y, 1.0, min(1.0, dist / grad.z)); }

vec4 dotsAt(vec2 pix) {
  vec2 px = pix - origin;
  float c = cos(angle), s = sin(angle);
  mat2 toGrid = mat2(c, -s, s, c);
  mat2 fromGrid = mat2(c, s, -s, c);
  vec2 base = floor(toGrid * px / pitch + 0.5);
  float lod = log2(max(pitch, 1.0));
  vec4 best = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 center = fromGrid * ((base + vec2(i, j)) * pitch);
      vec4 t = textureLod(src, (center + origin) / size, lod);
      if (t.a < 0.01) continue;
      float d = t.a * fade(length(center));
      float r = texture(lut, vec2(d * (256.0 / 257.0) + 0.5 / 257.0, 0.5)).r * 0.70710678 * pitch * dotSize;
      float cover = clamp((r - length(px - center)) * 2.0 + 0.5, 0.0, 1.0);
      if (cover > best.a) best = vec4(t.rgb / t.a, cover);
    }
  }
  return vec4(best.rgb * best.a, best.a);
}

void main() {
  vec2 pix = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec4 dots = 0.25 * (dotsAt(pix + vec2(-0.25, -0.25)) + dotsAt(pix + vec2(0.25, -0.25))
                    + dotsAt(pix + vec2(-0.25, 0.25)) + dotsAt(pix + vec2(0.25, 0.25)));
  vec4 flat_ = textureLod(src, pix / size, 0.0);
  flat_ *= min(fade(length(pix - origin)) * dotSize * dotSize, 1.0 / max(flat_.a, 1e-4));
  color = mix(flat_, dots, smoothstep(0.35, 0.7, pitch));
}`;

  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (e) {
    console.warn('網点を出せません', e);
    return noop;
  }
  gl.useProgram(program);
  const at = (name) => gl.getUniformLocation(program, name);

  // 画面いっぱいの四角
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // 円の網点の半径の表（格子 1 マスに占める色の割合が濃さ d と同じになる半径。main3 と同じ）
  // 隣と接する半径 0.5 では 79% までしか届かないので、濃い所は隣と重ねて、d = 1 で半径 1/√2（ベタ）にする
  const lutData = (() => {
    const cover = (r) => (r <= 0.5 ? Math.PI * r * r : Math.PI * r * r - 4 * (r * r * Math.acos(0.5 / r) - 0.5 * Math.sqrt(r * r - 0.25)));
    const steps = 2048;
    const out = new Uint8Array(257);
    let i = 0;
    for (let k = 0; k <= 256; k++) {
      while (i < steps && cover(((i + 1) / steps) * Math.SQRT1_2) < k / 256) i++;
      out[k] = Math.round((i / steps) * 255);
    }
    return out;
  })();
  const lutTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, lutTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 257, 1, 0, gl.RED, gl.UNSIGNED_BYTE, lutData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.uniform1i(at('lut'), 1);

  const srcTex = gl.createTexture();
  gl.uniform1i(at('src'), 0);
  const src = document.createElement('canvas');
  const sg = src.getContext('2d');

  // canvas をシンボルと同じ大きさ（画面の画素）にして、中心・グラデーションの半径を合わせる。k = 1pt あたりの画素
  function layout() {
    const box = svg.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(box.width * dpr);
    const H = Math.round(box.height * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const k = W / VIEW;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(at('size'), W, H);
    gl.uniform2f(at('origin'), W / 2, H / 2);
    gl.uniform1f(at('dotSize'), REST.size);
    gl.uniform3f(at('grad'), REST.gradAmount, REST.gradStart, GRAD_RADIUS * k);
    return { W, H, k, dpr };
  }

  // 今のシンボル（数字は除く）を画面と同じ解像度で描いて、網点の元にする（白い所は透明＝紙）
  function upload(W, H, k) {
    src.width = W;
    src.height = H;
    sg.setTransform(k, 0, 0, k, W / 2, H / 2);
    SymbolView.paint(sg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function draw(pitch, deg) {
    gl.uniform1f(at('pitch'), pitch);
    gl.uniform1f(at('angle'), (deg * Math.PI) / 180);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ---- ふだんの網点と、鳴ったときのアニメーション ----

  let job = 0; // 新しく鳴ったら、前のアニメーションをやめる
  let animating = false;

  // ふだんの網点を描く（シンボルが変わったとき・止めたとき・画面の大きさが変わったとき）
  function rest() {
    if (animating) return;
    const { W, H, k } = layout();
    upload(W, H, k);
    draw(REST.pitch * k, REST.angle);
  }

  function stop() {
    job += 1;
    animating = false;
    rest();
  }

  // 鳴った瞬間に呼ぶ。beat = 1 拍の長さ（秒）
  function burst(beat) {
    const mine = ++job;
    animating = true;
    const { W, H, k, dpr } = layout();
    upload(W, H, k);
    const from = START_PITCH * dpr;
    const to = REST.pitch * k;
    const t0 = performance.now();
    const duration = BEATS * beat * 1000;
    const frame = (now) => {
      if (mine !== job) return;
      const t = Math.min(1, (now - t0) / duration);
      const e = (1 - Math.cos(Math.PI * t)) / 2; // ゆっくり始まり、ゆっくりふだんの網点へ
      draw(from + (to - from) * e, REST.angle - TURN * (1 - e));
      if (t < 1) requestAnimationFrame(frame);
      else animating = false;
    };
    frame(t0); // 押したのと同じ瞬間に、最初の網点を描く（1 コマ空くとちらつくので）
  }

  // シンボルが変わったら（赤くなる・戻る）、ふだんの網点を描き直す。鳴ったとき（burst）はそちらで描くので何もしない
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      rest();
    });
  }).observe(svg, { subtree: true, childList: true, attributes: true, attributeFilter: ['d', 'class'] });
  window.addEventListener('resize', rest);

  // SVG の形は見えなくする（押せるように、消さずに透明にする）。数字は SVG のまま見せる
  svg.classList.add('halftoning');
  canvas.hidden = false;
  rest();

  return { burst, stop };
})();
