import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { EB_Garamond } from "next/font/google";
import CandleToggle from "@/components/CandleToggle";
import PwaRegister from "@/components/PwaRegister";
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
  // iOS home-screen icon; the Android/install set rides on the manifest.
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Edge to edge, so the workspace's bottom bar can pad for the home
  // indicator with env(safe-area-inset-bottom) on notched phones.
  viewportFit: "cover",
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
  { href: "/workspace?tab=pulpit", label: "Pulpit" },
  { href: "/workspace?tab=chapel", label: "Chapel" },
  { href: "/workspace?tab=desk", label: "Desk" },
  { href: "/workspace?tab=library", label: "Library" },
  { href: "/workspace?tab=almanac", label: "Almanac" },
  { href: "/workspace?tab=settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={garamond.variable}>
      <body className="min-h-screen flex flex-col">
        <header className="glass border-x-0 border-t-0">
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
                  className="fx-press rounded-[4px] px-2.5 py-1.5 text-sm font-medium text-ink no-underline hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sapphire"
                >
                  {item.label}
                </Link>
              ))}
              <CandleToggle />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <PwaRegister />
        <footer className="glass border-x-0 border-b-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
            <span>
              Scripture text: King James Version (public domain) ·{" "}
              <Link href="/search" className="text-sapphire">
                Concordance
              </Link>{" "}
              ·{" "}
              <Link href="/workspace?tab=topics" className="text-sapphire">
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
              <Link href="/workspace?tab=pulpit" className="text-sapphire">
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
