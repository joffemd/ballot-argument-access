# Orange County example and GitHub Pages

The project has two deployment modes:

| Mode | Storage and behavior |
| --- | --- |
| GitHub Pages | Static interactive showcase. Real Orange County measure names and official PDF links; practice packets, cryptographic signatures, counts, receipt previews and official-review simulation are stored in the visitor's browser only. No actual filing, shared records, reliable server time, or notification delivery. |
| Node server | The original SQLite-backed filing reference implementation, with scoped officials, verified server-side signatures, server timestamps and notification gateway integration. Requires a server host and the documented agency/operational approvals. |

GitHub Pages cannot execute the Node server or operate the SQLite database. See [GitHub's description of static Pages hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). The Pages build is explicitly a practice demo, not a Section 3 production filing service.

## Example source

The 15 measures, A through O, are from the [Orange County Registrar of Voters' November 3, 2026 measure index](https://ocvote.gov/elections/assigned-measure-letters-november-3-2026), checked October 16, 2026. `public/orange-county.js` contains stable IDs, jurisdictions, short descriptive titles, election date, index provenance and verified PDF destinations. The short titles are summaries; read the linked official documents for the exact ballot wording, arguments, analyses and other materials. The application does not invent or attribute arguments to real authors.

Practice filing deadlines are generated for exploration and explicitly marked as fictional. They are not Orange County's 2026 argument deadlines. The real election date stays November 3, 2026. The demo's reference lists start empty, so proper names still require designation/review or an import; the OC example is not a substitute for the required statewide reference sources.

## Run and preview

```sh
npm test
npm run build:pages
npm run preview:pages
```

Open `http://127.0.0.1:8788/ballot-argument-access/`. Preview deliberately uses a repository subdirectory to test project-site asset URLs. The generated `dist/` contains only static assets from an explicit allowlist; no SQLite files, credentials, logs or local practice submissions are included.

## Publish

The included `.github/workflows/pages.yml` runs the tests, builds `dist/`, uploads the Pages artifact and deploys it using the `github-pages` environment. In the GitHub repository, select **Settings → Pages → Source → GitHub Actions**. Push to `main` or run **Test and deploy Pages demo** from Actions. The workflow needs `contents: read` for its build and `pages: write` plus `id-token: write` only for deployment. It requires no personal token, server secret, or paid hosting service.

Static assets and hash routes use relative URLs, so the site works at both `https://OWNER.github.io/ballot-argument-access/` and a custom-domain root. The `measures.json` file is a free machine-readable catalog of the sourced example measures, not a feed of real submissions.

## Try the practice workflow

1. Open any measure and create a packet using fictitious names and example.org email addresses.
2. Open the demo signature links in the same browser profile. These links do not allow signing across devices because the data is local.
3. Sign and submit to see a **practice receipt**. Signatures use actual browser cryptography, but the local receipt is not an official acknowledgement.
4. Open **Official workspace**. In static mode it is an openly accessible simulation, not a protected administration panel.
5. Use **Close practice period and publish locally** for the measure to reveal practice records and generate local opposing-copy previews. Review noun designations and enter a simulated printing selection.
6. Use **Reset practice data** to clear the application's local data and start again. Clearing browser storage also erases the practice data.

There are no emails or network writes. GitHub serves the page and its normal hosting logs; following an OC Vote source link opens that external site. Anyone with access to the browser profile or its developer tools can inspect or alter local practice data. Use the server edition for evaluating actual access controls and durable filing behavior.
