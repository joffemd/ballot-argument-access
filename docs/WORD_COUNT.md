# Word counting and legal-source notes

## Counting contract

The proposal requires an unadjusted count but does not define its tokenization. This implementation defines it as the number of nonempty whitespace-separated tokens, including isolated punctuation. The adjusted count applies the configured Section 9 rules. This baseline makes every change explainable: `unadjusted + sum(adjustment.delta) = adjusted`.

The counter records character offsets, original text, rule, source and before/after values. Its special spans do not overlap. Specific websites, phone numbers and dates are matched before reference names; longer reference names are considered first. Remaining text is counted as lexical words, excluding punctuation and separating unlisted hyphenated components. Apostrophes inside a word remain internal.

| Rule | Behavior |
| --- | --- |
| Punctuation | No adjusted words for standalone punctuation. |
| Ordinary words | Each lexical word counts once. |
| Proper nouns | Imported names and officially approved filer designations count once, with each occurrence recorded. Matches use word boundaries and case-insensitive Unicode matching. |
| Abbreviations | Dotted letter abbreviations count once. Unspaced letter abbreviations already count once. Multiword expressions require a curated `abbreviation` reference. |
| Hyphenation | An imported dictionary entry counts once if its publication year falls from election year minus ten through election year minus one. Other components count separately. |
| Dates | English month-name dates with digits count as two; digit-only slash/hyphen dates count as one. |
| Numbers | Digit forms, including ordinary thousands and decimal separators, count once; spelled-out words count separately. |
| Telephone numbers | Recognized North American formats, including area codes and optional country code, count once. |
| Websites | HTTP(S), www-prefixed addresses and ordinary bare domain patterns count once. |

Examples: `City and County of San Francisco` counts as one when in the reference list; `November 7, 2028` counts as two; `11/07/2028` as one; `(415) 555-0123` as one; `one hundred` as two; an unlisted `newly-invented-term` as three.

Name recognition is not a general semantic determination. Unknown names remain ordinary words until designated and approved. Pending claims are shown explicitly; the displayed current count must not be represented as a final official determination. A dictionary import's metadata is evidence supplied by the official, not a fact the software verifies by opening the source URL. Nonstandard date, number, international-phone or abbreviation forms and ambiguous punctuation require policy review and additional rules/fixtures before use. This release has no machine-learning name inference or claim of exhaustive natural-language coverage.

The receipt preserves the count at filing time. The current count can change after reference imports or official noun decisions, but the signature continues to bind the original text and original claimed names. Both are visible in the official workspace. Applicable limits are configurable per measure instead of assumed universally.

## Sources consulted

The attached proposal supplied the exact Section 3 requirements. External official sources were consulted to inform implementation of the statutes incorporated by reference:

- [California Legislature, Elections Code Section 9](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=9.&lawCode=ELEC). The direct page could not be retrieved during this build. The rules were cross-checked against the Legislature's [2014 SB 1253 text, Section 9 on printed page 5](https://www.leginfo.ca.gov/pub/13-14/bill/sen/sb_1251-1300/sb_1253_bill_20140617_amended_asm_v96.pdf). This historic official source is not proof of the law's future wording; confirm the governing version for the deployment election.
- [Secretary of State, Government Code 16.5](https://www.sos.ca.gov/administration/regulations/current-regulations/technology/digital-signatures/government-code-16-5). This establishes the required linkage, verifiability and signer-control properties; the use of a cryptographic algorithm is only part of the requirements.
- [Secretary of State, digital-signature regulatory text](https://www.sos.ca.gov/administration/regulations/current-regulations/technology/emergency-digital-signatures). Includes acceptable public-key technology and agency assessment of identity and transmission security. The page retains an emergency-regulation heading; check the applicable codified regulations before approval.
- [Secretary of State, certification-authority list notice](https://www.sos.ca.gov/administration/regulations/current-regulations/technology/digital-signatures/approved-certification-authorities). Explains that the former state-maintained CA list was discontinued and the changes became permanent in 2021; the application does not rely on that obsolete list.
- [Controller, local government](https://www.sco.ca.gov/ard_local.html) and [2026 key-personnel roster summary](https://www.sco.ca.gov/Files-ARD-Local/lgpsd_key_personnel_listing_summary.pdf): entry points for agency reference acquisition.
- [USGS, download GNIS data](https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data): official name datasets and documented text formats. The page describes periodic refreshes; operators must maintain current imports.

SOS business and nonprofit records must be obtained through the Secretary's actual records access arrangements. No complete entity registry, roster or GNIS extract was downloaded or included with this build. The provided import contract is intentionally independent of changing download formats and access credentials.
