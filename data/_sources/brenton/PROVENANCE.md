# Brenton's English Septuagint — raw source

Retrieved 2026-07-18 from https://eBible.org/Scriptures/eng-Brenton_usfm.zip
(details page: https://ebible.org/find/details.php?id=eng-Brenton, also served
at https://ebible.org/eng-Brenton/).

License: public domain. eBible.org marks this translation "public domain" on
its details page and lists it among its freely redistributable texts: "The
Septuagint Version of the Old Testament, with an English Translation" by Sir
Lancelot Charles Lee Brenton, published 1851. Registered in
`src/lib/rights.ts` as `brenton-lxx-english`.

Other candidates considered and rejected: the CrossWire SWORD `LXX` module
(Greek, from CCAT) carries `DistributionLicense=Copyrighted; Free
non-commercial distribution`, which is not a clean license for this product.
`ctatum20/brenton-septuagint-data` (GitHub) declares no license. The eBible.org
digitization is used for both the English and the Greek (see
`data/_sources/lxx/PROVENANCE.md`).

Format: USFM, one file per book. Notes on shape:

- Esther ships as `43-ESG` (Esther Greek): the ten canonical chapters with the
  additions interleaved as lettered verses (1b-1s and similar), the brackets
  `[` `]` in the text marking the added material. There is no separate
  Hebrew-order Esther in this edition.
- Ezra ships as `16-EZR` = 2 Esdras: Ezra chapters 1-10, then Nehemiah as
  chapters 11-23. (A separate `17-NEH` duplicate is ignored by the build.)
- Daniel ships as `66-DAG` (Daniel Greek), twelve chapters; Susanna and Bel
  and the Dragon are separate books (`50-SUS`, `51-BEL`) and are not built.
- Psalms has 151 chapters (LXX Psalm 151 included; the app canon stops at
  150, so it is kept in the data but never served).
- Malachi has 3 chapters (LXX 3:19-24 = KJV 4:1-6).
- Verse text carries Brenton's margin as USFM footnotes (`\f ... \f*`, the
  "Gr." renderings and Alex. variants); the build strips these and keeps the
  reading text only.
- Deuterocanonical books (TOB, JDT, WIS, SIR, BAR, LJE, 1ES, 1-4MA, MAN,
  SUS, BEL) are present in the zip but not built: the app canon is the 66
  books and is not expanded.

Normalized by `scripts/build-brenton.mjs` into `data/translations/brenton/`.
The raw zip is kept out of git (see `.gitignore`) and can be re-downloaded
from the URL above.
