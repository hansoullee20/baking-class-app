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

  function showSavedState() {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      if (tokenBox) tokenBox.style.display = 'none';
      savedLabel.style.display = 'block';
      if (!tokenInput.value) tokenInput.value = saved;
    } else {
      if (tokenBox) tokenBox.style.display = '';
      savedLabel.style.display = 'none';
    }
  }

  function persistCurrentToken() {
    const value = tokenInput.value.trim();
    if (value) {
      localStorage.setItem(KEY, value);
      showSavedState();
    }
  }

  tokenInput.addEventListener('change', persistCurrentToken);
  tokenInput.addEventListener('blur', persistCurrentToken);
  connectBtn.addEventListener('click', persistCurrentToken, true);
  tokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') persistCurrentToken();
  }, true);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      setTimeout(() => {
        localStorage.removeItem(KEY);
        tokenInput.value = '';
        if (tokenBox) tokenBox.style.display = '';
        savedLabel.style.display = 'none';
        tokenInput.focus();
      }, 0);
    });
  }

  if (connection) {
    new MutationObserver(() => {
      if (connection.textContent.includes('GitHub 연결됨')) showSavedState();
    }).observe(connection, { childList: true, subtree: true, characterData: true });
  }

  showSavedState();
})();
