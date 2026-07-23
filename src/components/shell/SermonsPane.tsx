"use client";

import { useEffect, useRef, useState } from "react";
import PrintButton from "./PrintButton";

interface SermonDoc {
  slug: string;
  title: string;
  number: string | null;
  year: number | null;
  volume: string | null;
  ref: string | null;
  /** The printed publication block where the record carries one
   * ("No. 3006 A Sermon Published On Thursday, September 20th, 1906, ..."). */
  header: string | null;
  quote: string | null;
  paragraphs: string[];
  url: string;
  pdf: string | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; sermon: SermonDoc };

/**
 * The sermon reader: one Spurgeon sermon in full with quiet chrome, the
 * confessions reader's pattern. The header carries the collection volume,
 * year, canonical number where the archive records one, and the appointed
 * text; the facsimile PDF and the library's page link out; the body is the
 * sermon's text. Stubs without body text point to the facsimile.
 */
export default function SermonsPane({
  slug,
}: {
  paneId: string;
  tabId: string;
  slug: string;
}) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    fetch(`/api/pane/sermon?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setLoad({ status: "missing" });
          return;
        }
        setLoad({ status: "ready", sermon: (await res.json()) as SermonDoc });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({ status: "missing" });
      });
    return () => controller.abort();
  }, [slug]);

  /* A retargeted reader starts at the top. */
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start" });
  }, [slug]);

  if (load.status === "loading") {
    return <p className="text-xs text-muted">Opening the sermon…</p>;
  }
  if (load.status === "missing") {
    return <p className="text-xs text-muted">This sermon is not in the archive.</p>;
  }
  const s = load.sermon;
  const meta = [s.volume, s.year, s.number ? `No. ${s.number}` : null, s.ref]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={rootRef} className="mx-auto max-w-prose py-4" data-print-root>
      <header className="mb-6 border-b border-rule pb-4">
        <p className="small-caps text-xs font-semibold text-amber">Sermon</p>
        <h2 className="font-editorial mt-0.5 text-xl font-semibold">{s.title}</h2>
        <p className="mt-0.5 text-[0.68rem] text-muted">C. H. Spurgeon · {meta}</p>
        {s.header && (
          <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">{s.header}</p>
        )}
        <p className="no-print mt-2 flex items-center gap-3">
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
          >
            Read at spurgeon.org
          </a>
          {s.pdf && (
            <a
              href={s.pdf}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sapphire hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
            >
              Printed page facsimile
            </a>
          )}
          <PrintButton />
        </p>
      </header>

      {s.quote && (
        <blockquote className="mb-6 border-l-2 border-rule pl-3 font-reader text-[0.9rem] italic leading-relaxed text-muted">
          {s.quote}
        </blockquote>
      )}

      {s.paragraphs.length > 0 ? (
        <div className="font-reader space-y-3 text-[0.9rem] leading-relaxed">
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="font-reader text-[0.9rem] leading-relaxed text-muted">
          The full text of this sermon is not in this digitization. The printed page facsimile
          and the library's page, linked above, carry it.
        </p>
      )}

      <p className="mt-8 border-t border-rule pt-2 text-[0.68rem] text-muted">
        A public-domain sermon; its provenance and digitization are recorded at /sources.
      </p>
    </div>
  );
}
