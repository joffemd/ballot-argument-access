# HTTP API

All responses are JSON except the browser assets. POST requests require `Content-Type: application/json`. Errors return `{"error":"message"}` with an appropriate status. No CORS access is enabled. POSTs from a browser must have the configured origin; server clients may omit Origin. Maximum request size is 4 MB.

Access tokens are sent in `Authorization: Bearer TOKEN`, never query strings. The browser's invitation and owner links use URL fragments so capabilities are not transmitted in HTTP request URLs or referrers. Save the owner link: there is no password recovery workflow in this release.

| Method and path | Purpose | Credential |
| --- | --- | --- |
| GET /api/config | Demo and signature information | Public |
| GET /api/public | Measures, published filings/documents and selection history | Public |
| GET /api/references | Reference-import provenance and total name count | Public |
| POST /api/count | Count `{measureId,text,properNouns:[]}` | Public |
| POST /api/drafts | Create immutable packet and invitations | Public |
| GET /api/filings/:id | Packet status, receipt, current counts | Owner capability |
| POST /api/filings/:id/submit | Final submission; idempotent receipt | Owner capability |
| GET /api/sign/:id | Exact canonical bytes and author assignment | Author invitation capability |
| POST /api/sign/:id | Verify and store one author signature | Author invitation capability |
| GET /api/admin/state | Scoped filings, measures and reviews; statewide outbox and audit | Official |
| POST /api/admin/measures | Create a jurisdiction's measure | Scoped official |
| POST /api/admin/documents | File analysis or tax statement | Scoped official |
| POST /api/admin/review | Decide a proper-name claim | Scoped official |
| POST /api/admin/selections | Record selection and notify filers | Scoped official |
| POST /api/admin/references | Import provenance-backed names | State administrator |
| POST /api/admin/retry | Request outbox retry using `{id}` | State administrator |

## Packet creation

```json
{
  "measureId":"existing-measure-id",
  "kind":"argument",
  "side":"against",
  "text":"The complete argument text.",
  "authors":[{"name":"Example Author","email":"author@example.org","title":"Resident"}],
  "properNouns":["Example Author"]
}
```

`kind` is `argument` or `rebuttal`; `side` is the author's position on the measure (`for` or `against`). Claimed proper nouns must actually appear in the text. There must be 1–5 authors with distinct email addresses. The response contains `id`, `owner` and `wordCount`. Only demo mode also returns author invitation tokens. The body of the accompanying statement comes from the measure configuration and is frozen in the packet.

Each author retrieves the packet with their invitation capability, reviews it, and signs the **exact UTF-8 bytes of the returned `canonical` string**. Do not independently serialize or normalize the payload. Submit:

```json
{
  "publicKey":{"kty":"EC","crv":"P-256","x":"BASE64URL_X","y":"BASE64URL_Y"},
  "signature":"BASE64_64_BYTE_IEEE_P1363_SIGNATURE",
  "consent":true
}
```

The server uses SHA-256 and ECDSA P-256, rejecting private-key material and altered signatures. The browser implementation uses Web Crypto. Once all authors have signed, the owner POSTs `{}` to `/submit`. Drafting and signing do not establish the filing timestamp. The submission transaction does. The closing timestamp is exclusive: submissions must arrive before it. Retrying an already completed submission returns its existing receipt even after the deadline.

## Official documents

```json
{"measureId":"...","kind":"analysis","title":"Impartial analysis","text":"Full analysis text"}
```

`kind` can be `analysis` or `tax`. Analyses publish immediately. Tax statements publish at the measure's `tax` deadline. Submitted content is plain text, escaped by the UI, and available as Unicode JSON.

## Reference import

```json
{
  "source":"gnis",
  "sourceUrl":"https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data",
  "retrievedAt":"2026-10-16",
  "names":["EXAMPLE REPLACE WITH ACTUAL SOURCE NAMES"]
}
```

Sources: `controller`, `sos-business`, `sos-nonprofit`, `gnis`, `dictionary`, `abbreviation`. Dictionary imports also require `year`, and the operator must retain US dictionary publication evidence. Each source/name/year combination is deduplicated; import batches and provenance remain recorded. The UI supports pasted newline-separated names. Raw source formats vary, so normalize the official name column before import. No network fetch of arbitrary supplied URLs is performed.

## Proper-name review

```json
{"filingId":"...","claimId":"...","status":"approved","reason":"Verified against official agency record"}
```

Status is `approved` or `rejected`. Only an official assigned to the filing's jurisdiction can review it. This changes current counts, not signed text or the original receipt. Signed byte strings and signature evidence remain available in the official workspace.

## Selection notice

```json
{"measureId":"...","side":"for","selectedId":"FILED_ARGUMENT_ID","provision":"Elections Code 9166","basis":"The official's substantive priority determination"}
```

A selected argument must match the measure and position and must be filed. Selection cannot be recorded before arguments close. Each new determination is appended to history and notifies every filer for the measure. The latest determination for a measure/side is the current one; earlier determinations remain part of the record. The system does not infer the legal basis from the author's name or organizational affiliation.
