// 音が鳴ったときのシンボルのハーフトーン（main3 の「円」の網点）
// 鳴った瞬間にシンボルが網点になり、網点の間隔が START_PITCH から 0 へ縮みながら格子が回って、元の形に戻る
// 網点はシンボルの色のまま（白い所は白、赤い所は赤）。濃い所は網点が重なってベタになる（main3 と同じ大きさの決め方）
// 数字は網点にしない

const Halftone = (() => {
  const START_PITCH = 4.5; // 網点の間隔の始まり（画面の px）
  const START_ANGLE = 45; // 格子の角度の始まり（°。main3 の初期値）
  const TURN = 90; // 元の形に戻るまでに回る角度（°）
  const BEATS = 2; // 元の形に戻るまでの長さ（拍）
  // 間隔がこれより細かくなったら、網点は描き直さずに止め、下から元の形を浮かび上がらせる（細かすぎる網点は重いので）
  const FADE_FROM = 1.5;

  const svg = document.getElementById('symbol');
  const canvas = document.getElementById('halftone');
  const g = canvas.getContext('2d');
  let job = 0; // 新しく鳴ったら、前のアニメーションをやめる

  // 円の網点の半径（格子の間隔 = 1）。格子 1 マスに占める色の割合が濃さ d と同じになるように表から引く（main3 と同じ）
  // 隣と接する半径 0.5 では 79% までしか届かないので、濃い所は隣と重ねて、d = 1 で半径 1/√2（ベタ）にする
  const CIRCLE_LUT = (() => {
    const cover = (r) => (r <= 0.5 ? Math.PI * r * r : Math.PI * r * r - 4 * (r * r * Math.acos(0.5 / r) - 0.5 * Math.sqrt(r * r - 0.25)));
    const steps = 2048;
    const lut = new Float32Array(257);
    let i = 0;
    for (let k = 0; k <= 256; k++) {
      while (i < steps && cover(((i + 1) / steps) * Math.SQRT1_2) < k / 256) i++;
      lut[k] = (i / steps) * Math.SQRT1_2;
    }
    return lut;
  })();
  const circleRadius = (d) => CIRCLE_LUT[Math.round(Math.min(1, Math.max(0, d)) * 256)];

  // 今のシンボルを画面と同じ解像度で描き、色のある所（白・赤）の量を足し合わせた表（積分画像）を作る
  // 網点 1 つぶんの四角の中の平均の濃さを、すぐに引けるようにするため
  function sample(W, H) {
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const s = src.getContext('2d', { willReadFrequently: true });
    const k = W / 1600; // SVG の viewBox は -800〜800
    s.setTransform(k, 0, 0, k, W / 2, H / 2);
    SymbolView.paint(s);
    const data = s.getImageData(0, 0, W, H).data;
    const ink = new Float32Array((W + 1) * (H + 1));
    const red = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let rowInk = 0;
      let rowRed = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const v = Math.max(data[i], data[i + 1], data[i + 2]) > 60 ? data[i + 3] / 255 : 0; // 黒は色なし
        rowInk += v;
        rowRed += data[i] > 150 && data[i + 1] < 100 ? v : 0;
        const o = (y + 1) * (W + 1) + x + 1;
        ink[o] = ink[o - W - 1] + rowInk;
        red[o] = red[o - W - 1] + rowRed;
      }
    }
    const sum = (t, x0, y0, x1, y1) => t[y1 * (W + 1) + x1] - t[y0 * (W + 1) + x1] - t[y1 * (W + 1) + x0] + t[y0 * (W + 1) + x0];
    return { ink: (...b) => sum(ink, ...b), red: (...b) => sum(red, ...b) };
  }

  // 格子の間隔 p（端末の画素）、角度 deg で網点を描く。格子はシンボルの中心を原点にして回す
  function draw(table, W, H, p, deg, red) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const a = (deg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const n = Math.ceil(Math.hypot(W, H) / 2 / p) + 1;
    const clampX = (v) => Math.max(0, Math.min(W, Math.round(v)));
    const clampY = (v) => Math.max(0, Math.min(H, Math.round(v)));
    for (let j = -n; j <= n; j++) {
      const whites = new Path2D();
      const reds = new Path2D();
      for (let i = -n; i <= n; i++) {
        const x = W / 2 + (i * ca - j * sa) * p;
        const y = H / 2 + (i * sa + j * ca) * p;
        if (x < -p || y < -p || x > W + p || y > H + p) continue;
        const x0 = clampX(x - p / 2);
        const x1 = clampX(x + p / 2);
        const y0 = clampY(y - p / 2);
        const y1 = clampY(y + p / 2);
        const area = (x1 - x0) * (y1 - y0);
        if (!area) continue;
        const ink = table.ink(x0, y0, x1, y1);
        const d = ink / area;
        if (d < 0.02) continue;
        const r = p * circleRadius(d);
        const path = table.red(x0, y0, x1, y1) > ink / 2 ? reds : whites;
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, Math.PI * 2);
      }
      g.fillStyle = '#fff';
      g.fill(whites);
      g.fillStyle = red;
      g.fill(reds);
    }
  }

  function setShapeOpacity(v) {
    svg.style.setProperty('--shape-opacity', v);
  }

  function stop() {
    job += 1;
    canvas.hidden = true;
    setShapeOpacity(1);
  }

  // 鳴った瞬間に呼ぶ。beat = 1 拍の長さ（秒）
  function burst(beat) {
    const mine = ++job;
    const box = svg.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(box.width * dpr);
    const H = Math.round(box.height * dpr);
    canvas.width = W;
    canvas.height = H;
    const table = sample(W, H);
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
    const t0 = performance.now();
    const duration = BEATS * beat * 1000;
    canvas.hidden = false;
    setShapeOpacity(0);
    const frame = (now) => {
      if (mine !== job) return;
      const t = Math.min(1, (now - t0) / duration);
      const e = (1 - Math.cos(Math.PI * t)) / 2; // ゆっくり始まり、ゆっくり元の形へ（網点が見える時間を長めに）
      const pitch = START_PITCH * (1 - e);
      if (pitch >= FADE_FROM) {
        draw(table, W, H, pitch * dpr, START_ANGLE + TURN * e, red);
      } else {
        setShapeOpacity(1 - pitch / FADE_FROM);
      }
      if (t < 1) requestAnimationFrame(frame);
      else stop();
    };
    frame(t0); // 形を隠したのと同じ瞬間に、最初の網点を描く（1 コマ空くとちらつくので）
  }

  return { burst, stop };
})();
