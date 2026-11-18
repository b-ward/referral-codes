import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { build, validate, isLive, root } from '../scripts/build.mjs';
import { currentPromotion } from '../scripts/seo.mjs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const offers = JSON.parse(await readFile(path.join(root, 'content/offers.json'), 'utf8'));
const preview = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
const now = new Date();
const liveSite = { ...preview, origin: 'https://example.com', owner: 'Test owner', indexable: true };
await mkdir(path.join(root, '.test-output'), { recursive: true });
async function fixture(t, site = preview, data = offers) {
  const outDir = await mkdtemp(path.join(root, '.test-output', 'build-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await build({ site, offers: data, outDir, now });
  return { outDir, html: file => readFile(path.join(outDir, file), 'utf8') };
}

test('supplied invitations are preserved and codes are not invented', () => {
  assert.equal(offers.find(o => o.slug === 'lime').referralUrl, 'https://lime.bike/referral_signin/RHF7BLB');
  assert.equal(offers.find(o => o.slug === 'forest').code, 'pi1pLj3a');
  assert.equal(offers.find(o => o.slug === 'uber').code, '');
  const voi = new URL(offers.find(o => o.slug === 'voi').referralUrl);
  assert.equal(voi.searchParams.get('giss'), 'JQfJeHIcIfaNINPbOQJLLOJcMQaJNQbd');
  assert.equal(new URL(voi.searchParams.get('adj_deep_link')).searchParams.get('giss'), voi.searchParams.get('giss'));
});
test('preview stays out of search and produces every HTML guide', async t => {
  const f = await fixture(t);
  assert.match(await f.html('index.html'), /noindex,follow/);
  assert.doesNotMatch(await f.html('index.html'), /rel="canonical"/);
  for (const o of offers) assert.match(await f.html(`guide/${o.slug}/index.html`), new RegExp(`${o.name} referral`));
  assert.doesNotMatch(await f.html('sitemap.xml'), /<loc>/);
});
test('public sitemap and homepage include only live offers', async t => {
  const f = await fixture(t, liveSite);
  const home = await f.html('index.html');
  assert.match(home, /content="index,follow,max-image-preview:large"/);
  assert.match(home, /rel="canonical" href="https:\/\/example.com\/"/);
  assert.doesNotMatch(home, /href="\/guide\/eatclub\/"|href="\/guide\/binance\/"/);
  assert.match(await f.html('sitemap.xml'), /https:\/\/example.com\/guide\/forest\//);
  assert.doesNotMatch(await f.html('sitemap.xml'), /eatclub|binance/);
  assert.match(await f.html('guide/eatclub/index.html'), /noindex,follow/);
  assert.match(await f.html('robots.txt'), /Sitemap: https:\/\/example.com\/sitemap.xml/);
});
test('GitHub project subpaths work for assets and canonical URLs', async t => {
  const f = await fixture(t, { ...liveSite, origin: 'https://b-ward.github.io', basePath: '/referral-codes' });
  const guide = await f.html('guide/forest/index.html');
  assert.match(guide, /href="\/referral-codes\/styles.css"/);
  assert.match(guide, /href="https:\/\/b-ward.github.io\/referral-codes\/guide\/forest\/"/);
  assert.match(await f.html('sitemap.xml'), /https:\/\/b-ward.github.io\/referral-codes\//);
});
test('all internal destinations and fragment anchors exist', async t => {
  const f = await fixture(t);
  for (const file of (await readdir(f.outDir, { recursive: true })).filter(p => p.endsWith('.html'))) {
    const html = await f.html(file);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const link = match[1];
      if (!link.startsWith('/') && !link.startsWith('#')) continue;
      const target = new URL(link, `https://test.local/${file.replaceAll('\\', '/')}`);
      let destination = target.pathname.slice(1);
      if (!destination || destination.endsWith('/')) destination += 'index.html';
      const content = await f.html(destination);
      if (target.hash) assert.ok(content.includes(`id="${target.hash.slice(1)}"`), `${file}: broken anchor ${link}`);
    }
  }
});
test('invitation links are sponsored and codes remain selectable without JS', async t => {
  const f = await fixture(t);
  const forest = await f.html('guide/forest/index.html');
  assert.match(forest, /href="https:\/\/link.forest.me\/referral\/pi1pLj3a" rel="sponsored noopener"/);
  assert.match(forest, /readonly value="pi1pLj3a"/);
  assert.match(forest, /data-copy="pi1pLj3a" data-copy-kind="code"[^>]* hidden/);
  assert.doesNotMatch(await f.html('guide/lime/index.html'), /data-copy-kind="code"/);
  assert.match(await f.html('guide/uber/index.html'), /Up to £5 off each ride/);
});
test('expired offers lose claim actions, index eligibility and sitemap entries', async t => {
  const data = structuredClone(offers);
  const forest = data.find(o => o.slug === 'forest');
  forest.expiresAt = new Date(now.valueOf() - 86400000).toISOString().slice(0, 10);
  assert.equal(isLive(forest, now), false);
  const f = await fixture(t, liveSite, data);
  const html = await f.html('guide/forest/index.html');
  assert.match(html, /Offer unavailable/);
  assert.match(html, /noindex,follow/);
  assert.doesNotMatch(html, /data-copy=|class="button button-dark claim-link"/);
  assert.doesNotMatch(await f.html('sitemap.xml'), /guide\/forest/);
  forest.expiresAt = now.toISOString().slice(0, 10);
  assert.equal(isLive(forest, now), true);
});
test('unsafe links and incomplete launch settings fail validation', () => {
  assert.throws(() => validate({ ...liveSite, origin: 'javascript:alert(1)' }, offers, now), /HTTPS origin/);
  assert.throws(() => validate({ ...liveSite, owner: '' }, offers, now), /Indexing requires/);
  assert.throws(() => validate(liveSite, [...offers, offers[0]], now), /duplicate/);
  const data = structuredClone(offers);
  data[0].referralUrl = 'javascript:alert(1)';
  assert.throws(() => validate(preview, data, now), /HTTPS URL/);
  data[0] = { ...offers[0], reward: '' };
  assert.throws(() => validate(preview, data, now), /Active offer/);
  data[0] = { ...offers[0], checkedAt: '2027-02-31' };
  assert.throws(() => validate(preview, data, now), /Invalid checkedAt/);
});
test('HTML and structured data escape untrusted text', async t => {
  const data = structuredClone(offers);
  data[0].name = '<script>alert(1)</script>';
  const f = await fixture(t, { ...preview, name: '</script><script>alert(1)</script>' }, data);
  const html = await f.html('index.html');
  assert.doesNotMatch(html, /<script>alert\(1\)/);
  assert.match(html, /&lt;script&gt;alert/);
  for (const s of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) assert.doesNotThrow(() => JSON.parse(s[1]));
});
test('output cleaning rejects source directories', async () => {
  await assert.rejects(build({ site: preview, offers, outDir: path.join(root, 'content'), now }), /Output must/);
});

test('explicit build configurations are isolated from hosting environment variables', async t => {
  const previous = Object.fromEntries(['SITE_URL', 'BASE_PATH', 'INDEXABLE'].map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { SITE_URL: 'https://production.example', BASE_PATH: '/production', INDEXABLE: 'true' });
    const f = await fixture(t, preview);
    const html = await f.html('index.html');
    assert.match(html, /noindex,follow/);
    assert.doesNotMatch(html, /production.example|\/production\/styles.css/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

const structuredData = html => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);

test('the new brand and descriptive search headings appear across every page', async t => {
  const f = await fixture(t, liveSite);
  const titles = new Set();
  const descriptions = new Set();
  for (const file of (await readdir(f.outDir, { recursive: true })).filter(p => p.endsWith('.html'))) {
    const html = await f.html(file);
    assert.match(html, /SignUp Sidekick/);
    assert.doesNotMatch(html, /good turns|good-turns|a good turn/i);
    assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, `${file} must have one main heading`);
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    const description = html.match(/name="description" content="([^"]*)"/)[1];
    assert.ok(!titles.has(title), `duplicate title: ${file}`);
    assert.ok(!descriptions.has(description), `duplicate description: ${file}`);
    titles.add(title); descriptions.add(description);
  }
  assert.match(await f.html('index.html'), /<h1>Referral codes\./);
  assert.match(await f.html('guide/lime/index.html'), /<title>Lime referral code UK: £4 ride credit \| SignUp Sidekick<\/title>/);
});

test('answer summaries explain link versus code and keep reward limits visible in HTML', async t => {
  const f = await fixture(t);
  const forest = await f.html('guide/forest/index.html');
  assert.match(forest, /The Forest referral code is pi1pLj3a/);
  assert.match(forest, /<h1>Forest referral code<\/h1>/);
  assert.match(forest, /does not specify an amount/);
  const lime = await f.html('guide/lime/index.html');
  assert.match(lime, /no manually redeemable code is provided/);
  assert.match(lime, /£4 ride credit/);
  assert.match(lime, /Do existing Lime riders qualify/);
  const uber = await f.html('guide/uber/index.html');
  assert.match(uber, /first five rides, capped at £5 off each ride/);
  assert.match(uber, /Does this Uber referral work for Uber Eats/);
  assert.match(await f.html('guide/voi/index.html'), /Is the Voi referral ride unlimited/);
  assert.match(uber, /No fixed end date was supplied/);
});

test('structured data describes the real site, public offers, guide, author and official source', async t => {
  const f = await fixture(t, liveSite);
  const home = structuredData(await f.html('index.html'));
  const website = home.find(item => item['@type'] === 'WebSite');
  assert.equal(website.name, 'SignUp Sidekick');
  assert.equal(website.alternateName, 'Sign Up Sidekick');
  const collection = home.find(item => item['@type'] === 'CollectionPage');
  assert.equal(collection.mainEntity.itemListElement.length, offers.filter(o => isLive(o, now)).length);
  assert.ok(collection.mainEntity.itemListElement.every(item => !item.url.includes('eatclub') && !item.url.includes('binance')));
  const graph = structuredData(await f.html('guide/lime/index.html'));
  const article = graph.find(item => item['@type'] === 'Article');
  assert.equal(article.author.name, 'Test owner');
  assert.equal(article.citation, offers[0].sourceUrl);
  assert.equal(article.mainEntityOfPage['@id'], 'https://example.com/guide/lime/#webpage');
  assert.equal(graph.find(item => item['@type'] === 'WebPage').mainEntity['@id'], article['@id']);
  assert.ok(graph.some(item => item['@type'] === 'BreadcrumbList'));
  assert.doesNotMatch(JSON.stringify(graph), /aggregateRating|FAQPage|priceCurrency/);
  assert.ok(!structuredData(await f.html('guide/eatclub/index.html')).some(item => item['@type'] === 'Article'));
});

test('sharing metadata references a real 1200 by 630 PNG on the canonical origin', async t => {
  const f = await fixture(t, liveSite);
  const html = await f.html('guide/uber/index.html');
  assert.match(html, /property="og:image" content="https:\/\/example.com\/social.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  const png = await readFile(path.join(f.outDir, 'social.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('all supplied new invitations are stored and Yonder is active', () => {
  assert.equal(offers.length, 16);
  const expected = {
    'uber-eats': 'https://ubereats.com/feed?promoCode=eats-ns7b12g00e',
    eatclub: 'https://links.eatclub.com.au/OdVrQJtAY2b',
    gopuff: 'https://s.gopuff.com/a/YXZCST',
    'octopus-energy': 'https://share.octopus.energy/lumpy-pup-162',
    lebara: 'https://aklam.io/pnXBN0vy',
    wise: 'https://wise.com/invite/ahpc/brendoncameronw',
    monzo: 'https://join.monzo.com/c/8l0qc1vz',
    plum: 'https://withplum.com/referral?referralCode=8uOqx0Wmpi',
    yonder: 'https://join.yondercard.com/izgylzm',
    'jp-morgan-personal-investing': 'https://jpmorgan-personal-investing.mention-me.com/m/ol/jo1qahpo-brendon-ward',
    etoro: 'https://etoro.tw/490LPDJ'
  };
  for (const [slug, link] of Object.entries(expected)) assert.equal(offers.find(o => o.slug === slug).referralUrl, link);
  const binance = new URL(offers.find(o => o.slug === 'binance').referralUrl);
  assert.equal(binance.searchParams.get('ref'), 'GRO_28502_V4KXL');
  assert.equal(binance.searchParams.get('utm_medium'), 'app_share_link_telegram');
  assert.equal(offers.find(o => o.slug === 'yonder').code, 'IZGYLZM');
  assert.equal(offers.find(o => o.slug === 'uber-eats').code, 'eats-ns7b12g00e');
  assert.ok(isLive(offers.find(o => o.slug === 'yonder'), now));
});

test('visitor and referrer rewards, order minimums and risk context stay distinct', async t => {
  const f = await fixture(t, liveSite);
  const eats = await f.html('guide/uber-eats/index.html');
  assert.match(eats, /first two orders of £15 or more/);
  assert.match(eats, /readonly value="eats-ns7b12g00e"/);
  assert.match(eats, /Enter it at checkout before paying/);
  const wise = await f.html('guide/wise/index.html');
  assert.match(wise, /A\$30 figure is not a visitor cash bonus/);
  assert.match(wise, /<dt>Referrer benefit<\/dt>/);
  assert.doesNotMatch(wise, /<title>Wise referral code UK/);
  const monzo = await f.html('guide/monzo/index.html');
  assert.match(monzo, /£50 is not guaranteed/);
  const jpm = await f.html('guide/jp-morgan-personal-investing/index.html');
  assert.match(jpm, /class="risk-note">Capital at risk/);
  assert.match(jpm, /Other charges/);
  assert.match(await f.html('guide/etoro/index.html'), /No visitor bonus confirmed/);
  assert.match(await f.html('guide/yonder/index.html'), /up to 20,000 welcome points/);
});

test('inactive public-sharing and UK crypto offers have explanations but no claim links', async t => {
  const f = await fixture(t, liveSite);
  for (const slug of ['eatclub', 'binance']) {
    const html = await f.html(`guide/${slug}/index.html`);
    assert.match(html, /noindex,follow/);
    assert.doesNotMatch(html, /rel="sponsored noopener"|data-copy=/);
    assert.ok(!html.includes(offers.find(o => o.slug === slug).referralUrl));
  }
  assert.match(await f.html('guide/eatclub/index.html'), /public referral sites/);
  assert.match(await f.html('guide/binance/index.html'), /FCA guidance/);
});

test('Lebara campaign disappears after its own deadline while the standard offer stays live', async t => {
  const lebara = offers.find(o => o.slug === 'lebara');
  assert.ok(currentPromotion(lebara, new Date('2026-12-01T23:59:59Z')));
  assert.equal(currentPromotion(lebara, new Date('2026-12-02T00:00:00Z')), null);
  const outDir = await mkdtemp(path.join(root, '.test-output', 'campaign-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await build({ site: liveSite, offers, outDir, now: new Date('2026-12-01T12:00:00Z') });
  assert.match(await readFile(path.join(outDir, 'guide/lebara/index.html'), 'utf8'), /class="useful-note promotion"/);
  await build({ site: liveSite, offers, outDir, now: new Date('2026-12-02T12:00:00Z') });
  const html = await readFile(path.join(outDir, 'guide/lebara/index.html'), 'utf8');
  assert.doesNotMatch(html, /class="useful-note promotion"|£2.50/);
  assert.match(html, /50% off the first 3 months/);
  assert.match(html, /rel="sponsored noopener"/);
});

test('four simple categories and authentic local logos cover the whole directory', async t => {
  assert.deepEqual([...new Set(offers.map(o => o.category))].sort(), ['Food', 'Home', 'Money', 'Travel']);
  const brands = JSON.parse(await readFile(path.join(root, 'content/brands.json'), 'utf8'));
  const f = await fixture(t, liveSite);
  const home = await f.html('index.html');
  assert.deepEqual([...home.matchAll(/data-filter="([^"]+)"/g)].map(m => m[1]), ['all', 'Travel', 'Money', 'Home', 'Food']);
  assert.equal([...home.matchAll(/data-offer /g)].length, offers.filter(o => isLive(o, now)).length);
  assert.doesNotMatch(home, /mini-ticket|orbit-one|hero-art/);
  assert.match(home, /A small perk for a fresh start\./);
  for (const o of offers) {
    const brand = brands[o.slug];
    assert.ok(brand.sourceUrl.startsWith('https://'));
    const bytes = await readFile(path.join(f.outDir, brand.file.slice(1)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), brand.sha256, `changed logo: ${o.slug}`);
    if (isLive(o, now)) assert.ok(home.includes(`src="${brand.file}"`), `missing logo: ${o.slug}`);
  }
});

test('every guide has sourced reward notes and specific mobile and desktop claim instructions', async t => {
  const f = await fixture(t);
  for (const o of offers) {
    const html = await f.html(`guide/${o.slug}/index.html`);
    assert.ok(o.claim.mobile.length > 30 && o.claim.desktop.length > 30);
    assert.match(html, /<h3>On your phone<\/h3>/);
    assert.match(html, /<h3>On a computer<\/h3>/);
    assert.match(html, /What I checked/);
  }
  const gopuff = await f.html('guide/gopuff/index.html');
  assert.match(gopuff, /at least £30 of eligible items/);
  const plum = await f.html('guide/plum/index.html');
  assert.match(plum, /No new-customer reward confirmed/);
  assert.doesNotMatch(plum, /<h2 id="claim-title">£25/);
  const yonder = await f.html('guide/yonder/index.html');
  assert.match(yonder, /£1,000 spend in the first 30 days/);
  assert.match(yonder, /73.1%/);
  assert.match(yonder, /£17.99/);
});

test('phone handoffs preserve the exact personal invitation and are absent for inactive offers', async t => {
  const f = await fixture(t);
  for (const o of offers.filter(o => isLive(o, now))) {
    const svg = await f.html(`qr/${o.slug}.svg`);
    const encoded = svg.match(/<desc>(.*?)<\/desc>/s)[1].replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    assert.equal(encoded, o.referralUrl);
    assert.match(svg, /<path/);
    const guide = await f.html(`guide/${o.slug}/index.html`);
    assert.ok(guide.includes(`src="/qr/${o.slug}.svg"`));
    assert.match(guide, /data-copy-kind="link"/);
  }
  await assert.rejects(f.html('qr/eatclub.svg'), /ENOENT/);
  await assert.rejects(f.html('qr/binance.svg'), /ENOENT/);
});

test('copying multiple codes and links uses the clicked field and selects that field on failure', async () => {
  const app = await readFile(path.join(root, 'public/app.js'), 'utf8');
  const toast = { textContent: '', classList: { add() {}, remove() {} } };
  const values = []; const inputs = []; const handlers = [];
  const buttons = ['pi1pLj3a', 'eats-ns7b12g00e', 'https://lime.bike/referral_signin/RHF7BLB'].map((value, i) => {
    const input = { value, focus() { this.focused = true; }, select() { this.selected = true; }, setSelectionRange(start, end) { this.range = [start, end]; } };
    inputs.push(input);
    return { hidden: true, textContent: i === 2 ? 'Copy link' : 'Copy code', dataset: { copy: value, copyKind: i === 2 ? 'link' : 'code' }, closest() { return { querySelector() { return input; } }; }, addEventListener(type, handler) { handlers.push(handler); } };
  });
  const document = { querySelector(selector) { return selector === '.toast' ? toast : null; }, querySelectorAll() { return buttons; } };
  const navigator = { clipboard: { async writeText(value) { values.push(value); } } };
  vm.runInNewContext(app, { document, navigator, window: {}, setTimeout() { return 1; }, clearTimeout() {} });
  await handlers[0](); await handlers[1](); await handlers[2]();
  assert.deepEqual(values, buttons.map(b => b.dataset.copy));
  assert.match(toast.textContent, /Invitation link copied/);
  navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
  await handlers[1]();
  assert.equal(inputs[1].selected, true);
  assert.equal(inputs[0].selected, undefined);
  assert.deepEqual(inputs[1].range, [0, 'eats-ns7b12g00e'.length]);
  assert.match(toast.textContent, /Code selected/);
  document.execCommand = command => command === 'copy';
  await handlers[2]();
  assert.equal(inputs[2].selected, true);
  assert.match(toast.textContent, /Invitation link copied/);
});

test('analytics is enabled only for public builds and uses the configured ID and consent controls', async t => {
 const publicBuild = await fixture(t, liveSite);
 const html = await publicBuild.html('index.html');
 assert.match(html, /<meta name="ga4-id" content="G-Q63L739CS5">/);
 assert.equal((html.match(/data-analytics-panel/g) || []).length, 1);
 assert.match(html, /data-analytics-settings hidden/);
 assert.doesNotMatch(html, /<script[^>]+src="https:\/\/www.googletagmanager.com/);
 assert.match(await publicBuild.html('_headers'), /connect-src 'self' https:\/\/\*\.google-analytics\.com/);
 const local = await fixture(t);
 assert.doesNotMatch(await local.html('index.html'), /name="ga4-id"/);
});
