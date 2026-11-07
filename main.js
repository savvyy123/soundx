// コードの一覧を並べる（Figma と同じ順：種類ごとに、C から B までの 12 個を 4 列で）
// コードを押すと、ピアノ（piano.js）で鳴らし、コード進行の続きに入れる

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// intervals = ルートからの半音数（仕様書 2.3 の表）
const TYPES = [
  { title: 'メジャーコード', suffix: '', intervals: [0, 4, 7] },
  { title: 'マイナーコード', suffix: 'm', intervals: [0, 3, 7] },
  { title: 'サスフォーコード', suffix: 'sus4', intervals: [0, 5, 7] },
  { title: 'オーギュメントコード', suffix: 'aug', intervals: [0, 4, 8] },
  { title: 'ディミニッシュコード', suffix: 'dim', intervals: [0, 3, 6] },
  { title: 'セブンスコード', suffix: '7', intervals: [0, 4, 7, 10] },
  { title: 'ナインスコード', suffix: '9', intervals: [0, 4, 7, 10, 14] },
];

// オクターブ値が「0」のときのルートの高さ（MIDI 番号。60 = 真ん中の C）。C〜B のルートは 60〜71 になる
const BASE_MIDI = 60;
// 鳴らせる高さ（MIDI の範囲）。オクターブ値で外に出た音は、表示は残して鳴らさない（仕様書 4.4 の案 A）
const MIDI_MIN = 0;
const MIDI_MAX = 127;

// コード 1 つ。構成音は音名（0〜11）とオクターブ値に分けて持つ（9th の 9 度は、初期値が +1）
// オクターブ値は赤い扇形から変えられ、コード進行に入れたコードはそれぞれ自分の値を持つ
function makeChord(root, type) {
  return {
    root,
    type,
    notes: type.intervals.map((interval) => ({
      pitch: (ROOTS.indexOf(root) + interval) % 12,
      octave: Math.floor(interval / 12),
      interval,
    })),
  };
}

// 実際に鳴らす高さ（MIDI 番号）。ルートからの距離は基本形のまま、オクターブ値の分だけ 12 ずつ上下する
function toMidi(chord, note) {
  return BASE_MIDI + ROOTS.indexOf(chord.root) + (note.interval % 12) + 12 * note.octave;
}

function chordMidis(chord) {
  return chord.notes.map((note) => toMidi(chord, note)).filter((m) => m >= MIDI_MIN && m <= MIDI_MAX);
}

// コード名。いちばん低い音がルートでなくなったら、分数コードにする（例：C/E。仕様書 4.2）
function chordName(chord) {
  const name = chord.root + chord.type.suffix;
  const lowest = chord.notes.reduce((a, b) => (toMidi(chord, b) < toMidi(chord, a) ? b : a));
  return lowest.pitch === ROOTS.indexOf(chord.root) ? name : `${name}/${ROOTS[lowest.pitch]}`;
}

// シンボルに出ているコード（赤い扇形を押したときに、どのコードの値を変えるか）
let shown = null;

function showChord(chord) {
  shown = chord;
  SymbolView.show(chord ? chord.notes : []);
}

// 鳴らして、シンボルの構成音を赤くする
function playChord(chord) {
  Piano.play(chordMidis(chord));
  showChord(chord);
}

// ---- BPM ----
// 数字を押すと入力欄になり、確定（改行・欄の外を押す）で変わる。カーソルの点滅の間隔にも使う

const BPM_MIN = 30;
const BPM_MAX = 300;
let bpm = 120;

const bpmValue = document.getElementById('bpm-value');
const bpmInput = document.getElementById('bpm-input');

function setBpm(value) {
  bpm = value;
  bpmValue.textContent = bpm;
  document.documentElement.style.setProperty('--beat', `${60 / bpm}s`);
}

// 入力欄は数字と同じ場所に重ねる（iPhone は 16px 未満の入力欄で画面が拡大されるので、16px で作って 12px の大きさに縮める）
bpmValue.addEventListener('click', () => {
  const header = bpmValue.closest('.header').getBoundingClientRect();
  // 押せる範囲は数字より広いので、数字の文字そのものの位置に合わせる
  const range = document.createRange();
  range.selectNodeContents(bpmValue);
  const r = range.getBoundingClientRect();
  bpmInput.style.left = `${r.left - header.left}px`;
  bpmInput.style.top = `${r.top - header.top}px`;
  bpmInput.value = bpm;
  bpmInput.hidden = false;
  bpmValue.style.visibility = 'hidden';
  bpmInput.focus();
  bpmInput.select();
});

