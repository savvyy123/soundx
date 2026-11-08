// シンボル（12 本の扇形）を SVG で描く。真上が C で、時計回りに 30° ずつ半音が並ぶ（仕様書 3.2）
// 形は assets/sound_BlackObject.svg と同じ（幅 15°、白鍵は長さ 681.7、黒鍵は 465.2、同心円 5 本）。単位は SVG の pt
// 色は白い地に合わせて、main3 の白版（sound_white.svg）と同じ塗り分け：白鍵は白に黒い縁、同心円は黒（白鍵の上にも見える）、黒鍵は黒ベタ
// show(構成音) で、構成音の扇形を赤くし、外側にオクターブ値を出す（参考画像どおり）
// 赤い扇形か数字を押すと、onTap で渡した関数を（音名, 数字の要素）で呼ぶ。赤くない扇形は押しても何も起きない

const SymbolView = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const LONG = 681.7; // 白鍵の長さ
  const SHORT = 465.2; // 黒鍵の長さ
  const HALF = 7.5; // 扇形の幅の半分（°）
  const RINGS = [57.81, 97.85, 160.19, 226.73, 298.43];
  const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
  // オクターブ値の数字：扇形の先端からの距離と、数字の高さ（参考画像で、数字の中心は白鍵の長さの 1.092 倍＝先端から 0.092 倍、高さは 0.066 倍）
  const LABEL_GAP = LONG * 0.092;
  const LABEL_SIZE = 60; // Futura の数字の高さは 0.754 em なので、高さ 45
  const DIGIT_HEIGHT = 0.754 * LABEL_SIZE;

  const svg = document.getElementById('symbol');
  const add = (parent, tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent.append(el);
    return el;
  };
  const point = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  };
  const wedge = (pitch, r) => {
    const [x0, y0] = point(r, pitch * 30 - HALF);
    const [x1, y1] = point(r, pitch * 30 + HALF);
    return `M0 0L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z`;
  };

  // 重ね順（sound_BlackObject.svg・main3 の白版と同じ）：白鍵（白の塗り＋黒い縁）→ 同心円 → 黒鍵（黒ベタ）
  // 赤い扇形の上にだけ、同心円をもう一度重ねる（赤い所だけ切り抜いて）。数字はいちばん上
  const defs = add(svg, 'defs');
  const redArea = add(defs, 'clipPath', { id: 'symbol-red-area' });
  // 形の層（class="shape"）は、網点を出している間（ふだんはずっと）halftone.js が透明にする（押せるように残す）。数字の層は隠さない
  const whiteLayer = add(svg, 'g', { class: 'shape' });
  const ringLayer = add(svg, 'g', { class: 'shape' });
  const blackLayer = add(svg, 'g', { class: 'shape' });
  const redRingLayer = add(svg, 'g', { class: 'shape', 'clip-path': 'url(#symbol-red-area)' });
  const labelLayer = add(svg, 'g');

  for (const layer of [ringLayer, redRingLayer]) {
    for (const r of RINGS) add(layer, 'circle', { class: 'ring', r });
  }

  let tapHandler = null;
  const labels = new Map(); // 音名 → 数字の要素

  const keys = Array.from({ length: 12 }, (_, pitch) => {
    const black = BLACK_KEYS.has(pitch);
    const path = add(black ? blackLayer : whiteLayer, 'path', { class: black ? 'black' : 'white', 'data-pitch': pitch });
    path.addEventListener('click', () => {
      if (path.classList.contains('on')) tapHandler?.(pitch, labels.get(pitch));
    });
    return { path, black };
  });

  const octaveText = (o) => (o > 0 ? `+${o}` : o < 0 ? `−${-o}` : '0');

  // notes = [{ pitch: 0〜11, octave }]。空の配列で、ふつうの見た目に戻る
  // 赤くなっても扇形の大きさは変えない（黒鍵は短いまま）。数字は、それぞれの先端から同じ距離に出す
  function show(notes) {
    const on = new Map(notes.map((n) => [n.pitch, n.octave]));
    redArea.replaceChildren();
    labelLayer.replaceChildren();
    labels.clear();
    keys.forEach(({ path, black }, pitch) => {
      const lit = on.has(pitch);
      const length = black ? SHORT : LONG;
      const d = wedge(pitch, length);
      path.setAttribute('d', d);
      path.classList.toggle('on', lit);
      if (!lit) return;
      add(redArea, 'path', { d });
      const [x, y] = point(length + LABEL_GAP, pitch * 30);
      const label = add(labelLayer, 'text', { class: 'label', x, y: y + DIGIT_HEIGHT / 2 });
      label.textContent = octaveText(on.get(pitch));
      label.addEventListener('click', () => tapHandler?.(pitch, label));
      labels.set(pitch, label);
    });
  }

  // 今の形（数字は除く）を canvas に描く。g は、中心が原点・単位が SVG の pt になるように座標を合わせてから渡す
  // ハーフトーンの下絵に使う（見た目は SVG と同じ重ね順・色）。白い所（白鍵の中）は紙なので、透明のまま残す
  function paint(g) {
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
    const rings = () => {
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      for (const r of RINGS) {
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.stroke();
      }
    };
    const redArea = new Path2D();
    g.save();
    g.lineJoin = 'miter';
    g.miterLimit = 10;
    // 白鍵：黒い縁（線 6 の外側の半分）。中は紙なので、縁の内側の半分ごと消す。赤いときは縁なしの赤
    for (const { path, black } of keys) {
      if (black) continue;
      const shape = new Path2D(path.getAttribute('d'));
      if (path.classList.contains('on')) {
        g.fillStyle = red;
        g.fill(shape);
        continue;
      }
      g.lineWidth = 6;
      g.strokeStyle = '#000';
      g.stroke(shape);
      g.globalCompositeOperation = 'destination-out';
      g.fill(shape);
      g.globalCompositeOperation = 'source-over';
    }
    rings();
    for (const { path, black } of keys) {
      const shape = new Path2D(path.getAttribute('d'));
      if (path.classList.contains('on')) redArea.addPath(shape);
      if (!black) continue;
      g.fillStyle = path.classList.contains('on') ? red : '#000';
      g.fill(shape);
    }
    g.clip(redArea);
    rings();
    g.restore();
  }

  show([]);
  return {
    show,
    paint,
    onTap: (fn) => {
      tapHandler = fn;
    },
  };
})();
