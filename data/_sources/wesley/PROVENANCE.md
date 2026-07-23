# John Wesley, Explanatory Notes on the Bible — raw source

Retrieved 2026-07-23 from the CrossWire Bible Society SWORD module repository:
https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Wesley.zip
(module `Wesley` version 1.1, 2013-07-16 packaging; see `wesley.conf`, vendored
from the zip). Wesley's notes: Explanatory Notes upon the New Testament (1755)
and Explanatory Notes upon the Old Testament (1765).

License: `DistributionLicense=Public Domain` (see `wesley.conf`). The notes
(John Wesley, d. 1791) are public domain. Registered in `src/lib/rights.ts`
as `wesley`.

`Wesley.zip` holds a zCom SWORD module: `modules/comments/zcom/wesley/{ot,nt}.bzs/.bzv/.bzz`
(zlib-compressed, verse-indexed, KJV versification, ThML markup, UTF-8).
The zip is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-wesley.mjs` into
`data/commentary/wesley/`.

Source condition, verified 2026-07-23:

- 1 Kings and Philemon are absent from the module (their slots are empty).
- Judges and Jonah are flood-damaged beyond recovery: one neighboring note
  fills every slot of each book (a Joshua fragment fills Judges; the Amos
  9:15 note fills Jonah). The build drops both books.
- The module duplicates every multi-verse note across the slots it covers
  and, where the source lost notes, floods the gap with a neighboring note.
  The build merges short runs into range sections and keeps a flooded run
  only at its first verse when the note's catch-phrase verifies against that
  verse's KJV text; 10 unverifiable or displaced runs are dropped. Kept and
  dropped runs are counted in the build output.
- Text quality otherwise: clean UTF-8, no OCR mojibake (zero mid-word
  substitution characters; zero U+FFFD).
