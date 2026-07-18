# Berean Desktop (Mac & Windows)

A Tauri shell around the Berean application — see `docs/adr/0002-platform-and-sync.md`
for the platform decision. This first iteration is a thin shell that loads the
deployed app; a later iteration bundles a static export with a local passage
API for fully offline study.

## Prerequisites

- Rust (stable) — https://rustup.rs
- Tauri CLI: `cargo install tauri-cli --version '^2'`
- macOS: Xcode command line tools. Windows: WebView2 (ships with Windows 11)
  and the MSVC build tools.

## Configure

Set the deployed application URL in `src-tauri/tauri.conf.json` under
`app.windows[0].url` (defaults to the local dev server).

## Develop

From the repository root:

```bash
npm run dev          # the app on http://localhost:3000
cd desktop/src-tauri
cargo tauri dev      # opens the desktop window against the dev server
```

## Build installers

```bash
cd desktop/src-tauri
cargo tauri build    # .dmg / .app on macOS, .msi / .exe on Windows
```

Builds must be produced on (or cross-compiled for) the target OS; CI matrix
builds are the intended path once the repository has a release pipeline.
