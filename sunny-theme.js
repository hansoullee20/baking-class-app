(() => {
  document.title = "Sunny's Atelier · 베이킹 운영";
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', '#17375e');

  const brand = document.querySelector('.brand');
  if (brand) {
    brand.innerHTML = `
      <div class="atelier-seal" aria-label="Sunny's Atelier pâtisserie seal">
        <div class="seal-top">PÂTISSERIE</div>
        <div class="seal-name">Sunny's<em>Atelier</em></div>
        <div class="seal-mark">🥖</div>
        <div class="seal-bottom">PARIS · SEOUL</div>
      </div>`;
  }

  const note = document.querySelector('.side-note');
  if (note) note.innerHTML = 'Beautifully Baked.<br><span style="font-size:9px;letter-spacing:.16em;color:#17375e">PARIS · SEOUL</span>';

  const title = document.querySelector('.top h1');
  const subtitle = document.querySelector('.top p');
  if (title) title.textContent = "Sunny's Atelier";
  if (subtitle) subtitle.textContent = '베이킹 운영 관리 · Pâtisserie & Baking Class';

  const hero = document.querySelector('.hero');
  if (hero) {
    const small = hero.querySelector('small');
    const h2 = hero.querySelector('h2');
    const p = hero.querySelector('p');
    if (small) small.textContent = 'PÂTISSERIE · PARIS · SEOUL';
    if (h2) h2.textContent = '오늘의 베이킹 운영';
    if (p) p.textContent = '수업 일정, 레시피 원가, 수입과 예상이익을 한곳에서 관리합니다.';
  }
})();
