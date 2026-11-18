# SignUp Sidekick — personal referral guides

Static HTML and small vanilla JavaScript, with no server runtime or database. Brand: **SignUp Sidekick** (spoken as “Sign Up Sidekick”). No domain has been registered. A pinned build-time QR encoder creates local SVG handoff codes; it is not sent to visitors as JavaScript.

## Local use

Requires Node 22+. Install the locked build dependencies once after checkout.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
npm run check
npm run build
```

Build output is `dist/`. Restart the preview after editing content.

## Offers

Edit `content/offers.json`. The owner supplied invitations on 18 November 2026. There are 16 guides: 14 active invitations, plus inactive EatClub and Binance entries. Yonder is active with code `IZGYLZM`. Invitations have not been independently redeemed.

- `referralUrl`: exact HTTPS personal URL, with all query parameters preserved.
- `code`: only a supplied manually redeemable code. Forest, Uber Eats and Yonder have codes. Identifiers inside other links are not assumed redeemable. `codeInstructions` can specify checkout rather than sign-up use.
- `reward`, `eligibility`, `terms`: the actual invitation's reward, caps, requirements, fees and deadlines. Do not copy another person's offer.
- `checkedAt`: the date invitation details were reviewed, not a rolling build date or proof of redemption.
- `expiresAt`: optional known expiry (`YYYY-MM-DD`, inclusive UTC). Expired offers lose claim actions and leave the public listing/sitemap on the next build.
- `status`: `pending`, `active` or `paused`. Active requires a code/link, reward, eligibility, check date and terms.
- `steps`, `context`, `tip`, `sourceUrl`: keep each guide specific and supported by the provider's information. Review against the actual invitation before launch.
- `questions`: service-specific question/answer pairs rendered as readable HTML FAQs. Update these alongside the reward and terms so limits, eligibility and code instructions remain accurate.

The main directory shows active offers in both preview and public builds. Preview has a separate unavailable-invitations section; paused/expired guide pages remain `noindex` and outside the sitemap, without claim buttons or QR handoffs. All 16 guide files are retained. Forest's reward amount and Voi's ride allowance are not publicly confirmed.

Categories are exactly **Travel, Money, Home and Food**. Each offer has a `claim` object with its primary action (`link` or `code`), label, method, phone instructions, desktop instructions and final reward check. These fields drive the guide and the directory's direct action. Copying uses the field belonging to the clicked button, including clipboard-denied fallback.

`research` records the checked date, an honest evidence label and what was/was not confirmed. `sources` lists the provider help pages and, where useful, the actual personal landing page. A reviewed source is not a tested redemption. In particular:

- Plum's published help says referral programmes reward the inviter, not the new user. The earlier £25-each claim has been removed from the visitor offer.
- Gopuff's indexed UK help specifies £30 of eligible items for the £15 discount; checkout must confirm the current basket conditions.
- The Yonder personal landing page confirms the Premium Credit offer: up to 20,000 points after £1,000 spend in 30 days, £17.99/month and 73.1% representative APR at the time checked.
- J.P. Morgan's ongoing referral help is distinct from its expired generic six-month promotion. The guide points to the referral help and asks visitors to read the interactive personal invitation.
- Wise describes a transfer discount or card offer depending on invitation/country; a fixed personal visitor amount was not exposed publicly. The reported A$30 is not described as a visitor cash payment.

## Brand assets and phone handoffs

Real provider/app icons are stored in `public/brands/`. `content/brands.json` records the official website or developer App Store listing, asset URL, download date and SHA-256 of each unmodified file. Logos identify the services; the site is independent of those brands. Browser visits load these assets locally rather than contacting an icon API.

The optional maintenance scripts `research-assets.py`, `research-invitations.py` and `download-logos.py` use Python's standard library and write temporary discovery results to ignored `.research/`. Review discoveries before updating content; source retrieval does not validate the offers automatically.

Builds generate `/qr/<slug>.svg` from each active original invitation URL, with a standard quiet zone and error correction. The desktop handoff includes a QR code and copy-link option. It never substitutes an ordinary app-store URL for the personal invitation. No QR service receives the referral URL. The generated site remains fully static.

- `availabilityNote`: explains why a paused offer has no public claim link. EatClub excludes public referral sites; Binance's USDC incentive is inactive on this UK-focused site in light of FCA guidance on crypto incentives. Their original URLs remain in source content.
- `rewardSummary` and `referrerReward`: distinguish the visitor offer from the owner's benefit. Wise's A$30 is reported as a referrer reward, and eToro has no confirmed visitor bonus.
- `market`: country/availability label. Unknown-country invitations do not automatically claim UK eligibility in their search titles.
- `riskNote`: visible investment risk context, used for J.P. Morgan Personal Investing and eToro.
- `promotion`: optional `label`, `description`, `startsAt` and `endsAt` for a dated extra offer. Lebara's 10 November–1 December 2026 Black Friday section is separate from the standard three-month discount. A rebuild hides the dated section outside that interval; it does not independently re-verify the standard offer.

## Before launch

Edit `content/site.json`: choose `name`, set `origin` to the canonical HTTPS domain (no path), set `owner` to your public author name, and set `indexable: true`. `basePath` is empty for a root domain. `SITE_URL`, `BASE_PATH` and `INDEXABLE` environment variables override these values.

The draft uses Brendon as the public author, has no invented domain, and keeps indexing off. Indexable builds require an origin, owner and live offer. Keep temporary preview domains `INDEXABLE=false`.

## Recommended hosting: Cloudflare

The files work on Workers Static Assets or Pages, with no database or functions. Static asset requests are currently free and unlimited; platform/build limits still apply. Cloudflare recommends Workers for new projects; `wrangler.jsonc` configures an assets-only deployment.

### Workers with GitHub integration

1. Use the Cloudflare Worker named `referral-codes` (matching `wrangler.jsonc`), connecting `b-ward/referral-codes` through Git integration. The public site brand remains SignUp Sidekick.
2. Production branch: `main`. Root directory: the repository root. Build command: `npm ci && npm run check && npm run build`. Deploy command: `npx wrangler deploy`. The existing Wrangler file supplies `dist` as the static assets directory.
3. Under **Settings → Build**, configure build variables, not runtime variables: initially `INDEXABLE=false`. After the first deployment, set `SITE_URL` to the actual public HTTPS origin (no path), keep `BASE_PATH` empty, and set `INDEXABLE=true` when ready for search. Trigger another build after changing these values. If selecting a custom domain, use that canonical origin. Explicit test configurations are isolated from these production build variables.
4. Add your chosen custom domain in Cloudflare. Rebuild when changing domains so canonical links and sitemap match it.
5. Pushes trigger builds. For expiry removal without a push, configure a scheduled build trigger, or rebuild during regular offer reviews. Static content does not change at midnight by itself.

Wrangler is a deployment utility, not a website runtime dependency. Do not deploy until the account and target are selected.

### Pages alternative

Connect the repo to Pages. Framework: None. Build: `npm run check && npm run build`. Output: `dist`. No functions. Set production environment variables as above; keep branch previews `INDEXABLE=false`.

## GitHub Pages alternative

Review GitHub Pages' restriction on sites primarily directed at facilitating commercial transactions before selecting it. A referral site earning rewards may be an awkward fit.

1. Repository Settings → Pages → build source **GitHub Actions**.
2. Set Actions variable `ENABLE_GITHUB_PAGES=true`. Deployment is disabled until this is set, avoiding duplicate public copies if another host is selected.
3. Fill the author name in site config. Set Actions variable `SITE_INDEXABLE=true` when ready for search.
4. Optionally configure a custom domain and HTTPS in Pages settings. The workflow uses the origin/base path from `configure-pages` for canonical URLs and project subpaths.
5. Push to main or run manually. The daily rebuild handles known expiry dates, not offer verification. GitHub may disable scheduled workflows after prolonged inactivity.

## Search and verification

- Real HTML pages at `/guide/lime/`, `/guide/forest/`, etc. with unique titles, descriptions and visible claim instructions. JavaScript enhances search, filters and copying; the directory, native QR disclosures, instructions and selectable codes work without it.
- Canonicals, WebSite/CollectionPage/Article/Breadcrumb structured data, PNG social previews, `robots.txt`, `sitemap.xml`, real 404 page and descriptive internal links. Author markup uses only your configured public name. No invented ratings, reviews, reward values or FAQ rich-result promises.
- Each guide's search title and main heading include the service and referral offer. A visible answer summary explains whether to use a code or invitation link, the reward and eligibility. FAQs cover service-specific questions, missing rewards and unknown expiry dates. Offer data drives titles and summaries; paused/expired invitations do not keep advertising a live offer in search metadata.
- AI answer visibility uses the same clear, crawlable content as ordinary search. There is no special AI schema or guaranteed inclusion. The site does not block search crawling or set snippet restrictions on live pages. Preview pages remain `noindex` until a real public origin and author are configured.
- A custom domain helps memorability, trust and moving hosts; it is not required for ranking or a shortcut to first place. Check availability and trademarks before buying.
- Submit the canonical sitemap to Google Search Console after launch. Inspect each guide and verify live HTTP responses and indexing.
- Test exact deep links on iOS/Android with eligible new accounts. Automated browser fetches could not inspect them; do not label them independently verified.
- Review offer accuracy and your own programme's public-sharing terms regularly. Add useful first-hand details when available rather than repetitive keyword/city pages.
- Review the privacy page once the host is selected. Public builds enable optional GA4 only after consent; previews do not load analytics. The browser remembers the choice for 180 days. Footer Analytics settings allows withdrawal. Custom events: referral_click, referral_code_copy and referral_link_copy, each with the brand slug.
- `public/social.png` is the committed 1200×630 sharing image, referenced with an absolute URL when the origin is configured. `public/social.svg` is an editable source concept. On Windows, regenerate the PNG with `./scripts/render-social.ps1`; this is not part of the dependency-free build.

## Sources

- [GitHub Pages limits/policy](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Cloudflare static pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Workers builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google domain/ranking FAQ](https://developers.google.com/search/help/site-position-in-search-faq)
- [Google guidance for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
