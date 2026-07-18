# John Calvin, Commentaries — raw source

Retrieved 2026-07-18 from https://github.com/thefrenchpressed/pillar-commentary-data
(commit `e9dfeec9b6c7df6ddac02945947d2ea85b0dc178`, shallow clone, `.git`
removed after vendoring).

License: the commentary text is public domain (per that repository's README,
sourced from the CrossWire SWORD `CalvinCommentaries` module, which CCEL
digitized from the Calvin Translation Society editions, 1843-1855); the
repository's JSON conversion is MIT-licensed (see `LICENSE` in this
directory). Registered in `src/lib/rights.ts` as `calvin`.

Layout: `c/calvin/{USFM}/{chapter}.json` in the HelloAO Free Use Bible API
chapter schema (`chapter.content[]` items of `type: "verse"` with `number`
and `content[].text`), plus `c/calvin/manifest.json` listing the 47 covered
books. Calvin wrote no commentary on several books (Samuel, Kings,
Chronicles, Job, Proverbs, Acts, Revelation, and others); a few front-matter
verses (Genesis 1:1, Psalm 1:1, 1-2 Timothy 1:1) are absent from the source
module. Only the `c/calvin/` tree is used.

The raw tree is kept in git for provenance. Normalized by
`scripts/build-commentary-calvin.mjs` into `data/commentary/calvin/`.
