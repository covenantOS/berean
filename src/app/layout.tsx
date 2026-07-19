import type { Metadata } from "next";
import Link from "next/link";
import { EB_Garamond } from "next/font/google";
import CandleToggle from "@/components/CandleToggle";
import "./globals.css";

const garamond = EB_Garamond({
  subsets: ["latin", "greek"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Berean", template: "%s · Berean" },
  description:
    "Berean — Scripture study and authored knowledge. A study prepared, by Church Posting.",
};

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

const NAV = [
  { href: "/workspace", label: "Read" },
  { href: "/pulpit", label: "Pulpit" },
  { href: "/chapel", label: "Chapel" },
  { href: "/workspace?tab=desk", label: "Desk" },
  { href: "/workspace?tab=library", label: "Library" },
  { href: "/almanac", label: "Almanac" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={garamond.variable}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-rule bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/workspace" className="flex items-center gap-3 no-underline">
              <LeadedMark />
              <span className="flex flex-col leading-tight">
                <span className="font-editorial text-lg font-bold tracking-wide text-ink">
                  Berean
                </span>
                <span className="small-caps text-[0.68rem] text-muted">
                  by Church Posting
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[4px] px-2.5 py-1.5 text-sm font-medium text-ink no-underline hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {item.label}
                </Link>
              ))}
              <CandleToggle />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
            <span>
              Scripture text: King James Version (public domain) ·{" "}
              <Link href="/search" className="text-sapphire">
                Concordance
              </Link>{" "}
              ·{" "}
              <Link href="/topics" className="text-sapphire">
                Topics
              </Link>{" "}
              ·{" "}
              <Link href="/workspace?tab=plans" className="text-sapphire">
                Plans
              </Link>{" "}
              ·{" "}
              <Link href="/workspace?tab=memory" className="text-sapphire">
                Memory
              </Link>{" "}
              ·{" "}
              <Link href="/workspace?tab=journal" className="text-sapphire">
                Journal
              </Link>{" "}
              ·{" "}
              <Link href="/workspace?tab=prayers" className="text-sapphire">
                Prayers
              </Link>{" "}
              ·{" "}
              <Link href="/study" className="text-sapphire">
                Studies
              </Link>{" "}
              ·{" "}
              <Link href="/sources" className="text-sapphire">
                Sources &amp; rights
              </Link>
            </span>
            <span className="small-caps">Soli Deo Gloria</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
