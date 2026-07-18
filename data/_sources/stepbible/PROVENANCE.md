# STEPBible-Data raw sources

Retrieved 2026-07-18 from the STEPBible-Data repository
(https://github.com/STEPBible/STEPBible-Data), branch `master`, tree SHA
`b86d26cdb1f51729e73b5b4eb7f7ccadc5dfba39`.

Data created by www.STEPBible.org based on work at Tyndale House Cambridge,
licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Attribution: "Data created by www.STEPBible.org based on work at Tyndale
House Cambridge (CC BY 4.0)". Registered in `src/lib/rights.ts`.

Raw TSVs are kept out of git (see `.gitignore`) because they total roughly
108 MB; they are reproducible from the URLs below. The normalized per-book
JSON under `data/tahot/` and `data/tagnt/` is committed.

| Local file | Source URL (raw.githubusercontent.com/STEPBible/STEPBible-Data/master/...) |
|---|---|
| TAHOT-Gen-Deu.txt | Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt |
| TAHOT-Jos-Est.txt | Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt |
| TAHOT-Job-Sng.txt | Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt |
| TAHOT-Isa-Mal.txt | Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt |
| TAGNT-Mat-Jhn.txt | Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt |
| TAGNT-Act-Rev.txt | Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt |
| TBESH.txt | Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt |
| TBESG.txt | Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt |
| TIPNR.txt | Proper Nouns/TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt |

Normalized by `scripts/build-step.mjs`. The STEP copyright header blocks in
each TSV are documentation, not data rows; the parser skips every line that
does not begin with a verse reference.

TIPNR is normalized by `scripts/build-entities.mjs` into `data/entities/`
(index, per-letter detail shards, per-book verse maps). TIPNR references
follow standard English versification; LXX-only references and the handful
of source rows that do not parse are skipped and counted by the build.

Versification notes: TAHOT references follow English (NRSV) chapter and
verse numbering, with the Hebrew numbering in parentheses where it differs
(e.g. `Mal.4.1(3.19)`); Psalm titles are verse 0. TAGNT references follow
NRSV numbering, with the KJV numbering in square brackets where it differs
(e.g. `1Jn.2.14[2.13]`).
