// コードの一覧を並べる（Figma と同じ順：種類ごとに、C から B までの 12 個を 4 列で）
// コードを押すと、ピアノ（piano.js）で鳴らし、コード進行の続きに入れる

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// intervals = ルートからの半音数（仕様書 2.3 の表）
const TYPES = [
  { title: 'メジャーコード', suffix: '', intervals: [0, 4, 7] },
  { title: 'マイナーコード', suffix: 'm', intervals: [0, 3, 7] },
  { title: 'sus4コード', suffix: 'sus4', intervals: [0, 5, 7] },
  { title: 'augコード', suffix: 'aug', intervals: [0, 4, 8] },
  { title: 'dimコード', suffix: 'dim', intervals: [0, 3, 6] },
  { title: '7thコード', suffix: '7', intervals: [0, 4, 7, 10] },
  // m7 = マイナーに短 7 度を足す。C の場合 C E♭ G B♭
  { title: '7thマイナーコード', suffix: 'm7', intervals: [0, 3, 7, 10] },
  // 7-5 = セブンスの 5 度を半音下げる。C の場合 C E G♭ B♭
  { title: '7-5コード', suffix: '7-5', intervals: [0, 4, 6, 10] },
  // m7-5 = マイナーセブンスの 5 度を半音下げる（ハーフディミニッシュ）。C の場合 C E♭ G♭ B♭
  { title: 'マイナー7-5コード', suffix: 'm7-5', intervals: [0, 3, 6, 10] },
  // add9 = メジャーに 9 度だけを足す（7 度は入れない）。C の場合 C E G D
  { title: 'add9コード', suffix: 'add9', intervals: [0, 4, 7, 14] },
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

// 鳴らして、シンボルの構成音を赤くする。鳴った瞬間にシンボルの網点が粗くなり、ふだんの網点（main3 のプリセット 10）に戻る（halftone.js）
function playChord(chord) {
  Piano.play(chordMidis(chord));
  showChord(chord);
  Halftone.burst(60 / bpm);
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
  if (!playing) playChord(chord); // 新しい高さで聞かせる（再生中は次に回ってきたときに変わる）
}

octaveInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') octaveInput.blur();
  if (e.key === 'Escape') closeOctave(false);
});
octaveInput.addEventListener('blur', () => closeOctave(true));

// ---- コード進行 ----
// 最初は「_」が BPM の間隔で点滅している。一覧のコードを押すと、そこにコード名が入り、「—」をはさんで「_」が次へ進む
// 1 行に 4 つまで。5 つ目からは 2 行目、9 つ目からは 3 行目…と、数の上限はない。どの行も中央にそろえる（Figma の 7 枚目）
// 3 行目からは、行が増えた分だけヘッダーが下に伸びる（コード一覧はその下でスクロールする）
// 入れたコードを押すと、「_」がそのコードの下に移り（直す場所）、一覧で次に押したコードと入れ替わる。もう一度押すとやめる
// 「—」を押すと半分の長さになり、その前のコードが 2 拍（半小節）で次へ進む。もう一度押すと 4 拍（1 小節）に戻る
// 「—」はどのコードの後ろにも付く（行の終わりの 4 つ目・8 つ目…も、行の右に付ける）ので、どのコードの長さも変えられる
// 左の丸（A / B / C…）を押すと、次の文字の進行に切り替わる。それぞれ別に作れる（Figma の 7 枚目）
// いちばん後ろの方にコードが入っていたら、次の文字の空の方（B、C、D…）を新しく作る。空の方で押すと A に戻る

const PER_ROW = 4;
const FULL = 4; // 1 コードの長さ（拍）
const HALF = 2; // 「—」を半分にしたときの長さ（拍）
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sections = [[]]; // A、B、C…の順の進行。中身は makeChord で作ったコード（長さ beats 付き）
let section = 0; // いま見えている方の番号（0 = A）
let progression = sections[section]; // いま見えている方の進行
let editing = -1; // 直しているコードの番号（-1 = 直していない）

