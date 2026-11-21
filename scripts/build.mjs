import { readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPages } from './render.mjs';
import QRCode from 'qrcode';

export const root = fileURLToPath(new URL('../', import.meta.url));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const date = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function https(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }

export function validate(site, offers, now = new Date()) {
  if (!site.name || !Array.isArray(offers) || !offers.length) throw new Error('A site name and offers are required.');
  if (site.origin && (!https(site.origin) || new URL(site.origin).pathname !== '/' || new URL(site.origin).search || new URL(site.origin).hash)) throw new Error('Site origin must be an HTTPS origin without a path.');
  if (site.basePath && !/^\/[a-zA-Z0-9_/-]+$/.test(site.basePath)) throw new Error('Invalid base path.');
  if (site.googleAnalyticsId && !/^G-[A-Z0-9]+$/.test(site.googleAnalyticsId)) throw new Error('Invalid GA4 measurement ID.');
  const slugs = new Set();
  for (const o of offers) {
    if (!/^[a-z0-9-]+$/.test(o.slug) || slugs.has(o.slug)) throw new Error('Invalid or duplicate offer slug.');
    slugs.add(o.slug);
    if (!['pending', 'active', 'paused'].includes(o.status)) throw new Error(`Invalid status for ${o.slug}.`);
    if (!['Travel', 'Money', 'Home', 'Food'].includes(o.category)) throw new Error(`Invalid category for ${o.slug}.`);
    if (!o.claim || !['link', 'code'].includes(o.claim.primary) || ['label', 'method', 'mobile', 'desktop', 'check'].some(key => typeof o.claim[key] !== 'string' || !o.claim[key].trim())) throw new Error(`Missing claim instructions for ${o.slug}.`);
    if (o.claim.primary === 'code' && !o.code) throw new Error(`Code-first offer ${o.slug} needs a code.`);
    if (!o.research || !validDate(o.research.checkedAt) || !o.research.label || !o.research.note) throw new Error(`Missing research notes for ${o.slug}.`);
    if (!Array.isArray(o.sources) || !o.sources.length || o.sources.some(s => !s.label || !https(s.url))) throw new Error(`Invalid sources for ${o.slug}.`);
    for (const field of ['name', 'mark', 'category', 'description', 'intro', 'context', 'tip', 'sourceLabel']) if (!o[field]?.trim()) throw new Error(`Missing ${field} for ${o.slug}.`);
    if (!https(o.sourceUrl) || (o.referralUrl && !https(o.referralUrl))) throw new Error(`Invalid HTTPS URL for ${o.slug}.`);
    if (!Array.isArray(o.steps) || !o.steps.length || !Array.isArray(o.terms)) throw new Error(`Missing steps/terms for ${o.slug}.`);
    if (o.questions && (!Array.isArray(o.questions) || o.questions.some(q => !Array.isArray(q) || q.length !== 2 || q.some(value => typeof value !== 'string' || !value.trim())))) throw new Error(`Invalid questions for ${o.slug}.`);
    for (const key of ['availabilityNote', 'rewardSummary', 'referrerReward', 'riskNote', 'market', 'shortName', 'codeInstructions']) if (o[key] !== undefined && (typeof o[key] !== 'string' || !o[key].trim())) throw new Error(`Invalid ${key} for ${o.slug}.`);
    if (o.promotion && (!o.promotion.label || !o.promotion.description || !validDate(o.promotion.startsAt) || !validDate(o.promotion.endsAt) || o.promotion.startsAt > o.promotion.endsAt)) throw new Error(`Invalid promotion for ${o.slug}.`);
    for (const key of ['checkedAt', 'expiresAt']) if (o[key] && !validDate(o[key])) throw new Error(`Invalid ${key} for ${o.slug}.`);
    if (o.checkedAt && o.checkedAt > now.toISOString().slice(0, 10)) throw new Error(`Future check date for ${o.slug}.`);
    if (o.status === 'active' && (!(o.code || o.referralUrl) || !o.reward || !o.eligibility || !o.checkedAt || !o.terms.length)) throw new Error(`Active offer ${o.slug} needs a code/link, reward, eligibility, check date and terms.`);
  }
  if (site.indexable && (!site.origin || !site.owner || !offers.some(o => isLive(o, now)))) throw new Error('Indexing requires an origin, owner and at least one live offer.');
}

