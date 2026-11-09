// ハンバーガーメニュー（Figma の白ver・8〜12 枚目）
// 右上の 3 本線を押すとメニュー（このアプリについて / コードとは / テンプレート / 上級者用 : 転回とは）が開き、3 本線は × になる
// 項目を押すとそのページになる。× を押すと、どのページからでもアプリの画面に戻る
// 開いている間は、後ろのアプリの画面を押せないようにする（inert）

(() => {
  const button = document.getElementById('menu-button');
  const menu = document.getElementById('menu');
  const list = document.getElementById('menu-list');
  const pages = [...menu.querySelectorAll('.menu-page')];
  const behind = [document.querySelector('.header'), document.querySelector('.scroller')];

  // view: null = 閉じる、'list' = メニュー、それ以外 = そのページ（data-page の名前）
  function show(view) {
    const open = view !== null;
    menu.hidden = !open;
    list.hidden = view !== 'list';
    for (const page of pages) page.hidden = page.dataset.page !== view;
    menu.scrollTop = 0;
    button.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    for (const el of behind) el.inert = open;
  }

  button.addEventListener('click', () => show(menu.hidden ? 'list' : null));
  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-page]');
    if (item) show(item.dataset.page);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) show(null);
  });
})();
