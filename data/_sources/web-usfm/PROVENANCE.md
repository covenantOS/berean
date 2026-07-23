# World English Bible USFM (words-of-Christ markup source)

Retrieved 2026-07-23 from eBible.org:
https://ebible.org/Scriptures/eng-web_usfm.zip
(details: https://ebible.org/find/details.php?id=eng-web)

The World English Bible is in the Public Domain; "World English Bible" is a
trademark of eBible.org (see `copr.htm`, kept in git as the license evidence;
the live copr page at https://ebible.org/eng-web/copr.htm carried the same
dedication when fetched on the retrieval date). Source files dated
2026-07-10, the 2020 stable text edition.

Only the words-of-Christ markup (`\wj`...`\wj*`) ships, as per-chapter
dominical verse flags under `data/redletter`; the WEB text itself already
ships as a parallel translation (rights id `web`) and is not duplicated
here. The raw USFM and the zip are kept out of git (see `.gitignore`). To
rebuild:

    curl -O https://ebible.org/Scriptures/eng-web_usfm.zip
    unzip eng-web_usfm.zip -d data/_sources/web-usfm
    node scripts/build-redletter.mjs

Registered in `src/lib/rights.ts` (id `web-redletter`).