const progressionEl = document.getElementById('progression');
const melodyButton = document.getElementById('melody');
const headerEl = document.querySelector('.header');

function bar(kind) {
  const el = document.createElement('span');
  el.className = `bar ${kind}`;
  return el;
}

// i 番目のコードの後ろの「—」。押すと、そのコードの長さを 4 拍 ⇄ 2 拍で切り替える
function dash(i) {
  const chord = progression[i];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'bar dash';
  el.classList.toggle('half', chord.beats === HALF);
  el.setAttribute('aria-label', `${chordName(chord)} の長さ：${chord.beats} 拍`);
  el.addEventListener('click', () => {
    chord.beats = chord.beats === HALF ? FULL : HALF;
    renderProgression();
  });
  return el;
}

function renderProgression() {
  progressionEl.replaceChildren();
  // 「_」を出すのは、直していないとき。コードは「名前 —」の組で並べ、「_」はその続きに置く
  const next = progression.length;
  const showCursor = editing < 0;
  const rows = Math.max(1, Math.ceil((next + (showCursor ? 1 : 0)) / PER_ROW));
  headerEl.style.setProperty('--rows', Math.max(2, rows)); // ヘッダーの高さは 2 行ぶんより縮めない
  const rowEls = Array.from({ length: rows }, () => {
    const row = document.createElement('div');
    row.className = 'row';
    progressionEl.append(row);
    return row;
  });
  progression.forEach((chord, i) => {
    const row = rowEls[Math.floor(i / PER_ROW)];
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
    row.append(name, dash(i));
  });
  // 直しているあいだは、終わりの「_」は出さない（カーソルは 1 つだけ）
  if (showCursor) rowEls[Math.floor(next / PER_ROW)].append(bar('cursor'));
  fitRows();
}

// 行は画面の中央にそろえるが、左の丸（A / B / C…）と重ならないよう、丸の右 8 より左には出さない。右はロゴの左端と同じ 17 の余白を残す
// 長いコード名（A#add9、G#sus4 など）が並んで入りきらないときは、まず右へずらし、それでも入らなければ縮める
const ROW_MARGIN = 17;
const CIRCLE_GAP = 8;
function fitRows() {
  const box = progressionEl.getBoundingClientRect();
  const minLeft = melodyButton.getBoundingClientRect().right - box.left + CIRCLE_GAP;
  const maxRight = box.width - ROW_MARGIN;
  const origin = box.width / 2; // 行は全幅なので、縮める中心は画面の中央
  for (const row of progressionEl.children) {
    row.style.transform = '';
    const kids = [...row.children].map((el) => el.getBoundingClientRect());
    const left = Math.min(...kids.map((b) => b.left)) - box.left;
    const right = Math.max(...kids.map((b) => b.right)) - box.left;
    const scale = Math.min(1, (maxRight - minLeft) / (right - left));
    const shift = Math.max(0, minLeft - (origin + scale * (left - origin)));
    if (scale < 1 || shift > 0) row.style.transform = `translateX(${shift}px) scale(${scale})`;
  }
}

addEventListener('resize', fitRows);

function addChord(chord) {
  if (editing >= 0) {
    chord.beats = progression[editing].beats; // 入れ替えても、その場所の長さはそのまま
    progression[editing] = chord;
    editing = -1;
  } else {
    chord.beats = FULL;
    progression.push(chord);
  }
  renderProgression();
}

// 見える方を i 番目（0 = A、1 = B…）にする
function showSection(i) {
  section = i;
  progression = sections[section];
  editing = -1;
  document.getElementById('melody-name').textContent = LETTERS[section];
  renderProgression();
}

// 丸を押したときに進む先。空の方からは A へ戻る。いちばん後ろの方が埋まっていたら、次の文字の空の方を作ってそこへ
function nextSection() {
  if (!progression.length) return 0;
  if (section === sections.length - 1 && sections.length < LETTERS.length) sections.push([]);
  return (section + 1) % sections.length;
}

