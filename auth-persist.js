(() => {
  const KEY = 'baking-ops-github-token';
  const tokenBox = document.querySelector('.tokenbox');
  const tokenInput = document.getElementById('token');
  const connectBtn = document.getElementById('connectBtn');
  const clearBtn = document.getElementById('clearBtn');
  const connection = document.getElementById('connection');
  if (!tokenInput || !connectBtn) return;

  let savedLabel = document.getElementById('savedTokenLabel');
  if (!savedLabel) {
    savedLabel = document.createElement('div');
    savedLabel.id = 'savedTokenLabel';
    savedLabel.style.cssText = 'display:none;min-width:180px;padding:9px 12px;border:1px solid #dce4f1;border-radius:10px;background:#fff;color:#14845e;font-size:11px;font-weight:850;';
    savedLabel.textContent = 'GitHub 연결 키 저장됨';
    tokenBox?.insertAdjacentElement('afterend', savedLabel);
  }

  function persistOnly() {
    const value = tokenInput.value.trim();
    if (value) localStorage.setItem(KEY, value);
  }

  function showSavedState() {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      if (!tokenInput.value) tokenInput.value = saved;
      if (tokenBox) tokenBox.style.display = 'none';
      savedLabel.style.display = 'block';
    }
  }

  function showInputState() {
    if (tokenBox) tokenBox.style.display = '';
    savedLabel.style.display = 'none';
  }

  // Save the value without hiding the input. Hiding on blur caused mobile
  // browsers to cancel the Connect button tap because the layout shifted.
  tokenInput.addEventListener('change', persistOnly);
  tokenInput.addEventListener('blur', persistOnly);
  connectBtn.addEventListener('pointerdown', persistOnly, true);
  connectBtn.addEventListener('click', persistOnly, true);
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') persistOnly();
  }, true);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      setTimeout(() => {
        localStorage.removeItem(KEY);
        tokenInput.value = '';
        showInputState();
        tokenInput.focus();
      }, 0);
    });
  }

  if (connection) {
    new MutationObserver(() => {
      const text = connection.textContent || '';
      if (text.includes('GitHub 연결됨')) showSavedState();
      if (text.includes('연결 실패')) showInputState();
    }).observe(connection, { childList: true, subtree: true, characterData: true });
  }

  // Only collapse the input on startup when a key was already saved from a
  // previous visit. The app's inline script will auto-connect with it.
  if (localStorage.getItem(KEY)) showSavedState();
})();
