// ピアノの音源（Salamander Grand Piano by Alexander Holm）
// 録音は 3 鍵ごと（A0〜C8 の 30 音）。その間の音は、いちばん近い録音の高さを変えて鳴らす
// 音源を差し替えるときは、sampleUrl と SAMPLES（録音してある音の MIDI 番号とファイル名）だけを変える

const Piano = (() => {
  const sampleUrl = (name) => `assets/piano/${name}.mp3`;

  // A0（MIDI 21）から C8（MIDI 108）まで、C・D#・F#・A の録音
  const SAMPLES = (() => {
    const list = [[21, 'A0']];
    for (let octave = 1; octave <= 7; octave++) {
      const c = 12 * (octave + 1);
      list.push([c, `C${octave}`], [c + 3, `Ds${octave}`], [c + 6, `Fs${octave}`], [c + 9, `A${octave}`]);
    }
    list.push([108, 'C8']);
    return list;
  })();

  const VOLUME = 2; // 全体の音量（録音が小さめなので持ち上げる。真ん中の音域の和音で最大 0.5 くらい）
  const RELEASE = 0.08; // 次のコードを押したときに、前の音が消えるまでの速さ（秒）

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const out = ctx.createGain();
  out.gain.value = VOLUME;
  // 低い音を重ねたときなどに音が割れないよう、最後に上限をかける
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  out.connect(limiter).connect(ctx.destination);
  // iPhone のマナーモードでも鳴らす（対応している Safari のみ）
  if (navigator.audioSession) navigator.audioSession.type = 'playback';

  // 開いたときに、全部の録音を読み込んでおく
  const buffers = new Map();
  const loaded = Promise.all(
    SAMPLES.map(async ([midi, name]) => {
      const data = await (await fetch(sampleUrl(name))).arrayBuffer();
      buffers.set(midi, await ctx.decodeAudioData(data));
    })
  );

  // いちばん近い録音と、そこからの高さの比
  function nearest(midi) {
    let best = SAMPLES[0][0];
    for (const [m] of SAMPLES) if (Math.abs(m - midi) < Math.abs(best - midi)) best = m;
    return { buffer: buffers.get(best), rate: 2 ** ((midi - best) / 12) };
  }

  let voices = [];

  function stop(at = ctx.currentTime) {
    for (const { source, gain } of voices) {
      gain.gain.setTargetAtTime(0, at, RELEASE / 3);
      source.stop(at + RELEASE * 4);
    }
    voices = [];
  }

  // 鳴らす準備（ブラウザは、押す操作のあとでないと音を出せない）
  async function ready() {
    await ctx.resume();
    await loaded;
  }

  // 音の時計（秒）。再生では、この時計で先の時刻を決めて予約する
  const now = () => ctx.currentTime;

  // 和音を鳴らす（MIDI 番号の配列）。前に鳴っていた和音は、鳴らす時刻に止める
  // when を渡すとその時刻（now() の時計）に予約する。渡さなければ、すぐ鳴らす
  async function play(midis, when) {
    await ready();
    const at = when ?? ctx.currentTime;
    stop(at);
    const level = 1 / Math.sqrt(midis.length); // 音の数が多くても、全体が大きくなりすぎないように
    for (const midi of midis) {
      const { buffer, rate } = nearest(midi);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = level;
      source.connect(gain).connect(out);
      source.start(at);
      voices.push({ source, gain });
    }
  }

  return { play, stop, ready, now, loaded, SAMPLES, nearest };
})();
