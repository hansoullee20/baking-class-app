(() => {
  const THEME_KEY = 'sunny-atelier-color-mode';
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function preferredMode() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return media && media.matches ? 'dark' : 'light';
  }

  function applyMode(mode, persist = false) {
    root.dataset.theme = mode;
    // Chromium/Safari use color-scheme as a signal for built-in auto darkening.
    // `only light` keeps the authored light palette from being darkened a second time.
    root.style.colorScheme = mode === 'light' ? 'only light' : 'dark';
    if (metaScheme) metaScheme.setAttribute('content', mode === 'light' ? 'only light' : 'dark');
    if (metaTheme) metaTheme.setAttribute('content', mode === 'dark' ? '#0c1420' : '#f7f0e5');
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = mode === 'dark' ? '☀ Light' : '☾ Dark';
      btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', mode === 'dark' ? 'Light mode' : 'Dark mode');
    }
    if (persist) localStorage.setItem(THEME_KEY, mode);
  }

  applyMode(preferredMode());

  document.title = "Sunny's Atelier · 베이킹 운영";

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

  const connect = document.querySelector('.connect');
  if (connect && !document.getElementById('themeToggle')) {
    const toggle = document.createElement('button');
    toggle.id = 'themeToggle';
    toggle.type = 'button';
    toggle.className = 'btn secondary small theme-toggle';
    connect.prepend(toggle);
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyMode(next, true);
    });
  }
  applyMode(root.dataset.theme || preferredMode());

  if (media && media.addEventListener) {
    media.addEventListener('change', (event) => {
      if (!localStorage.getItem(THEME_KEY)) applyMode(event.matches ? 'dark' : 'light');
    });
  }
})();
