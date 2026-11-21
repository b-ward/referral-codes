// Search titles and answer content share the same offer data as the visible claim panel.
// Do not infer a manually redeemable code from an identifier in a deep link.
export function offerMetadata(offer, live) {
  const title = `${offer.name} referral code${!offer.market || offer.market === 'UK' ? ' UK' : ''}`;
  if (!live) return { title: `${title}: offer unavailable`, description: `${offer.name} referral guide. There is currently no live personal invitation on this page. Check back for a referral link, offer details and claim instructions.` };
  return {
    title: `${title}: ${offer.reward}`,
    description: `${offer.name} referral: ${offer.reward}. ${offer.eligibility} ${offer.code ? `Use code ${offer.code} or the invitation link.` : 'Get the personal invitation link and claim steps.'}`
  };
}

export function referralAnswer(o, live) {
  if (!live) return o.availabilityNote || `There is currently no live ${o.name} referral invitation on this page. Reward and claim details will appear when an invitation is available.`;
  return `${o.code ? `The ${o.name} referral code is ${o.code}. ${o.codeInstructions || 'Use it or the personal invitation link when signing up.'}` : `This ${o.name} referral uses a personal invitation link; no manually redeemable code is provided on this page.`} ${o.rewardSummary || `The invitation advertises ${o.reward}.`} ${o.eligibility}`;
}

export function currentPromotion(o, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return o.promotion && o.promotion.startsAt <= today && o.promotion.endsAt >= today ? o.promotion : null;
}

export function guideQuestions(o, live, disclosure) {
  if (!live) return [
    [`Is there a live ${o.name} referral on this page?`, referralAnswer(o, false)],
    ['Does the site owner receive a reward?', disclosure]
  ];
  return [
    ...(o.questions || [[`How does this ${o.name} referral work?`, referralAnswer(o, true)]]),
    [`When does this ${o.name} invitation expire?`, o.expiresAt ? `The recorded offer end date is ${o.expiresAt}. Check the provider’s invitation for any separate reward expiry or qualifying-activity deadline.` : `No fixed end date was supplied with this invitation. That does not mean it is permanent. Check ${o.name} for the current expiry and any deadline to complete qualifying activity.`],
    [`Why might the ${o.name} referral not work?`, 'The invitation may have expired, reached a referral limit, or be restricted to another account or location. Confirm that you followed its sign-up instructions before creating an account. Contact the provider through official support if an eligible reward is missing.'],
    ['Does the site owner receive a reward?', disclosure]
  ];
}

export function guideSchema({ o, live, site, absolute, route, title, description }) {
  if (!site.origin) return [];
  const canonical = absolute(route);
  return [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Referral codes', item: absolute('/') },
      { '@type': 'ListItem', position: 2, name: `${o.name} referral guide`, item: canonical }
    ]
  }, ...(live ? [{
    '@context': 'https://schema.org', '@type': 'Article', '@id': `${canonical}#guide`,
    headline: title, description, inLanguage: 'en-GB',
    mainEntityOfPage: { '@id': `${canonical}#webpage` },
    about: { '@type': 'Thing', name: o.name },
    citation: o.sourceUrl,
    ...(site.owner ? { author: { '@type': site.ownerType || 'Person', name: site.owner, url: absolute('/about/') } } : {})
  }] : [])];
}
