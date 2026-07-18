# Adam Clarke, Commentary and Critical Notes on the Bible — raw source

Retrieved 2026-07-18 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Clarke.zip
(module `Clarke` version 2.0, 2021-10-19; see `clarke.conf`, vendored from the
zip). The module text derives from Wikisource's transcription of the 1831-1836
edition (https://en.wikisource.org/wiki/Commentary_and_critical_notes_on_the_Bible).

License: `DistributionLicense=Public Domain` (see `clarke.conf`). The
commentary (Adam Clarke, d. 1832) is public domain. Registered in
`src/lib/rights.ts` as `clarke`.

`Clarke.zip` holds a zCom SWORD module: `modules/comments/zcom/clarke/{ot,nt}.bzs/.bzv/.bzz`
(zlib-compressed, verse-indexed, KJV versification, OSIS markup, UTF-8).
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-clarke.mjs` into
`data/commentary/clarke/`.
