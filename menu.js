// ハンバーガーメニュー（Figma の白ver・8〜12 枚目）
// 右上の 3 本線を押すとメニュー（このアプリについて / コードとは / テンプレート / 上級者用 : 転回とは）が開き、3 本線は × になる
// 項目を押すとそのページになる。× を押すと 1 つ前に戻る（ページ → メニュー → アプリの画面）
// ページからメニューに戻るときは × のまま。メニューを閉じるときに 3 本線に戻る
// 開いている間は、後ろのアプリの画面を押せないようにする（inert）

(() => {
  const button = document.getElementById('menu-button');
  const menu = document.getElementById('menu');
  const list = document.getElementById('menu-list');
  const pages = [...menu.querySelectorAll('.menu-page')];
  const behind = [document.querySelector('.header'), document.querySelector('.scroller')];

  // 今の画面。null = 閉じている、'list' = メニュー、それ以外 = そのページ（data-page の名前）
  let current = null;

  function show(view) {
    current = view;
    const open = view !== null;
    menu.hidden = !open;
    list.hidden = view !== 'list';
    for (const page of pages) page.hidden = page.dataset.page !== view;
    menu.scrollTop = 0;
    button.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', !open ? 'メニューを開く' : view === 'list' ? 'メニューを閉じる' : 'メニューに戻る');
    for (const el of behind) el.inert = open;
    document.documentElement.classList.toggle('menu-open', open); // 開いている間は、後ろのページをスクロールさせない
  }

  // 1 つ前へ：ページ → メニュー、メニュー → 閉じる
  const back = () => show(current === 'list' ? null : 'list');

  button.addEventListener('click', () => (current === null ? show('list') : back()));
  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-page]');
    if (item) show(item.dataset.page);
  });
  // テンプレートの曲名を押すと、その進行を読み込んで（main.js の loadTemplate）メニューを閉じる
  menu.addEventListener('click', (e) => {
    const template = e.target.closest('[data-template]');
    if (!template) return;
    loadTemplate(template.dataset.template);
    show(null);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current !== null) back();
  });
})();
