// 音が鳴ったときのシンボルのハーフトーン（main3 の「円」の網点）
// 鳴った瞬間にシンボルが網点になり、網点の間隔が START_PITCH から 0 へ縮みながら格子が回って、元の形に戻る
// 網点はシンボルの色のまま（白い所は白、赤い所は赤）。濃い所は網点が重なってベタになる（main3 と同じ大きさの決め方）。数字は網点にしない
// 網点は WebGL で画素ごとに計算する。どれだけ細かくしても重さが変わらないので、最後まで縮め続けられ、
// 網点が画素より細かくなると元の形の絵と同じになる。そこで SVG に戻すので、継ぎ目は見えない
// WebGL2 が使えない環境では、網点を出さない

const Halftone = (() => {
  const START_PITCH = 4.5; // 網点の間隔の始まり（画面の px）
  const START_ANGLE = 45; // 格子の角度の始まり（°。main3 の初期値）
  const TURN = 90; // 元の形に戻るまでに回る角度（°）
  const BEATS = 2; // 元の形に戻るまでの長さ（拍）

  const svg = document.getElementById('symbol');
  const canvas = document.getElementById('halftone');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true });
  const noop = { burst() {}, stop() {} };
  if (!gl) return noop;

  // ---- 網点の計算（画素ごと） ----
  // 画素が入る格子のマスと、そのまわり 8 マスの円を調べる（濃い所は隣の円と重なるため）
  // マスの濃さと色は、元の形の絵を間隔ぶんぼかしたもの（ミップマップ）から引く
  // 間隔が 1〜2.5 画素になるあいだに、網点から元の形の絵へ少しずつ移る
  const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D src;   // 元の形の絵（色は乗算済み、色のある所の量を a に）
uniform sampler2D lut;   // 濃さ → 円の半径（格子の間隔 = 1、0.7071 で割って 0〜1 に）
uniform vec2 size;       // canvas の画素
uniform vec2 origin;     // シンボルの中心（canvas の画素、上から下へ）
uniform float pitch;     // 格子の間隔（画素）
uniform float angle;     // 格子の角度（ラジアン）
out vec4 color;
void main() {
  vec2 pix = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
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
      if (t.a < 0.02) continue;
      float r = texture(lut, vec2(t.a * (256.0 / 257.0) + 0.5 / 257.0, 0.5)).r * 0.70710678 * pitch;
      float cover = clamp(r - length(px - center) + 0.5, 0.0, 1.0);
      if (cover > best.a) best = vec4(t.rgb / t.a, cover);
    }
  }
  vec4 flat_ = textureLod(src, pix / size, 0.0);
  color = mix(flat_, vec4(best.rgb * best.a, best.a), smoothstep(1.0, 2.5, pitch));
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

  // 今のシンボル（数字は除く）を画面と同じ解像度で描いて、網点の元にする。黒い所は「色なし」にする
  // k = 1pt あたりの画素、(cx, cy) = シンボルの中心（画素）
  function upload(W, H, k, cx, cy) {
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const s = src.getContext('2d', { willReadFrequently: true });
    s.setTransform(k, 0, 0, k, cx, cy);
    SymbolView.paint(s);
    const img = s.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) <= 60) d[i + 3] = 0;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
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

  // ---- アニメーション ----

  let job = 0; // 新しく鳴ったら、前のアニメーションをやめる

  function stop() {
    job += 1;
    canvas.hidden = true;
    svg.classList.remove('halftoning');
  }

  // 鳴った瞬間に呼ぶ。beat = 1 拍の長さ（秒）
  function burst(beat) {
    const mine = ++job;
    // canvas はヘッダー全体に重ねる（左上が画面の画素の境目にそろうので、ブラウザが絵をぼかしたりずらしたりしない。
    // 端数の位置に置くと、SVG に戻る瞬間に縁が動いて見える）。描くのはシンボルのまわりだけ
    const box = svg.getBoundingClientRect();
    const header = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(header.width * dpr);
    const H = Math.round(header.height * dpr);
    canvas.width = W;
    canvas.height = H;
    const cx = (box.left + box.width / 2 - header.left) * dpr;
    const cy = (box.top + box.height / 2 - header.top) * dpr;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST);
    const x0 = Math.floor((box.left - header.left) * dpr);
    const y1 = Math.ceil((box.bottom - header.top) * dpr);
    gl.scissor(x0, H - y1, Math.ceil(box.width * dpr) + 1, Math.ceil(box.height * dpr) + 1);
    gl.uniform2f(at('size'), W, H);
    gl.uniform2f(at('origin'), cx, cy);
    upload(W, H, (box.width * dpr) / 1600, cx, cy); // SVG の viewBox は -800〜800
    canvas.hidden = false;
    svg.classList.add('halftoning');
    const t0 = performance.now();
    const duration = BEATS * beat * 1000;
    const frame = (now) => {
      if (mine !== job) return;
      const t = Math.min(1, (now - t0) / duration);
      const e = (1 - Math.cos(Math.PI * t)) / 2; // ゆっくり始まり、ゆっくり元の形へ
      // 間隔が 0.5 画素より細かくなったら、網点の絵は元の形と同じなので、SVG に戻す
      if (t >= 1 || START_PITCH * (1 - e) * dpr < 0.5) {
        stop();
        return;
      }
      draw(START_PITCH * (1 - e) * dpr, START_ANGLE + TURN * e);
      requestAnimationFrame(frame);
    };
    frame(t0); // 形を隠したのと同じ瞬間に、最初の網点を描く（1 コマ空くとちらつくので）
  }

  return { burst, stop };
})();
