# Pillar Commentary Data

Public-domain Bible commentary text, converted into the same JSON schema used by
[HelloAO's Free Use Bible API](https://bible.helloao.org/docs), for use in
[The Pillar](https://github.com/thefrenchpressed) Bible reading app (and anyone
else who wants it — that's the point of public domain).

## Layout

```
c/{commentary-id}/manifest.json      -- id, name, language, list of covered USFM book codes
c/{commentary-id}/{USFM}/{chapter}.json
```

Each chapter file:

```json
{ "chapter": { "content": [
    { "type": "verse", "number": 16, "content": [ { "text": "For God so loved the world..." } ] },
    ...
] } }
```

Fetch directly via jsDelivr, e.g.:
`https://cdn.jsdelivr.net/gh/thefrenchpressed/pillar-commentary-data@main/c/calvin/JHN/3.json`

## Commentaries

### calvin — John Calvin's Commentaries

Source: [CrossWire SWORD project's `CalvinCommentaries` module](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=CalvinCommentaries)
(public domain, sourced from [CCEL](https://www.ccel.org/)). Covers 47 books —
see `c/calvin/manifest.json` for the exact list; Calvin didn't write on every
book of the Bible (e.g. no Samuel/Kings/Chronicles, Job, Proverbs, Acts, Revelation).

A handful of verses (Genesis 1:1, Psalm 1:1, 1 Timothy 1:1, 2 Timothy 1:1) are
intentionally omitted: the source module attaches book/chapter front matter
(title pages, translator's prefaces) to those verse slots instead of a
per-verse comment, and it isn't reliably separable from genuine commentary —
shown as missing rather than risk showing the wrong thing.

## License

The underlying commentary text is public domain. This repository's conversion
scripts and structure are released under the MIT License (see `LICENSE`).