function closeBpm(commit) {
  if (bpmInput.hidden) return;
  const value = parseInt(bpmInput.value, 10);
  if (commit && Number.isFinite(value)) setBpm(Math.min(BPM_MAX, Math.max(BPM_MIN, value)));
  bpmInput.hidden = true;
  bpmValue.style.visibility = '';
}

bpmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') bpmInput.blur();
  if (e.key === 'Escape') closeBpm(false);
});
bpmInput.addEventListener('blur', () => closeBpm(true));

setBpm(bpm);

// ---- オクターブ値（転回形・ボイシング） ----
// 赤い扇形（構成音）か、その外の数字を押すと、数字の所が入力欄になる。確定すると、表示と鳴る高さが変わる（仕様書 4.3）
// 値に上限・下限はない。iPhone では数字と記号のキーボード（マイナスあり）が出る

const octaveInput = document.getElementById('octave-input');
let octaveTarget = null; // { chord, note, label }

SymbolView.onTap((pitch, label) => {
  const chord = shown;
  const note = chord?.notes.find((n) => n.pitch === pitch);
  if (!note) return;
  closeOctave(true);
  octaveTarget = { chord, note, label };
  // 数字の真ん中に、同じ大きさで重ねる（16px で作って縮める）
  const header = document.querySelector('.header').getBoundingClientRect();
  const r = label.getBoundingClientRect();
  const size = parseFloat(getComputedStyle(label).fontSize) * (document.getElementById('symbol').getBoundingClientRect().width / 1600);
  octaveInput.style.transform = `translate(-50%, -50%) scale(${size / 16})`;
  octaveInput.style.left = `${r.left + r.width / 2 - header.left}px`;
  octaveInput.style.top = `${r.top + r.height / 2 - header.top}px`;
  octaveInput.value = note.octave;
  octaveInput.hidden = false;
  label.style.visibility = 'hidden';
  octaveInput.focus();
  octaveInput.select();
});

function closeOctave(commit) {
  if (!octaveTarget) return;
  const { chord, note, label } = octaveTarget;
  octaveTarget = null;
  octaveInput.hidden = true;
  label.style.visibility = '';
  const value = parseInt(octaveInput.value.replace('−', '-'), 10);
  if (!commit || !Number.isFinite(value) || value === note.octave) return;
  note.octave = value;
  renderProgression(); // 分数コードの表記が変わることがある
  if (shown === chord) showChord(chord);
  if (!playing) Piano.play(chordMidis(chord)); // 新しい高さで聞かせる（再生中は次に回ってきたときに変わる）
}

octaveInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') octaveInput.blur();
  if (e.key === 'Escape') closeOctave(false);
});
octaveInput.addEventListener('blur', () => closeOctave(true));

// ---- コード進行 ----
// 最初は「_」が BPM の間隔で点滅している。一覧のコードを押すと、そこにコード名が入り、「—」をはさんで「_」が次へ進む
// 1 行に 4 つまで。5 つ目からは 2 行目に入り、8 つ入ると「_」は消える。どちらの行も中央にそろえる（Figma の 7 枚目）
// 入れたコードを押すと、「_」がそのコードの下に移り（直す場所）、一覧で次に押したコードと入れ替わる。もう一度押すとやめる

const MAX_CHORDS = 8;
const PER_ROW = 4;
const progression = []; // makeChord で作ったコード
let editing = -1; // 直しているコードの番号（-1 = 直していない）

const progressionEl = document.getElementById('progression');

function bar(kind) {
  const el = document.createElement('span');
  el.className = `bar ${kind}`;
  return el;
}

