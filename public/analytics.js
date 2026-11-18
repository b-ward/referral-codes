(() => {
  const id = document.querySelector('meta[name="ga4-id"]')?.content;
  if (!/^G-[A-Z0-9]+$/.test(id || '')) return;
  const panel = document.querySelector('[data-analytics-panel]') || document.querySelector('.analytics-consent');
  const banner = panel || document.querySelector('[data-analytics-accept]')?.closest('section');
  const settings = document.querySelector('[data-analytics-settings]');
  const key = 'sidekick-analytics-v1';
  const maxAge = 180 * 24 * 60 * 60 * 1000;
  let accepted = false;
  let started = false;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* Storage is optional. */ }
  const valid = saved && typeof saved.accepted === 'boolean' && Date.now() - saved.at >= 0 && Date.now() - saved.at < maxAge;
  function start() {
    if (started) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname, page_referrer: '', cookie_expires: 15552000
    });
    window.gtag('event', 'page_view', { page_location: location.origin + location.pathname, page_title: document.title });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
  }
  function clearCookies() {
    const domains = location.hostname.split('.');
    for (const entry of document.cookie.split(';')) {
      const name = entry.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      document.cookie = `${name}=; Max-Age=0; path=/`;
      for (let i = 0; i < domains.length - 1; i++) document.cookie = `${name}=; Max-Age=0; path=/; domain=${domains.slice(i).join('.')}`;
    }
  }
  function choose(value) {
    accepted = value;
    try { localStorage.setItem(key, JSON.stringify({ accepted, at: Date.now() })); } catch { /* Keep a page-only choice. */ }
    banner.hidden = true;
    if (accepted) start();
    else {
      window['ga-disable-' + id] = true;
      clearCookies();
      // Unload Google's listeners so withdrawal cannot send cookieless pings.
      if (started) location.reload();
    }
    if (accepted) window['ga-disable-' + id] = false;
    settings?.focus({ preventScroll: true });
  }
  window.sidekickTrack = (event, brand) => {
    if (accepted && /^[a-z0-9-]+$/.test(brand || '')) window.gtag('event', event, { brand, transport_type: 'beacon' });
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-referral-brand]');
    if (link) window.sidekickTrack('referral_click', link.dataset.referralBrand);
  });
  document.querySelector('[data-analytics-accept]').addEventListener('click', () => choose(true));
  document.querySelector('[data-analytics-reject]').addEventListener('click', () => choose(false));
  if (settings) {
    settings.hidden = false;
    settings.addEventListener('click', () => { banner.hidden = false; document.querySelector('[data-analytics-reject]').focus({ preventScroll: true }); });
  }
  banner.hidden = Boolean(valid);
  if (valid && saved.accepted) { accepted = true; start(); }
  else clearCookies();
})();
