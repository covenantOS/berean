# C. H. Spurgeon, The Treasury of David — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TDavid.zip
(module `TDavid` version 2.1, 2022-06-24; see `tdavid.conf`, vendored from the
zip). The module text derives from http://archive.spurgeon.org/treasury/
(see `TextSource` in `tdavid.conf`).

License: `DistributionLicense=Public Domain` (see `tdavid.conf`). The Treasury
of David was published in seven volumes, 1865-1885, and is public domain.
Registered in `src/lib/rights.ts` as `tdavid`.

`TDavid.zip` holds a zCom4 SWORD module: `modules/comments/zcom/tdavid/{ot,nt}.bzs/.bzv/.bzz`
(the wide-offset variant of zCom: 12-byte verse records; zlib-compressed,
KJV versification, OSIS markup, UTF-8). Only the Psalms are populated.
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-tdavid.mjs` into
`data/commentary/tdavid/`.

Source condition, verified 2026-07-23:

- Each psalm ships complete: overview, title, division, exposition,
  explanatory notes and quaint sayings, and hints to the village preacher.
  The per-psalm "WORKS UPON ..." bibliographies are apparatus and are dropped
  by the build (29 parts).
- Psalm 119's exposition begins at its second verse in the module; the first
  verse's exposition is absent from the source.
- Text quality: clean UTF-8, no OCR mojibake (zero mid-word substitution
  characters; zero U+FFFD). One single-character uncertainty mark observed
  ("take ever? Psalm" for "take every Psalm", in the Psalm 119 title notes);
  readable in context and kept as printed.
- Verse markers run "Verse N." and "Ver. N."; both are parsed.
