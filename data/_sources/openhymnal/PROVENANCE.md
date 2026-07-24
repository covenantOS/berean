# The Open Hymnal Project, 2014.06 release: raw source

Retrieved 2026-07-23 from the Open Hymnal Project (openhymnal.org),
maintained by Brian J. Dumont:

- `OpenHymnal2014.06-abc.zip` — every score's ABC Plus source
  (http://openhymnal.org/OpenHymnal2014.06-abc.zip, 306 files, vendored in
  git; the build reads members straight from the zip with `unzip`).
- `openhymnal.201406.xml` — the same release's ThML text edition
  (http://openhymnal.org/openhymnal.201406.xml), the letter-for-letter
  witness every shipped hymn is checked against.
- `alllyrics.html` — the project's current lyrics page
  (http://openhymnal.org/alllyrics.html), the fallback witness for the
  handful of scores the 2014.06 ThML omits; a disagreement with the 2014
  score still excludes the hymn.

Normalized by `scripts/build-hymns.mjs` into `data/hymns/`.

License: the project's copying page (http://openhymnal.org/copying.html)
works in United States copyright law, lists copyright per hymn part
(words, translation, music, setting) on each score and inside each abc
file, and states that "all hymns or hymn parts listed as 'public domain'
are not under copyright protection in the United States of America"; its
own produced content (indices, pages, data files) is placed in the public
domain. Berean takes the words only. The build admits a file when its
copyright line claims the public domain and carries no dated copyright on
the words or lyrics; files whose words ride a "free for Christian
worship" license (Dumont, Penney, Fleischmann, Robertson, Ilori, Adams)
or carry a modern words copyright are excluded and recorded in
`data/hymns/_meta.json` (16 files at the 2014.06 release). Registered in
`src/lib/rights.ts` as `openhymnal-pd`.

Source condition, verified 2026-07-23:

- 306 abc files, hand-set from printed public-domain hymnals (each file
  cites its lyric source: Presbyterian Hymnal 1911, Common Service Book
  1917, Evangelical Lutheran Hymn-Book 1931, Methodist Hymnal 1905, and
  their kin). No OCR anywhere in the pipeline.
- Latin-1 bytes throughout; no CP1252 punctuation bytes (the build
  asserts this). Metadata per file: title, author, translator, composer,
  text meter (%OHMETRICAL), scripture references (%OHSCRIP), and the
  copyright line the admission rule reads.
- Verse text is recovered from the sung underlay (syllabified to the
  notes) and the after-score text blocks, chunked back into poetic lines
  against each file's own meter; refrains print under verse one alone and
  are split off from the later verses' underlay counts. Where the score
  prints a refrain the meter does not count, its lines break at the
  refrain's own punctuation.
- Every admitted hymn validates letter-for-letter against the release's
  ThML text (or the current lyrics page for the scores the ThML omits):
  same letters, same verses, with the refrain tried baked before or
  after. 260 files pass; 46 exclusions are recorded with reasons in
  `data/hymns/_meta.json` (copyright, chant-form pieces with no verse
  meter, scores whose underlay will not reconcile with the printed meter,
  and texts the two editions disagree on).
- Where the text editions print more verses than the score underlays
  (Paul Gerhardt's longer hymns and their kin), the score's own verse
  selection ships and `data/hymns/_meta.json` records the selection
  (24 hymns at this release).
- Scripture references parse off the project's abbreviations onto
  canonical slugs and validate against the shipped KJV text. Two printed
  references fail the canon: "1Thess 6:17" (for 5:17; the letter has five
  chapters) and "Mt 9:37-39" (the chapter ends at 38). They drop out of
  the index and into `data/hymns/_meta.json`'s droppedRefs, the
  confessions rule.
- Build at this release: 250 hymns, 1,293 verses, 44 with refrains,
  1,062 scripture references, 10 multi-score merges (one hymn, several
  tunes) and the variant translations kept distinct (the two Mighty
  Fortress translations, the two Christ the Lord settings).
