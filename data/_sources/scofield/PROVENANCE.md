# C. I. Scofield, Scofield Reference Notes (1917 edition) — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Scofield.zip
(module `Scofield` version 2.1, 2023-01-27; see `scofield.conf`, vendored from
the zip). The module text derives from Wikisource's transcription of the 1917
edition (https://en.wikisource.org/wiki/Scofield_Reference_Bible_Notes, see
`TextSource` in `scofield.conf`).

License: `DistributionLicense=Public Domain` (see `scofield.conf`). The 1917
edition of the Scofield Reference Bible notes (C. I. Scofield, d. 1921) is
public domain. Registered in `src/lib/rights.ts` as `scofield`.

`Scofield.zip` holds a zCom SWORD module: `modules/comments/zcom/scofield/{ot,nt}.bzs/.bzv/.bzz`
(zlib-compressed, verse-indexed, KJV versification, OSIS markup, UTF-8).
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-scofield.mjs` into
`data/commentary/scofield/`.

Source condition, verified 2026-07-23:

- Book introductions ride different slots book by book (the book-introduction
  slot, the first chapter-introduction slot, or the first verse slot inside a
  preverse milestone); the build collects them all as intro sections.
- The module's "Read first chapter of X" references are navigation artifacts
  and are dropped; every other reference's visible text is kept.
- Verses without a Scofield note have empty slots and simply do not appear.
- Text quality: clean UTF-8, no OCR mojibake (zero mid-word substitution
  characters; zero U+FFFD).
