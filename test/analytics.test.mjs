import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/analytics.js', import.meta.url), 'utf8');
function browser(saved) {
  const handlers = {}, scripts = [], store = new Map(saved ? [['sidekick-analytics-v1', JSON.stringify(saved)]] : []);
  const panel = { hidden: true }, settings = { focus() {}, addEventListener(t, fn) { handlers.settings = fn; } };
  const control = name => ({ focus() {}, addEventListener(t, fn) { handlers[name] = fn; } });
  let reloads = 0;
  const document = { title: 'Lime guide', cookie: '', head: { appendChild(s) { scripts.push(s); } }, createElement() { return {}; }, addEventListener(t, fn) { handlers.click = fn; }, querySelector(s) { return s.startsWith('meta') ? { content: 'G-Q63L739CS5' } : s === '[data-analytics-panel]' ? panel : s === '[data-analytics-settings]' ? settings : s === '[data-analytics-accept]' ? control('accept') : control('reject'); } };
  const window = {};
  vm.runInNewContext(source, { window, document, localStorage: { getItem: k => store.get(k), setItem: (k,v) => store.set(k,v) }, location: { origin: 'https://example.com', pathname: '/guide/lime/', hostname: 'example.com', reload() { reloads++; } } });
  return { window, panel, scripts, handlers, store, get reloads() { return reloads; } };
}
test('analytics sends nothing before consent or after rejection; acceptance records only allowed event data', () => {
 const b = browser();
 assert.equal(b.scripts.length, 0); assert.equal(b.panel.hidden, false);
 b.window.sidekickTrack('referral_click', 'lime'); assert.equal(b.window.dataLayer, undefined);
 b.handlers.reject(); assert.equal(b.scripts.length, 0);
 b.handlers.settings(); b.handlers.accept(); assert.equal(b.scripts.length, 1);
 assert.match(b.scripts[0].src, /gtag\/js\?id=G-Q63L739CS5$/);
 const events = () => b.window.dataLayer.filter(x => x[0] === 'event');
 assert.equal(events()[0][1], 'page_view');
 assert.equal(events()[0][2].page_location, 'https://example.com/guide/lime/');
 b.handlers.click({ target: { closest() { return { dataset: { referralBrand: 'lime' } }; } } });
 assert.equal(events().at(-1)[1], 'referral_click'); assert.equal(events().at(-1)[2].brand, 'lime');
 b.handlers.reject(); const count = events().length; b.window.sidekickTrack('referral_click', 'lime');
 assert.equal(events().length, count); assert.equal(b.reloads, 1); assert.equal(b.window['ga-disable-G-Q63L739CS5'], true);
});
test('saved consent expires and a returning rejection never loads Google', () => {
 assert.equal(browser({ accepted: false, at: Date.now() }).scripts.length, 0);
 assert.equal(browser({ accepted: true, at: Date.now() }).scripts.length, 1);
 const expired = browser({ accepted: true, at: 1 }); assert.equal(expired.scripts.length, 0); assert.equal(expired.panel.hidden, false);
});
