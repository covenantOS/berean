import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Clouds } from "@/components/canvasui/Clouds";
import { Ripple } from "@/components/canvasui/Ripple";
import MagicLinkForm from "@/components/landing/MagicLinkForm";

/**
 * The landing: the one public page, the door into the workspace. It shows
 * what the app is (the hero), what it looks like (the framed mock, drawn
 * from the app's own classes so it never goes stale), what is inside (the
 * honest feature list), and the two ways in (create an account, install the
 * app). Copy stays plain: the page is a door, not a pitch.
 */
export const metadata: Metadata = {
  description:
    "Berean Blue is a quiet, complete study of the Scripture: the King James text, the original languages, thirteen commentaries, the Spurgeon archive, your notes and sermons. On your device, and synced when you want it.",
  openGraph: {
    title: "Berean Blue",
    description:
      "A quiet, complete study of the Scripture: the text, the original languages, thirteen commentaries, the Spurgeon archive, your notes and sermons.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Berean Blue",
    description:
      "A quiet, complete study of the Scripture: the text, the original languages, thirteen commentaries, the Spurgeon archive, your notes and sermons.",
  },
};

const FEATURES: { title: string; line: string }[] = [
  {
    title: "Original languages",
    line: "Hebrew and Greek sit beneath the English with morphology and semantic domains, and a tap on any word opens its lexicon entry.",
  },
  {
    title: "The commentary wall",
    line: "Thirteen commentaries read beside the text, from Matthew Henry and Calvin to the Catena Aurea and Darby\u2019s Synopsis.",
  },
  {
    title: "Guides and the Factbook",
    line: "Passage and exegetical guides gather the cross-references, sermons, people, and places that touch the chapter in front of you.",
  },
  {
    title: "Spurgeon and the confessions",
    line: "All 3,597 Spurgeon sermons ship beside the creeds, the catechism, and the confessions, with proof texts where the sources carry them.",
  },
  {
    title: "Notes, highlights, lists",
    line: "Your marginalia, highlights, and clippings stay on your device and surface wherever the verse surfaces.",
  },
  {
    title: "Memory and plans",
    line: "Reading plans and memory work keep a quiet daily rule.",
  },
  {
    title: "The hymnal and liturgy",
    line: "The chapel composes services from the hymnal and the settled forms, ready to print.",
  },
  {
    title: "Offline and sync",
    line: "Installed, the whole study keeps working offline; an account syncs it across your devices when you want that.",
  },
];

