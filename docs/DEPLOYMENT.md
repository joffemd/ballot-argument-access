# Deployment

## Runtime and storage

Use a supported Node.js release with `node:sqlite` (22.14 or later). No third-party npm packages are required. Run a single application process on one host with durable local storage and a TLS reverse proxy. The SQLite implementation is intended for evaluation and modest single-host deployments; it is not a demonstrated statewide-capacity architecture. Benchmark real roster sizes, concurrent signing, deadline surges and large opposing-argument fan-outs before sizing a production installation. The current reference matcher scans the imported list; a trie or other indexed matcher is appropriate at statewide entity-registry scale.

Production startup deliberately requires explicit configuration:

```sh
ADMIN_TOKEN=<cryptographically-random-secret-at-least-32-characters>
BASE_URL=https://ballot.example.gov
NOTIFY_WEBHOOK=https://delivery.example.gov/ballot-notices
NOTIFY_TOKEN=<delivery-service-secret>
SIGNATURE_POLICY_APPROVED=yes
PORT=8787
HOST=127.0.0.1
DB_PATH=/var/lib/ballot-access/ballot.sqlite
OFFICIALS_FILE=/etc/ballot-access/officials.json
```

Set these as environment variables through your operating system or service manager, then run `npm start`. The example is a configuration list, not a shell script to paste verbatim on every platform. The flag records operator acknowledgement; it does not certify the signature policy. In production the admin secret is never printed by the application.

For PowerShell, environment settings use `$env:NAME='value'`. Generate an administrative key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep credentials out of source control. Use `npm run demo` only on loopback for demonstrations.

Preserve the original public `Host` header through the reverse proxy. Terminate TLS there, restrict direct application access, and impose request/body/connection rate limits. The application checks Host and Origin, uses JSON mutations and bearer authorization, serves no cross-origin API, and sets a restrictive content security policy. Use separate service identities and protect the database and environment with OS permissions.

## Official access

The state administrator has `jurisdictions: "*"`. Additional officials are loaded at startup from JSON:

```json
[
  {"id":"county-official-01","tokenHash":"SHA256_HEX_OF_RANDOM_ACCESS_KEY","jurisdictions":["Example County"]},
  {"id":"city-official-01","tokenHash":"SHA256_HEX_OF_ANOTHER_KEY","jurisdictions":["Example City"]}
]
```

Generate separate random keys for each official, hash them with SHA-256 for this file, and deliver the plaintext keys securely. The exact jurisdiction names must match measures. Restart after revoking or changing a key. The reference implementation uses bearer keys in browser memory; integrate agency SSO/MFA and an established access lifecycle for real users. The official UI never stores its access key in local storage.

## Signature policy

The implementation uses certificate-free public-key signatures. A 256-bit invitation capability is delivered privately to the stated author's email. That browser generates a nonexportable P-256 private key, signs the exact server-provided packet bytes after explicit consent, and sends the public key and signature for verification. The private key exists only in the signing session and is not sent to the server. The signature covers the argument, accompanying statement, measure identity, author roster and claimed proper names.

Email possession and self-attested names do not independently prove legal identity or voter eligibility. Agency personnel must approve the assurance level under the applicable regulations. If an agency requires identity proofing, certificates, a different enrollment model, or a hardware-backed signer, integrate that policy before accepting real signatures. This implementation does not parse X.509 certificates or validate revocation chains. See the Secretary of State sources in WORD_COUNT.md. No typed-name-only signature is accepted by the API.

## Notification gateway

The application POSTs JSON with `Authorization: Bearer <NOTIFY_TOKEN>` and `Idempotency-Key: <message-id>`:

```json
{"id":"opposition:filing-id:author-id","to":"author@example.org","subject":"Opposing arguments for rebuttal preparation","body":{"measureId":"...","deadline":"2028-08-11T00:00:00.000Z","arguments":[{"text":"Full opposing argument","authors":[{"name":"Example"}]}]}}
```

The gateway must authenticate requests, deduplicate IDs, turn the **complete body** into an email or agreed notification, and durably accept it before returning 2xx. Use a gateway that supports delivery/bounce monitoring and attachment or long-message handling, so complete opposing texts are delivered even for many filings. A gateway that merely logs or silently truncates JSON does not satisfy transmission requirements. The application does not implement an SMTP server.

Failures stay pending with exponential backoff capped at five minutes, and remain visible to the administrator. Delivery is at-least-once: a crash after gateway acceptance but before saving the status may resend a request. The gateway's idempotency key makes this safe. A `delivered` status means gateway acceptance, not confirmed inbox receipt. Monitor bounces at the gateway. Invitations and access links in the outbox are sensitive, even though public records omit them.

The deadline worker checks every second, queues each author's opposing-copy notice once, and prioritizes those messages. Public records become available based on the timestamp directly and do not wait for that worker. Keep the process supervised and clock synchronized. Restart catches up due work, but an outage can still violate immediate transmission or the 24-hour publication obligation. Alert on pending notices, old attempts, clock drift and public endpoint failures.

## Reference data

Obtain official Controller agency rosters, SOS business-entity and nonprofit-corporation records, and USGS GNIS names under their actual access and reuse terms. No authenticated records were acquired for this build. Normalize official names into one name per line for the admin import form or a `names` array for the API. Preserve source URLs, retrieval dates and import evidence. Import large datasets in batches of at most 50,000 names and under the 4 MB request limit. The import operation adds or updates names; it does not erase history or automatically remove obsolete names.

Dictionary imports require publication year and source evidence. Only dictionary entries from the ten calendar years immediately preceding the election year reduce hyphenated expressions to one word. Retain the dictionary title, edition, US publication and entry evidence in the source URL or operator's evidence records. Reference publication should be reviewed for dataset licensing; the public endpoint reports import provenance and counts, not the entire source database.

## Operations

Back up SQLite using its online backup capability or a consistent snapshot that includes the WAL, and regularly rehearse restoration. Do not copy only the main database file while active writes are occurring. Restrict and encrypt backups. Preserve receipt IDs, signatures and audit evidence under agency retention policy. Audit digests are chained, but a database administrator can rewrite the chain; export checkpoints to an independently controlled append-only store if tamper evidence against privileged operators is required.

The server has no arbitrary file download/upload routes, no rich-HTML submission rendering, and no payment or tracking integrations. It is not hardened against every denial-of-service or large-scale abuse scenario. Set resource limits and protect invitation creation at the edge. Complete a privacy review for author contact information, legal declarations, and retention. The browser view intentionally escapes text and the public JSON excludes private emails, access keys and invitation material.
