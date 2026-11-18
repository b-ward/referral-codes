const filters = document.querySelector('[data-filters]');
if (filters) {
  filters.hidden = false;
  const rows = [...document.querySelectorAll('[data-offer]')];
  const search = document.querySelector('#search');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  let category = 'all';
  const update = () => {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    for (const row of rows) {
      row.hidden = !(row.dataset.name.includes(query) && (category === 'all' || row.dataset.category === category));
      if (!row.hidden) count++;
    }
    document.querySelector('.empty-state').hidden = count !== 0;
    document.querySelector('#results-count').textContent = `${count} referral ${count === 1 ? 'guide' : 'guides'} found`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  };
  buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; update(); }));
  search.addEventListener('input', update);
  document.querySelector('[data-reset]').addEventListener('click', () => { search.value = ''; category = 'all'; update(); search.focus(); });
  update();
}

const toast = document.querySelector('.toast');
let toastTimer;
document.querySelectorAll('[data-copy]').forEach(button => {
  button.hidden = false;
  const originalLabel = button.textContent;
  let labelTimer;
  button.addEventListener('click', async () => {
    const scope = button.closest('[data-copy-scope]');
    const input = scope.querySelector('input');
    const kind = button.dataset.copyKind || 'code';
    const success = () => {
      window.sidekickTrack?.(kind === 'link' ? 'referral_link_copy' : 'referral_code_copy', button.dataset.brand);
      button.textContent = 'Copied!';
      toast.textContent = kind === 'link' ? 'Invitation link copied. Open it on your phone to continue.' : 'Referral code copied. Follow the claim instructions to apply it.';
    };
    button.textContent = 'Copying…';
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await Promise.race([
        navigator.clipboard.writeText(button.dataset.copy),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard timed out')), 1500))
      ]);
      success();
    } catch {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      // Compatibility fallback for embedded browsers that deny the Clipboard API.
      let copied = false;
      try { copied = document.execCommand?.('copy') === true; } catch { /* Keep the text selected for manual copying. */ }
      if (copied) success();
      else {
        button.textContent = originalLabel;
        toast.textContent = `${kind === 'link' ? 'Link' : 'Code'} selected. Tap and hold, or press Ctrl/Cmd+C to copy.`;
      }
    }
    button.disabled = false;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500);
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => { button.textContent = originalLabel; }, 4500);
  });
});