function renderProgression() {
  progressionEl.replaceChildren();
  // 「_」を出すのは、直していなくて、まだ入る余地があるとき。行の頭なら「—」をはさまない
  const next = progression.length;
  const showCursor = editing < 0 && next < MAX_CHORDS;
  const rows = Math.max(1, Math.ceil((next + (showCursor ? 1 : 0)) / PER_ROW));
  const rowEls = Array.from({ length: rows }, () => {
    const row = document.createElement('div');
    row.className = 'row';
    progressionEl.append(row);
    return row;
  });
  progression.forEach((chord, i) => {
    const row = rowEls[Math.floor(i / PER_ROW)];
    if (i % PER_ROW > 0) row.append(bar('dash'));
    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'name';
    name.classList.toggle('editing', i === editing);
    name.textContent = chordName(chord);
    name.addEventListener('click', () => {
      // 直す場所に選んだときは、そのコードを鳴らしてシンボルにも出す
      if (editing === i) editing = -1;
      else {
        editing = i;
        playChord(chord);
      }
      renderProgression();
    });
    row.append(name);
  });
  // 直しているあいだは、終わりの「_」は出さない（カーソルは 1 つだけ）
  if (showCursor) {
    const row = rowEls[Math.floor(next / PER_ROW)];
    if (next % PER_ROW > 0) row.append(bar('dash'));
    row.append(bar('cursor'));
  }
  fitRows();
}

// 幅の狭い画面で長いコード名（G#sus4 など）が 4 つ並ぶと入りきらないので、そのときだけ行を縮める
function fitRows() {
  for (const row of progressionEl.children) {
    row.style.transform = '';
    const kids = [...row.children].map((el) => el.getBoundingClientRect());
    const width = Math.max(...kids.map((b) => b.right)) - Math.min(...kids.map((b) => b.left));
    const room = row.clientWidth - 8;
    if (width > room) row.style.transform = `scale(${room / width})`;
  }
}

addEventListener('resize', fitRows);

function addChord(chord) {
  if (editing >= 0) {
    progression[editing] = chord;
    editing = -1;
  } else if (progression.length < MAX_CHORDS) {
    progression.push(chord);
  } else return;
  renderProgression();
}

renderProgression();

// ---- 再生 ----
// シンボルの真ん中を押すと、コード進行を今の BPM で鳴らす。1 コード = 1 小節（4 拍）で、最後まで行ったら最初に戻る
// もう一度押すと止まる。鳴っているコードはシンボルで赤くなる
// 音は少し先（LOOKAHEAD 秒）まで音の時計で予約するので、画面が重くても拍がずれない。BPM や進行を変えると次の小節から変わる

const BEATS_PER_CHORD = 4;
const LOOKAHEAD = 0.1;
let playing = false;
let session = 0; // 止めたあとに、前の再生の予約が画面を書き換えないよう、再生ごとに番号を変える
let timer = 0;
let nextBar = 0; // 次の小節の頭（音の時計）
let step = 0; // 次に鳴らすコードの番号

function schedule() {
  while (playing && progression.length && nextBar < Piano.now() + LOOKAHEAD) {
    const chord = progression[step % progression.length];
    Piano.play(chordMidis(chord), nextBar);
    const mine = session;
    setTimeout(() => {
      if (playing && session === mine) showChord(chord);
    }, Math.max(0, (nextBar - Piano.now()) * 1000));
    nextBar += (BEATS_PER_CHORD * 60) / bpm;
    step = (step + 1) % progression.length;
  }
}

async function startPlayback() {
  if (!progression.length) return;
  playing = true;
  session += 1;
  const mine = session;
  await Piano.ready();
  if (!playing || session !== mine) return; // 準備のあいだに止められたとき
  step = 0;
  nextBar = Piano.now() + 0.05;
  schedule();
  timer = setInterval(schedule, 25);
}

function stopPlayback() {
  playing = false;
  session += 1;
  clearInterval(timer);
  Piano.stop();
  showChord(null);
}

document.getElementById('play').addEventListener('click', () => (playing ? stopPlayback() : startPlayback()));

// ---- コードの一覧 ----

const list = document.getElementById('chords');
for (const type of TYPES) {
  const section = document.createElement('section');
  section.className = 'section';
  const title = document.createElement('h2');
  title.textContent = type.title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const root of ROOTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chord';
    button.textContent = root + type.suffix;
    button.dataset.root = root;
    button.dataset.type = type.suffix;
    button.addEventListener('click', () => {
      const chord = makeChord(root, type);
      playChord(chord);
      addChord(chord);
    });
    grid.append(button);
  }
  section.append(title, grid);
  list.append(section);
}
