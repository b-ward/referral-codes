import { offerMetadata, referralAnswer, guideQuestions, guideSchema, currentPromotion } from './seo.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

export function copyField(o, { home = false, value = o.code, kind = 'code' } = {}) {
  if (!value) return '';
  const id = kind === 'link' ? `link-${o.slug}` : home ? `home-code-${o.slug}` : 'referral-code';
  const label = kind === 'link' ? `${o.name} invitation link` : `${o.name} referral code`;
  return `<div class="copy-field${home ? ' compact-copy' : ''}" data-copy-scope>
    <label ${home ? 'class="sr-only"' : ''} for="${id}">${esc(label)}</label>
    <div class="copy-controls"><input id="${id}" readonly value="${esc(value)}" spellcheck="false" autocapitalize="off" aria-label="${esc(label)}"><button type="button" class="button ${o.claim.primary === 'code' && kind === 'code' ? 'button-dark' : 'button-light'}" data-copy="${esc(value)}" data-copy-kind="${kind}" data-brand="${esc(o.slug)}" hidden>${kind === 'link' ? 'Copy link' : 'Copy code'}</button></div>
    ${!home && kind === 'code' ? `<p class="copy-help">${esc(o.claim.codeNote || 'You can also tap and hold the code to copy it manually.')}</p>` : ''}
  </div>`;
}

export function renderHome({ site, offers, visible, isLive, now, url, badge, disclosure }) {
  const reviewedAt = offers.map(o => o.research.checkedAt).sort().at(-1);
  const rows = visible.map(o => {
    const code = o.code ? copyField(o, { home: true }) : '';
    const link = `<a class="button ${o.claim.primary === 'code' ? 'button-light' : 'button-dark'}" href="${esc(o.referralUrl)}" rel="sponsored noopener" data-referral-brand="${esc(o.slug)}" aria-label="${esc(o.claim.label)}">${o.claim.primary === 'code' ? 'Open app' : 'Open invitation'}</a>`;
    return `<article class="offer-row" data-offer data-name="${esc(`${o.name} ${o.category}`.toLowerCase())}" data-category="${esc(o.category)}">
      <div class="service">${badge(o)}<div><h3><a href="${url(`/guide/${o.slug}/`)}">${esc(o.name)}</a></h3><span class="category-label">${esc(o.category)}</span></div></div>
      <div class="row-offer"><p class="row-reward">${esc(o.reward)}</p><p>${esc(o.eligibility)}</p><span class="claim-method">${esc(o.claim.method)}</span>${o.riskNote ? '<span class="card-risk">Capital at risk. Read the product terms.</span>' : ''}</div>
      <div class="row-actions">${o.claim.primary === 'code' ? `${code}${link}` : `${link}${code}`}<a class="guide-link" href="${url(`/guide/${o.slug}/`)}">${esc(o.shortName || o.name)} claim guide</a></div>
    </article>`;
  }).join('');
  const inactive = offers.filter(o => !isLive(o, now));
  return `<section class="hero wrap">
    <div class="hero-copy"><p class="eyebrow">BRENDON’S PERSONAL REFERRAL LIST</p><h1>Referral codes.<br><em>Yours to use.</em></h1><p class="hero-description">I’ve put my invitations in one place, along with what you get and how to use them. Pick something you were going to try anyway.</p><a class="text-link" href="#referrals">Browse the list</a></div>
    <aside class="owner-note" aria-label="A note from Brendon"><p class="note-label">A note from Brendon</p><p>If you use one of my links, I may get a reward too. The conditions sit next to each offer so you can check it’s worth your while.</p><span class="art-caption">A small perk for a fresh start.</span></aside>
  </section>
  <section class="wrap referrals-section" id="referrals">
    <div class="section-heading"><div><p class="eyebrow">THE LIST</p><h2>Find an app.</h2></div><p>${visible.length} invitations · Details reviewed ${esc(date(reviewedAt))}</p></div>
    <div class="filter-bar" data-filters hidden><div class="filter-buttons" role="group" aria-label="Filter referrals">${['All referrals', 'Travel', 'Money', 'Home', 'Food'].map((c, i) => `<button type="button" class="filter-button" data-filter="${i ? c : 'all'}" aria-label="${c}" aria-pressed="${i === 0}">${i ? c : 'All'}</button>`).join('')}</div><div class="search-box"><label class="sr-only" for="search">Search referral guides</label><input type="search" id="search" placeholder="Search by name…" autocomplete="off"></div></div>
    <p class="sr-only" id="results-count" role="status" aria-live="polite"></p>
    <div class="directory-heading" aria-hidden="true"><span>APP OR SERVICE</span><span>WHAT YOU GET</span><span>USE THE INVITATION</span></div>
    <div class="offer-list">${rows}</div><div class="empty-state" hidden><h3>No matches this time.</h3><p>Try another name or browse the whole list.</p><button class="button button-dark" data-reset type="button">Show all referrals</button></div>
    <p class="disclosure-note">${esc(disclosure)} <a href="${url('/about/')}">About these links</a></p>
    ${!site.indexable && inactive.length ? `<details class="inactive-list"><summary>Unavailable invitations (${inactive.length})</summary><p>These are retained for reference, with no claim buttons.</p><ul>${inactive.map(o => `<li><a href="${url(`/guide/${o.slug}/`)}">${esc(o.name)}</a> — ${esc(o.research.label)}</li>`).join('')}</ul></details>` : ''}
  </section>
  <section class="how-section" id="how-it-works"><div class="wrap"><h2>Before you sign up</h2><ol class="steps-grid"><li><h3>Check the offer</h3><p>Read the amount, minimum spend and eligibility. Some rewards go only to the person who invited you.</p></li><li><h3>Use the right route</h3><p>Use the personal link before joining, or paste the code where the guide tells you. An ordinary app download may miss the referral.</p></li><li><h3>Check it’s applied</h3><p>Look for the reward in the provider’s app or checkout before you spend. The provider’s live terms take precedence.</p></li></ol></div></section>`;
}

