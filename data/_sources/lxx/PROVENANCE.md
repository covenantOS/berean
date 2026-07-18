# Greek Septuagint (Brenton diglot text) — raw source

Retrieved 2026-07-18 from https://eBible.org/Scriptures/grcbrent_usfm.zip
(details page: https://ebible.org/find/details.php?id=grcbrent).

License: public domain. eBible.org marks this text "Public Domain" on its
details page and lists it among its freely redistributable texts. It is the
Greek Septuagint text (with Apocrypha) that Sir Lancelot C. L. Brenton
printed in his 1851 diglot, principally Codex Vaticanus with Alexandrinus
readings noted. Registered in `src/lib/rights.ts` as `lxx-greek-brenton`.

Other candidates considered and rejected: the CrossWire SWORD `LXX` module
(morphologically tagged Rahlfs, from CCAT) carries
`DistributionLicense=Copyrighted; Free non-commercial distribution`, which is
not a clean license for this product. The CATSS/CCAT morphological LXX
carries similar distribution terms. `eliranwong/LXX-Rahlfs-1935` declares no
license; `eliranwong/LXX-Swete-1930` is GPL-3.0, which would impose
copyleft on derived data. The eBible.org public-domain Brenton Greek is the
clean option and pairs with the English Brenton column from the same
diglot.

Format: USFM, one file per book. The shape mirrors the English edition (see
`data/_sources/brenton/PROVENANCE.md`): Esther is `43-ESG` with lettered
addition verses, Ezra `16-EZR` is 2 Esdras (Ezra 1-10, Nehemiah 11-23; there
is no separate Nehemiah file in this zip), Daniel is `66-DAG`, Psalms runs
to 151, Malachi has 3 chapters, and the deuterocanonical books are present
but not built.

Normalized by `scripts/build-lxx.mjs` into `data/lxx/`.
The raw zip is kept out of git (see `.gitignore`) and can be re-downloaded
from the URL above.
