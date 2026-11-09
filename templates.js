// コード進行のテンプレート（メニューの「テンプレート」から読み込む。main.js の loadTemplate）
// parts = A、B、C…の進行。chord = コード名、beats = 長さ（4 拍か 2 拍）、octaves = 構成音（ルートから順）のオクターブ値（転回）
// 足すとき：アプリで進行を作り、ブラウザのコンソールで次を実行すると、この形でクリップボードにコピーされる（title を足して TEMPLATES に入れる）
//   copy(JSON.stringify({ bpm, parts: sections.filter((s) => s.length).map((s) => s.map((c) => ({ chord: c.root + c.type.suffix, beats: c.beats, octaves: c.notes.map((n) => n.octave) }))) }))

const TEMPLATES = {
  // 2026-11-09 にユーザーが作った状態（A〜E の 5 つの進行、BPM 174）
  lemon: {
    title: '米津玄師-Lemon',
    bpm: 174,
    parts: [
      // A
      [
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'Ddim', beats: 4, octaves: [0, 0, 0] },
        { chord: 'D#7', beats: 4, octaves: [0, 0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
      ],
      // B
      [
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'Ddim', beats: 4, octaves: [0, 0, 0] },
        { chord: 'D#7', beats: 4, octaves: [0, 0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'D#7', beats: 4, octaves: [0, 0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
      ],
      // C
      [
        { chord: 'C#m', beats: 4, octaves: [0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'C#m', beats: 4, octaves: [0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 2, octaves: [0, 0, 0] },
        { chord: 'F#', beats: 2, octaves: [0, 0, -1] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
      ],
      // D
      [
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'D#7', beats: 4, octaves: [0, 0, 0, 0] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'A#m7-5', beats: 2, octaves: [0, 0, -1, -1] },
        { chord: 'D#7', beats: 2, octaves: [0, 0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'C#m', beats: 4, octaves: [0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 2, octaves: [0, 0, 0] },
        { chord: 'F#', beats: 2, octaves: [0, 0, -1] },
        { chord: 'Fm7-5', beats: 4, octaves: [0, 0, -1, -1] },
        { chord: 'C#m', beats: 4, octaves: [0, 0, 0] },
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 2, octaves: [0, 0, 0] },
        { chord: 'F#sus4', beats: 2, octaves: [0, 0, -1] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
      ],
      // E
      [
        { chord: 'G#m', beats: 4, octaves: [0, 0, -1] },
        { chord: 'F#', beats: 4, octaves: [0, 0, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'E', beats: 4, octaves: [0, 0, 0] },
        { chord: 'B', beats: 4, octaves: [0, -1, -1] },
        { chord: 'Ddim', beats: 4, octaves: [0, 0, 0] },
        { chord: 'D#7', beats: 4, octaves: [0, 0, 0, 0] },
      ],
    ],
  },
};
