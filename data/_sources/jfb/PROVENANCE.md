# Jamieson, Fausset & Brown, Commentary Critical and Explanatory on the Whole Bible — raw source

Retrieved 2026-07-18 from the Christian Classics Ethereal Library (CCEL),
ThML/XML export: https://ccel.org/ccel/jamieson/jfb.xml (single file, ~34 MB).

License: the commentary (R. Jamieson, A. R. Fausset, D. Brown, 1871, per the
file's own `printSourceInfo`) is public domain; CCEL distributes its
public-domain digitizations freely for reuse (https://ccel.org/about/copyright).
Registered in `src/lib/rights.ts` as `jfb`.

`jfb.xml` is a CCEL ThML 1.0 document: `<div2 title="<Book>">` per biblical
book, `<div3 title="Chapter N">` per chapter, and a `<scripCom ... osisRef="Bible:Gen.1.1"/>`
marker anchoring each commented verse block, followed by `<div class="Commentary">`
paragraphs. Cross-references are inline `<scripRef>` elements.

The raw XML is kept out of git (`.gitignore`); it is reproducible from the URL
above. Normalized by `scripts/build-commentary-jfb.mjs` into
`data/commentary/jfb/`.