/** The leaded-window mark, the same four panes the shell carries. */
function LeadedMark() {
  return (
    <span className="leaded-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

/** A thin ornament between movements: the section rule from the design set. */
function Rule({ label }: { label: string }) {
  return (
    <p className="section-rule small-caps mx-auto max-w-5xl px-6 text-xs" aria-hidden="true">
      {label}
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="fx-fade">
      {/* The hero: the mark, the name, one line about what it is, two ways
       * in. The clouds are the canvasui set the launcher already flies;
       * where html-in-canvas is missing the panel simply stands still. */}
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-14 sm:px-6">
        <div className="glass-lit fx-bloom rounded-[4px] px-3 py-4 sm:px-6 sm:py-6">
          <Clouds opacity={0.35} density={2} speed={0.35} style={{ borderRadius: "4px" }}>
            <Ripple style={{ borderRadius: "4px" }}>
            <div className="flex flex-col items-center gap-4 px-4 py-10 text-center sm:px-8">
              <LeadedMark />
              <p className="small-caps text-xs text-muted">
                A study prepared · by Church Posting
              </p>
              <h1 className="font-editorial text-4xl font-bold tracking-wide sm:text-5xl">
                Berean Blue
              </h1>
              <p className="max-w-xl text-[0.95rem] leading-relaxed">
                A quiet, complete study of the Scripture: the text, the
                languages, the commentaries, your notes and sermons. On your
                device, and synced when you want it.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/workspace"
                  className="fx-press rounded-[4px] bg-ink px-5 py-2.5 text-sm font-medium text-paper no-underline hover:opacity-90"
                >
                  Open the workspace
                </Link>
                <Link
                  href="#account"
                  className="fx-press rounded-[4px] border border-rule px-5 py-2.5 text-sm font-medium text-ink no-underline hover:bg-paper"
                >
                  Create your account
                </Link>
              </div>
            </div>
            </Ripple>
          </Clouds>
        </div>
      </section>

      {/* The app, framed: the living screenshot. This window is drawn from
       * the app's own classes (glass, reader-surface, verse-num, the
       * highlight tints), so it always shows the workspace as it is and
       * never ages into a stale capture. */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="small-caps text-xs text-muted">The app, framed</p>
        <h2 className="font-editorial mt-1 text-2xl font-bold sm:text-3xl">
          What you are getting
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A window onto the workspace, drawn with the app&apos;s own surfaces,
          so it always shows the study as it is.
        </p>
        <div
          role="img"
          aria-label="The Berean workspace: the reader on John 1, a wall of commentaries, and the cross-references column."
          className="glass fx-bloom mt-6 rounded-[4px]"
        >
          <div className="flex items-center gap-2.5 border-b border-rule px-3 py-2">
            <LeadedMark />
            <span className="small-caps text-[0.68rem] text-muted">
              Berean workspace
            </span>
            <span className="small-caps ml-auto text-[0.68rem] text-muted">
              John 1
            </span>
          </div>
          <div className="grid gap-2 p-2 sm:grid-cols-[1.7fr_1fr_0.9fr] sm:p-3">
            <div className="flex min-h-48 flex-col overflow-hidden rounded-[2px] border border-rule bg-surface">
              <div className="small-caps border-b border-rule px-3 py-1.5 text-[0.62rem] text-muted">
                John 1 · King James
              </div>
              <div className="reader-surface flex-1 px-4 py-3">
                <p
                  className="prose-verses"
                  style={{ "--reader-scale": 0.52 } as CSSProperties}
                >
                  <span className="verse-num">1</span>In the beginning was the
                  Word, and the Word was with God, and{" "}
                  <span className="hl-amber">the Word was God</span>.{" "}
                  <span className="verse-num">2</span>The same was in the
                  beginning with God. <span className="verse-num">3</span>All
                  things were made by him; and without him was not any thing
                  made that was made.
                </p>
                <p className="mt-3 border-t border-rule/60 pt-2">
                  <span className="lang-greek">λόγος</span>{" "}
                  <span className="orig-sub">
                    logos · word, speech, reason · G3056
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-surface">
              <div className="small-caps border-b border-rule px-3 py-1.5 text-[0.62rem] text-muted">
                Commentary
              </div>
              <ul className="flex-1 divide-y divide-rule/60 text-[0.72rem]">
                {[
                  ["Matthew Henry", "on John 1:1–5"],
                  ["John Calvin", "on John 1:1–5"],
                  ["Jamieson, Fausset & Brown", "on John 1:1"],
                  ["Catena Aurea", "Augustine and Chrysostom on the verse"],
                  ["Burkitt", "on John 1:1–3"],
                ].map(([work, line]) => (
                  <li key={work} className="px-3 py-2">
                    <span className="font-medium">{work}</span>
                    <span className="block text-muted">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-surface">
              <div className="small-caps border-b border-rule px-3 py-1.5 text-[0.62rem] text-muted">
                Cross-references
              </div>
              <ul className="flex flex-wrap content-start gap-1 p-2.5 text-[0.66rem]">
                {["Gen 1:1", "Prov 8:22", "Col 1:17", "Heb 1:2", "1 John 1:1", "Rev 19:13"].map(
                  (ref) => (
                    <li
                      key={ref}
                      className="rounded-[2px] border border-rule px-1.5 py-0.5 text-sapphire"
                    >
                      {ref}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Rule label="Inside" />

      {/* What is inside: the honest inventory, one sentence each. */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="small-caps text-xs text-muted">What is inside</p>
        <h2 className="font-editorial mt-1 text-2xl font-bold sm:text-3xl">
          One study, one shelf
        </h2>
        <div className="fx-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="glass glass-hover fx-bloom rounded-[4px] p-5"
              style={{ "--i": i + 1 } as CSSProperties}
            >
              <h3 className="font-editorial text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.line}</p>
            </article>
          ))}
        </div>
      </section>

      <Rule label="Begin" />

      {/* Create your account: one address, one link, no password. The form
       * posts to the better-auth route through the app's own client. */}
      <section id="account" className="mx-auto max-w-2xl scroll-mt-6 px-4 py-10 sm:px-6">
        <div className="glass-lit fx-bloom rounded-[4px] p-6 sm:p-8">
          <p className="small-caps text-xs text-muted">Create your account</p>
          <h2 className="font-editorial mt-1 text-2xl font-bold sm:text-3xl">
            One address, every device
          </h2>
          <p className="mb-5 mt-2 text-sm text-muted">
            An account is one email address. The link we send signs you in;
            there is no password to lose. Nothing in the app is locked behind
            an account; it exists so your notes, highlights, and library can
            sync across your devices when you want that.
          </p>
          <MagicLinkForm />
        </div>
      </section>

      {/* Get the app: the PWA install today, the desktop shell honestly
       * still on the bench. */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="small-caps text-xs text-muted">Get the app</p>
        <h2 className="font-editorial mt-1 text-2xl font-bold sm:text-3xl">
          Carry the study with you
        </h2>
        <div className="fx-stagger mt-6 grid gap-4 sm:grid-cols-2">
          <article
            className="glass fx-bloom rounded-[4px] p-5"
            style={{ "--i": 1 } as CSSProperties}
          >
            <h3 className="font-editorial text-lg font-bold">
              Install from your browser
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Berean is an installable web app. Open berean.blue, then choose
              Add to Home Screen from your browser&apos;s menu on a phone, or
              Install app from the address bar or menu on a computer.
              Installed, the whole study keeps working offline.
            </p>
          </article>
          <article
            className="glass fx-bloom rounded-[4px] p-5"
            style={{ "--i": 2 } as CSSProperties}
          >
            <h3 className="font-editorial text-lg font-bold">
              Desktop for Windows
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              On the bench. The shell exists and there is no download yet; the
              installed web app carries the same workspace.
            </p>
          </article>
        </div>
      </section>

      {/* The quiet rights line; the global footer carries the rest. */}
      <section className="mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
        <p className="border-t border-rule pt-6 text-center text-xs text-muted">
          Every text is public domain or shipped under its documented license;
          the registry lives at{" "}
          <Link href="/sources" className="text-sapphire">
            Sources &amp; rights
          </Link>
          . Berean is free, and the direction is free and open source.
        </p>
      </section>
    </div>
  );
}
