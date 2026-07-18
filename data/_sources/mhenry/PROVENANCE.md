# Matthew Henry, Complete Commentary on the Whole Bible — raw source

Retrieved 2026-07-18 from https://github.com/lyteword/mhenry-complete
(commit `d59271960fc55f9ea50fb0a3548398b599656af0`, shallow clone, `.git`
removed after vendoring).

License: CC0 1.0 Universal (see `LICENSE` in this directory). The underlying
commentary (Matthew Henry, 1706-1721) is public domain. Registered in
`src/lib/rights.ts` as `matthew-henry-full`.

Layout: `volume-<n>/<book-slug>/chapter-<n>.md` (Psalms: `psalm-<n>.md`),
Hugo-style markdown with YAML frontmatter. Each chapter is a lead
introduction followed by `## <section>` headings; each section opens with a
blockquotation of the covered verses (superscript verse numbers in bold)
followed by the commentary paragraphs.

The raw tree is kept in git (markdown, roughly 42 MB) for provenance, as with
`data/_sources/mhc`. Normalized by `scripts/build-commentary-mhenry.mjs` into
`data/commentary/mhenry/`.
