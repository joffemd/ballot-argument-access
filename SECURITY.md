# Security and contributions

This is an evaluation release. Review `docs/DEPLOYMENT.md` and `docs/CONFORMANCE.md` before accepting real filings. Do not publish live invitation links, author contacts, official keys, database files or notification bodies in a public issue tracker.

To report a vulnerability before a repository maintainer has established a private reporting channel, contact the deployment operator directly. No external security email or maintainer organization is fabricated here.

Contributions are welcome under MIT. Run `npm test` and `npm run check`. When changing a legal counting rule, add a fixture showing the disputed input, expected result and authoritative rule. When changing deadline, receipt, signing or notification logic, test both success and rejection boundaries. Preserve immutable signed bytes and original receipts. Record the applicable proposal/specification version in documentation.

Known evaluation limits include email-only identity assurance, bearer-key official access without SSO/MFA, no public-account recovery, no certificate-chain validation, no built-in paper ingestion or cure administration, no statewide capacity benchmark, and no formal accessibility/security certification. Audit chaining does not protect against an administrator who can rewrite the entire database. Notification gateway acceptance is not inbox delivery confirmation.