export function renderGuide({ o, live, site, url, badge, questions, faq, answer, promotion, related }) {
  const link = live ? `<a class="button ${o.claim.primary === 'code' ? 'button-light' : 'button-dark'} claim-link" href="${esc(o.referralUrl)}" rel="sponsored noopener" data-referral-brand="${esc(o.slug)}">${esc(o.claim.label)}</a>` : '';
  const code = live && o.code ? copyField(o) : '';
  const phone = live ? `<details class="phone-handoff"><summary>Use this invitation on your phone</summary><img src="${url(`/qr/${o.slug}.svg`)}" alt="QR code for the personal ${esc(o.name)} invitation" width="220" height="220" loading="lazy"><p>Scan with your phone’s camera. This opens the same personal invitation.</p>${copyField(o, { value: o.referralUrl, kind: 'link' })}</details>` : '';
  const claim = `<aside class="claim-panel" id="claim" aria-labelledby="claim-title"><div class="claim-top">${badge(o)}<span>${live ? 'THE INVITATION' : 'UNAVAILABLE'}</span></div><h2 id="claim-title">${live ? esc(o.reward) : 'Offer unavailable'}</h2><p>${esc(live ? o.eligibility : o.availabilityNote || 'There is no live invitation to claim here.')}</p>${live && o.riskNote ? `<p class="risk-note">${esc(o.riskNote)}</p>` : ''}${o.claim.primary === 'code' ? `${code}${link}` : `${link}${code}`}${live ? `<p class="claim-check">${esc(o.claim.check)}</p>${phone}<p class="small">Details checked <time datetime="${o.research.checkedAt}">${esc(date(o.research.checkedAt))}</time></p>` : ''}<p class="claim-disclosure">I may receive a reward if a qualifying referral is completed.</p></aside>`;
  const sources = (o.sources || [{ label: o.sourceLabel, url: o.sourceUrl }]).filter(s => live || s.url !== o.referralUrl);
  return `<div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${url('/#referrals')}">All referrals</a><span aria-hidden="true">/</span><span>${esc(o.name)}</span></nav>
    <div class="guide-layout"><header class="guide-heading"><p class="eyebrow">${esc(o.category)} · ${esc(o.market || 'UK')}</p><h1>${esc(o.name)} referral code</h1><p class="guide-intro">${esc(live ? o.intro : o.availabilityNote || o.intro)}</p><p class="byline">${site.owner ? `By <a href="${url('/about/')}">${esc(site.owner)}</a> · ` : ''}${esc(o.research.label)}</p></header>
    ${claim}
    <article class="guide-article" id="guide"><nav class="on-this-page" aria-label="On this page"><a href="#claim">Invitation</a><a href="#quick-answer">The reward</a><a href="#how-to-claim">How to use it</a><a href="#offer-terms">Conditions</a><a href="#questions">Questions</a></nav>
      <section id="quick-answer"><h2>The referral, at a glance</h2><p class="answer-text">${esc(answer)}</p>${live ? `<dl class="offer-facts"><div><dt>You get</dt><dd>${esc(o.reward)}</dd></div><div><dt>How to apply</dt><dd>${esc(o.claim.method)}</dd></div><div><dt>Who qualifies</dt><dd>${esc(o.eligibility)}</dd></div>${o.referrerReward ? `<div><dt>Referrer benefit</dt><dd>${esc(o.referrerReward)}</dd></div>` : ''}${o.expiresAt ? `<div><dt>Offer ends</dt><dd>${esc(date(o.expiresAt))}</dd></div>` : ''}</dl>` : ''}</section>
      <section id="how-to-claim"><h2>How to use the ${esc(o.shortName || o.name)} referral</h2><div class="device-instructions"><div><h3>On your phone</h3><p>${esc(o.claim.mobile)}</p></div><div><h3>On a computer</h3><p>${esc(o.claim.desktop)}</p></div></div>${live ? `<ol class="claim-steps">${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="useful-note">${esc(o.tip)}</p>` : ''}</section>
      <section id="offer-terms"><h2>Conditions worth reading</h2>${promotion ? `<div class="useful-note promotion"><h3>${esc(promotion.label)}</h3><p>${esc(promotion.description)}</p><p>Join between <time datetime="${promotion.startsAt}">${esc(date(promotion.startsAt))}</time> and <time datetime="${promotion.endsAt}">${esc(date(promotion.endsAt))}</time>.</p></div>` : ''}<ul class="terms-list">${o.terms.map(s => `<li>${esc(s)}</li>`).join('')}</ul><p>${esc(o.context)}</p></section>
      <section id="questions"><h2>${esc(o.shortName || o.name)} referral questions</h2>${faq(questions)}</section>
      <section class="source-section"><h2>What I checked</h2><p>${esc(o.research.note)}</p><p class="small">Public information checked ${esc(date(o.research.checkedAt))}. This is a check of invitation details, not a test redemption.</p><ul>${sources.map(s => `<li><a href="${esc(s.url)}" rel="${s.url === o.referralUrl ? 'sponsored noopener' : 'noopener'}">${esc(s.label)}</a></li>`).join('')}</ul>${!live ? '' : `<p><a href="#claim">Back to the invitation</a></p>`}</section>
    </article></div>
    <section class="related-section"><h2>Also in ${esc(o.category.toLowerCase())}</h2><div class="related-links">${related.map(x => `<a href="${url(`/guide/${x.slug}/`)}">${badge(x)}<span>${esc(x.name)} referral<small>${esc(x.reward)}</small></span></a>`).join('')}</div></section>
  </div>`;
}

export function renderPages(context) {
  const { page, site, visible, offers, absolute, isLive, now, disclosure } = context;
  const faq = items => `<div class="faq-list">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  const home = page({ title: `UK referral codes & sign-up rewards | ${site.name}`, description: site.description, route: '/', pageType: 'CollectionPage', mainEntity: { '@type': 'ItemList', name: 'UK referral codes and sign-up offers', itemListElement: visible.map((o, i) => ({ '@type': 'ListItem', position: i + 1, name: `${o.name} referral code`, url: absolute(`/guide/${o.slug}/`) })) }, body: renderHome(context) });
  const files = new Map([['index.html', home]]);
  for (const o of offers) {
    const live = isLive(o, now);
    const route = `/guide/${o.slug}/`;
    const metadata = offerMetadata(o, live);
    const schema = guideSchema({ o, live, site, absolute, route, ...metadata });
    const related = visible.filter(x => x.slug !== o.slug && x.category === o.category).slice(0, 3);
    files.set(`guide/${o.slug}/index.html`, page({
      title: `${metadata.title} | ${site.name}`, description: metadata.description, route, index: live, schema, pageClass: 'guide-page',
      mainEntity: live ? { '@id': `${absolute(route)}#guide` } : undefined,
      body: renderGuide({ ...context, o, live, faq, questions: guideQuestions(o, live, disclosure), answer: referralAnswer(o, live), promotion: live ? currentPromotion(o, now) : null, related })
    }));
  }
  return files;
}
