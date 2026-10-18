# Ballot Argument Access

A runnable, MIT-licensed reference application implementing the seven functional workflows in Section 3(b) of **Ballot Argument Access Act v1**, the proposal supplied with this project. It provides a public filing portal, an elections-official workspace, and a free JSON publication feed.

**Status:** working reference implementation, not a certified state filing service. No current Secretary of State functional specifications or certification were supplied. Official reference datasets, an approved identity/signature policy, and a notification delivery service must be configured before real use. The conformance matrix identifies these dependencies explicitly.

## Orange County and GitHub Pages

The demo now includes all 15 Orange County measures (A–O) for November 3, 2026, with links to the official OC Vote PDFs. Display titles are short summaries; all practice deadlines are explicitly fictional.

Run `npm run preview:pages` for the browser-only GitHub Pages edition at http://127.0.0.1:8788/ballot-argument-access/. Run `npm run build:pages` to generate the deployable `dist/` folder. The included GitHub Actions workflow tests, builds and deploys it. [Pages setup and limitations](docs/GITHUB_PAGES.md).

**Pages is a local practice simulation:** no actual filings, shared database, official timestamps or emails. The full Node server remains included for server deployments.

## Run locally

Install Node.js 22.14 or newer, then in this directory run:

```sh
npm run demo
```

Open **http://127.0.0.1:8787**. The terminal prints a randomly generated official access key. Use it in **Official workspace**. No npm packages or installation step are required; the application uses Node's built-in HTTP, cryptography, and SQLite modules. Node 22 may print an experimental SQLite warning.

Demo mode adds the 15 sourced Orange County example measures. It does not send email or load authoritative reference datasets. Use invented personal details. Signing links are exposed to the demo filer for exercising the workflow; production sends them only through the configured private notification service.

1. Select **Prepare a filing**, enter an argument, and check its word count.
2. Add up to five authors and any additional proper-name designations.
3. Create the immutable signing packet. Save its private page URL.
4. Open each demo author link, review the text and accompanying statement, and digitally sign.
5. Return to the packet, refresh signature status, and submit.
6. Download the timestamped receipt. In the official workspace, review names and inspect signature evidence.

To exercise deadline publication and opposing-argument delivery quickly, create a second measure whose argument deadline is a few minutes away. Use explicit timestamps with UTC offsets. Submit arguments on both sides before close. The public records page and notification outbox update after close; the official can then record a printing selection and its basis. Demo deadlines are persisted, not moved forward on restart.

## Included features

- Arguments and rebuttals routed to configurable California jurisdictions, with a configurable Section 9600 statement and word limits per measure.
- Independent P-256 / SHA-256 signatures from each author over identical immutable text, declaration, author roster, and measure identity. Private keys remain in the browser; the server verifies signatures.
- Atomic, durable, idempotent filing and UTC receipts with a content digest. Over-limit submissions receive receipts and remain available for official review.
- Unadjusted and adjusted counts, itemized Section 9 adjustments, provenance-backed reference imports, and official review of additional proper names.
- Free HTML and JSON publication of all filed arguments and rebuttals at their respective filing deadlines, plus impartial analyses and tax rate statements.
- Durable opposing-argument and selection notices, delivery retries, and an official outbox view.
- Jurisdiction-scoped official permissions, private capability links, public contact-data minimization, and a chained audit log.
- Responsive, keyboard-accessible forms with labels and visible focus states.

## Verification

```sh
npm test
npm run check
```

The automated suite covers counting rules, dictionary age limits, pending noun claims, signature tampering, multi-author submission, exact deadline boundaries, publication and privacy, opposing copies, selection notifications, jurisdiction isolation, reference-import atomicity, persistence, HTTP security, and failed delivery retries.

The delivered build was also exercised in a real headless Edge browser: draft creation, word counting, browser cryptographic signing, final submission, receipt display, official name review, and a 390-pixel mobile viewport. Browser testing found no JavaScript errors or horizontal overflow. This is not a formal accessibility or penetration-test certification.

## Documentation

- [Section 3 conformance matrix](docs/CONFORMANCE.md)
- [Deployment and operational dependencies](docs/DEPLOYMENT.md)
- [API and integration contract](docs/API.md)
- [Word-count policy and legal sources](docs/WORD_COUNT.md)
- [Security and contribution notes](SECURITY.md)

## Project layout

`src/service.js` holds the filing rules; `src/count.js` the auditable counter; `src/store.js` SQLite and audit persistence; `src/server.js` HTTP and notification delivery; `public/` the browser interface; and `test/` the automated tests. `data/` is created on first run and is excluded from the release archive and version control.

This project does not assess the merits of arguments or automatically rank them for printing. Elections officials enter their determination and the applicable statutory basis. The proposal is the requirements source, not an enacted-law assertion. The application does not charge filing or reading fees; hosting and maintenance still have real operating costs.