export function isLive(o, now = new Date()) {
  return o.status === 'active' && (!o.expiresAt || o.expiresAt >= now.toISOString().slice(0, 10));
}

export async function build({ site, offers, outDir = path.join(root, 'dist'), now = new Date() } = {}) {
  // Explicit configurations (including test fixtures) must not inherit a host's
  // production URL or indexing settings. CLI builds load those from the environment.
  const environment = site === undefined ? process.env : {};
  site ??= JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
  offers ??= JSON.parse(await readFile(path.join(root, 'content/offers.json'), 'utf8'));
  site = { ...site, origin: (environment.SITE_URL ?? site.origin).replace(/\/$/, ''), basePath: (environment.BASE_PATH ?? site.basePath).replace(/\/$/, ''), indexable: environment.INDEXABLE === undefined ? site.indexable : environment.INDEXABLE === 'true' };
  validate(site, offers, now);
  const url = route => `${site.basePath}${route}`;
  const absolute = route => `${site.origin}${url(route)}`;
  const visible = offers.filter(o => isLive(o, now));
  const brands = JSON.parse(await readFile(path.join(root, 'content/brands.json'), 'utf8'));
  for (const o of offers) if (!brands[o.slug] || !/^\/brands\/[a-z0-9-]+\.(png|jpg|svg)$/.test(brands[o.slug].file)) throw new Error(`Missing logo for ${o.slug}.`);
  const badge = o => `<span class="brand-logo" aria-hidden="true"><img src="${url(brands[o.slug].file)}" alt="" width="52" height="52" loading="lazy"></span>`;
  const disclosure = 'These are referral links. The site operator may receive a reward if you sign up and meet the provider’s conditions. Your offer and eligibility are set by the provider.';
  const header = `<header class="site-header"><div class="wrap header-inner"><a class="wordmark" href="${url('/')}" aria-label="${esc(site.name)} home"><img src="${url('/favicon.svg')}" alt="" width="30" height="30">${esc(site.name)}</a><nav aria-label="Main navigation"><a href="${url('/#referrals')}">The referrals</a><a href="${url('/#how-it-works')}">How it works</a><a href="${url('/about/')}" class="nav-about">About</a></nav></div></header>`;
  const analyticsEnabled = Boolean(site.indexable && site.googleAnalyticsId);
  const analyticsControls = analyticsEnabled ? `<section class="analytics-consent" data-analytics-panel hidden aria-labelledby="analytics-title"><h2 id="analytics-title">Help improve this list?</h2><p>With your permission, Google Analytics measures page visits, invitation clicks and code copies. You can use every referral without it. <a href="${url('/privacy/')}">Privacy details</a></p><div><button type="button" class="button button-light" data-analytics-reject>Reject analytics</button><button type="button" class="button button-light" data-analytics-accept>Accept analytics</button></div></section>` : '';
  const footer = `<footer class="site-footer"><div class="wrap"><div class="footer-top"><a class="wordmark" href="${url('/')}">${esc(site.name)}</a><p>Referral codes.<br>Better sign-up rewards.</p><div><a href="${url('/about/')}">About & disclosure</a><a href="${url('/privacy/')}">Privacy</a>${analyticsEnabled ? '<button type="button" class="analytics-settings" data-analytics-settings hidden>Analytics settings</button>' : ''}</div></div><div class="footer-bottom"><span>Independent of the brands featured here.</span><span>Your sign-up companion. © ${now.getUTCFullYear()}</span></div></div></footer>`;
  function page({ title, description, route, body, index = true, schema = [], pageClass = '', pageType = 'WebPage', mainEntity }) {
    const verification = route === '/' && site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : '';
    const canonical = site.origin ? `<link rel="canonical" href="${esc(absolute(route))}"><meta property="og:url" content="${esc(absolute(route))}">` : '';
    const identity = site.origin ? [
      ...(route === '/' ? [{ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${absolute('/')}#website`, name: site.name, alternateName: 'Sign Up Sidekick', url: absolute('/'), inLanguage: 'en-GB' }] : []),
      { '@context': 'https://schema.org', '@type': pageType, '@id': `${absolute(route)}#webpage`, url: absolute(route), name: title, description, inLanguage: 'en-GB', isPartOf: { '@id': `${absolute('/')}#website` }, ...(mainEntity ? { mainEntity } : {}) }
    ] : [];
    const social = site.origin ? `<meta property="og:image" content="${esc(absolute('/social.png'))}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(site.name)}: UK referral codes and sign-up rewards"><meta name="twitter:image" content="${esc(absolute('/social.png'))}">` : '';
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${site.indexable && index ? 'index,follow,max-image-preview:large' : 'noindex,follow'}"><meta name="theme-color" content="#183548">${verification}${canonical}<meta property="og:type" content="${pageClass === 'guide-page' ? 'article' : 'website'}"><meta property="og:locale" content="en_GB"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta name="twitter:card" content="summary_large_image">${social}${analyticsEnabled ? `<meta name="ga4-id" content="${esc(site.googleAnalyticsId)}"><script src="${url('/analytics.js')}" defer></script>` : ''}<link rel="icon" href="${url('/favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="${url('/styles.css')}"><script src="${url('/app.js')}" defer></script><script type="application/ld+json">${json([...identity, ...schema])}</script></head><body class="${pageClass}"><a class="skip-link" href="#main">Skip to content</a>${!site.indexable ? '<div class="preview-banner">Site preview · Search indexing is off until the public address is configured.</div>' : ''}${header}<main id="main">${body}</main>${footer}${analyticsControls}<div class="toast" role="status" aria-live="polite" aria-atomic="true"></div></body></html>`;
  }
  const files = renderPages({ page, site, offers, visible, absolute, isLive, now, url, badge, disclosure });
  const prose = (title, body) => `<div class="wrap prose"><p class="eyebrow">${esc(site.name.toUpperCase())}</p><h1>${title}</h1>${body}</div>`;
  files.set('about/index.html', page({ title: `About & referral disclosure | ${site.name}`, description: 'Who is behind the invitations and how referral rewards support this independent website.', route: '/about/', body: prose('About this list', `<p class="lead">SignUp Sidekick is an independent directory of referral codes and sign-up offers for everyday apps and services. Each guide brings together the advertised reward, eligibility, claim instructions and provider sources.</p><h2>Who gets the reward?</h2><p>${esc(disclosure)}</p><p>This website is independent of the brands listed. It does not process your application or decide whether you receive a reward.</p><h2>The details matter.</h2><p>Each live guide includes the invitation’s reward, eligibility, conditions and the date it was checked. A check date means the invitation details were reviewed; it does not guarantee that a particular person will receive a reward. Offers can change or be withdrawn.</p><h2>Only sign up if it suits you.</h2><p>Read the provider’s terms, fees and requirements. Use a referral for something you wanted to try anyway. For cards and financial products, read the provider’s product information before deciding whether to apply.</p><a class="button button-dark" href="${url('/#referrals')}">Browse the referrals</a>`) }));
  files.set('privacy/index.html', page({ title: `Privacy | ${site.name}`, description: 'A simple explanation of what this website does with your data.', route: '/privacy/', body: prose('Privacy', '<p class="lead">There is no account to create and no email address to hand over here.</p><h2>On this website</h2><p>This site does not collect form submissions. If you accept analytics, Google Analytics uses cookies to measure page visits, invitation clicks and successful code or link copies, including the service name. Google receives technical information such as browser and device details and processes your IP address to provide the service. Advertising signals and ad personalisation are disabled. Analytics does not confirm whether you complete a sign-up with a provider. Search and category filters run in your browser; their contents are not sent to this site’s owner.</p><h2>Your analytics choice</h2><p>Google Analytics loads only after you accept. Rejecting it does not affect referral links or copying codes. Your choice is saved in this browser for six months using local storage. Use Analytics settings in the footer to change your choice. Withdrawing consent stops future tracking and removes accessible Google Analytics cookies; it does not delete information already sent to Google. If browser storage is unavailable, your choice applies only to the current page.</p><p>See <a href="https://policies.google.com/privacy" rel="noopener">Google’s privacy policy</a>. Tracking records the page path, not query strings or fragments. We do not send referral codes, invitation URLs or search-box contents as custom event data.</p><h2>Hosting</h2><p>The hosting provider may process technical request information, such as your IP address and browser details, to deliver and secure the site. Its own privacy policy applies to that processing.</p><h2>Referral links</h2><p>When you follow a referral link, you visit the provider’s website or app. The invitation may include an identifier that lets the provider attribute your sign-up to the referrer. The provider’s privacy and cookie policies apply there.</p><h2>No application information here</h2><p>Applications, payments and account support happen with the provider. Do not send account or payment details to this website.</p>') }));
  files.set('404.html', page({ title: `Page not found | ${site.name}`, description: 'This page could not be found. Browse the referral guides instead.', route: '/404.html', index: false, body: prose('Page not found', `<p class="lead">That page isn’t here. Browse the referral list to find the service you need.</p><a class="button button-dark" href="${url('/#referrals')}">Find a referral</a>`) }));
  // Clear only the explicitly selected output directory, never source or arbitrary paths.
  const resolved = path.resolve(outDir);
  const testRoot = path.join(root, '.test-output');
  if (resolved !== path.join(root, 'dist') && path.dirname(resolved) !== testRoot) throw new Error('Output must be dist or a direct child of .test-output.');
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
  await cp(path.join(root, 'public'), resolved, { recursive: true });
  await mkdir(path.join(resolved, 'qr'), { recursive: true });
  for (const o of visible) {
    const svg = await QRCode.toString(o.referralUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 240 });
    const labelled = svg.replace(/<svg[^>]*>/, tag => `${tag}<title>${esc(o.name)} personal invitation</title><desc>${esc(o.referralUrl)}</desc>`);
    await writeFile(path.join(resolved, 'qr', `${o.slug}.svg`), labelled);
  }
  for (const [file, html] of files) { await mkdir(path.dirname(path.join(resolved, file)), { recursive: true }); await writeFile(path.join(resolved, file), html); }
  const routes = ['/', '/about/', '/privacy/', ...offers.filter(o => isLive(o, now)).map(o => `/guide/${o.slug}/`)];
  await writeFile(path.join(resolved, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site.indexable ? routes.map(r => `<url><loc>${esc(absolute(r))}</loc></url>`).join('') : ''}</urlset>`);
  await writeFile(path.join(resolved, 'robots.txt'), `User-agent: *\nAllow: /\n${site.indexable ? `Sitemap: ${absolute('/sitemap.xml')}\n` : '# Preview pages use noindex meta tags.\n'}`);
  await writeFile(path.join(resolved, '.nojekyll'), '');
  await writeFile(path.join(resolved, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src \'self\'; script-src \'self\' https://www.googletagmanager.com; connect-src \'self\' https://*.google-analytics.com https://www.googletagmanager.com; style-src \'self\'; img-src \'self\' https://*.google-analytics.com https://www.googletagmanager.com; object-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'\n');
  return { files: files.size, outDir: resolved, indexable: site.indexable };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await build());
