# Berean Standard Bible USFM (paratext source)

Retrieved 2026-07-19 from eBible.org:
https://ebible.org/Scriptures/engbsb_usfm.zip
(details: https://ebible.org/find/details.php?id=engbsb)

The Berean Standard Bible text and paratext are marked Public Domain by
eBible.org (contributor: BSB Publishing, LLC; see `copr.htm`, kept in git as
the license evidence). Source files dated 2026-06-11.

Only the section headings (`\s1`, `\s2`) and their parallel-passage
references (`\r`) ship; the BSB text itself does not. The raw USFM and the
zip are kept out of git (see `.gitignore`). To rebuild:

    curl -O https://ebible.org/Scriptures/engbsb_usfm.zip
    unzip engbsb_usfm.zip -d data/_sources/bsb-usfm
    node scripts/build-pericopes.mjs

Registered in `src/lib/rights.ts` (id `bsb-paratext`).
