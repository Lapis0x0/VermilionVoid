// Copy button functionality for Expressive Code
export function initCopyButtons() {
  document.querySelectorAll('.expressive-code .copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pre = btn.closest('pre');
      if (!pre) return;

      const code = pre.querySelector('code');
      if (!code) return;

      const text = code.textContent || '';

      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        setTimeout(() => {
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
}

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopyButtons);
  } else {
    initCopyButtons();
  }
}