// 次の方へ。再生中なら、次のコードから切り替えた方の進行を頭から鳴らす（空なら止める）
melodyButton.addEventListener('click', () => {
  showSection(nextSection());
  switches += 1;
  if (!playing) showChord(null);
  else if (progression.length) {
    playSection = section;
    step = 0;
  } else stopPlayback();
});

renderProgression();

// ---- 再生 ----
// 「Play」とシンボルの真ん中：いま見えている方（A、B、C…のどれか）の進行だけを、頭からくり返す
// 「All Play」：A の頭から A → B → C…と続けて鳴らし、最後の方まで行ったら A に戻る（空の方は飛ばす）。表示も鳴っている方に切り替わる
// 同じものをもう一度押すと止まる。もう一方を押すと、そちらの鳴らし方で頭からやり直す
// 1 コード = 4 拍（「—」を半分にしたコードは 2 拍）。鳴っているコードはシンボルで赤くなる
// 音は少し先（LOOKAHEAD 秒）まで音の時計で予約するので、画面が重くても拍がずれない。BPM や進行を変えると次のコードから変わる

const LOOKAHEAD = 0.1;
let playing = false;
let mode = 'part'; // 'part' = 見えている方だけ（Play）、'all' = A → B → C…（All Play）
let session = 0; // 止めたあとに、前の再生の予約が画面を書き換えないよう、再生ごとに番号を変える
let timer = 0;
let nextBar = 0; // 次のコードの頭（音の時計）
let playSection = 0; // 鳴らしている方の番号
let step = 0; // 次に鳴らすコードの番号
let switches = 0; // 丸で方を切り替えた回数（切り替えたあとに、前に予約したコードが表示を戻さないように）

// i 番目の後ろで、コードが入っている最初の方（最後まで行ったら A から探す。なければ i のまま）
function nextFilled(i) {
  for (let k = 1; k <= sections.length; k++) {
    const j = (i + k) % sections.length;
    if (sections[j].length) return j;
  }
  return i;
}

function schedule() {
  while (playing && nextBar < Piano.now() + LOOKAHEAD) {
    if (step >= sections[playSection].length) {
      // 最後まで鳴った。All Play なら次の方へ（空の方は飛ばす。ほかが全部空なら同じ方をくり返す）
      step = 0;
      if (mode === 'all') playSection = nextFilled(playSection);
    }
    const list = sections[playSection];
    if (!list.length) {
      stopPlayback();
      return;
    }
    const chord = list[step];
    const from = playSection;
    Piano.play(chordMidis(chord), nextBar);
    const mine = session;
    const seen = switches;
    setTimeout(() => {
      if (!playing || session !== mine) return;
      if (mode === 'all' && from !== section && seen === switches) showSection(from);
      showChord(chord);
      Halftone.burst(60 / bpm);
    }, Math.max(0, (nextBar - Piano.now()) * 1000));
    nextBar += (chord.beats * 60) / bpm;
    step += 1;
  }
}

async function startPlayback(how) {
  const first = how === 'all' ? nextFilled(sections.length - 1) : section; // All Play は A から（空なら次の方から）
  if (!sections[first].length) return;
  mode = how;
  playing = true;
  session += 1;
  const mine = session;
  await Piano.ready();
  if (!playing || session !== mine) return; // 準備のあいだに止められたとき
  playSection = first;
  step = 0;
  nextBar = Piano.now() + 0.05;
  schedule();
  timer = setInterval(schedule, 25);
}

function togglePlayback(how) {
  const again = playing && mode === how;
  if (playing) stopPlayback();
  if (!again) startPlayback(how);
}

function stopPlayback() {
  playing = false;
  session += 1;
  clearInterval(timer);
  Piano.stop();
  Halftone.stop();
  showChord(null);
}

document.getElementById('play').addEventListener('click', () => togglePlayback('part'));
document.getElementById('play-part').addEventListener('click', () => togglePlayback('part'));
document.getElementById('play-all').addEventListener('click', () => togglePlayback('all'));

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
