# Berean Desktop (Mac & Windows)

A Tauri shell around the Berean application; see `docs/adr/0002-platform-and-sync.md`
for the platform decision. This first iteration is a thin shell that loads the
deployed app; a later iteration bundles a static export with a local passage
API for fully offline study.

## State of the shell

The shell is one build away from a Windows installer. Icons, bundle metadata,
and the CSP are in place; what remains is a Rust toolchain and a deployed URL.
Three steps, from the repository root:

1. Install Rust (stable, via https://rustup.rs) and the Tauri CLI:
   `cargo install tauri-cli --version '^2'`. On Windows the MSVC build tools
   and WebView2 (ships with Windows 11) are also required.
2. Point the shell at the deployed server (see DEPLOY.md for hosting):
   `node scripts/set-tauri-url.mjs https://your-host`
3. `cd desktop/src-tauri && cargo tauri build`. The NSIS `.exe` installer
   lands under `desktop/src-tauri/target/release/bundle/nsis/`.

No cargo build has run on this repo yet; everything above the Rust toolchain
is verified statically (config parses, icons match the names `bundle.icon`
declares).

## The server URL

`src-tauri/tauri.conf.json` holds the target in four places that must agree:
`build.devUrl`, `build.frontendDist`, `app.windows[0].url`, and the deployed
origin inside `app.security.csp`. `scripts/set-tauri-url.mjs` rewrites all
four from one argument (or the `BEREAN_URL` environment variable), refuses
non-HTTPS origins outside localhost, and is the only supported way to change
the target. The URL is compiled into the installer at build time, so set it
before every release build. The committed config points at
`http://localhost:3000` for development.

## Icons

`node scripts/build-icons.mjs` regenerates the whole icon set, including
`src-tauri/icons/` (32x32.png, 128x128.png, 128x128@2x.png, icon.png at 512,
and icon.ico with PNG frames from 16 to 256). The generator is pure Node and
draws the same leaded-window mark as the PWA icons, so the set is
reproducible with no external assets. The Square\*Logo.png Store set is
absent on purpose: it only matters to MSIX packaging, which the shell does
not target. A future macOS build will need icon.icns, which
`cargo tauri icon src-tauri/icons/icon.png` produces on a Mac.

## CSP

`app.security.csp` replaces the permissive `null`. The policy admits the
shell protocol and the deployed origin (`default-src 'self' <origin>`),
`data:` and `blob:` images for the generated SVG selection cards and the
blob downloads, `data:` fonts, and archive.org in `media-src` for the
LibriVox chapter audio (streamed, never vendored; see `src/lib/audio.ts`).
`connect-src` keeps the Tauri IPC bridge (`ipc:`, `http://ipc.localhost`)
reachable, which a custom policy must do explicitly per the Tauri 2 security
docs. `script-src` and `style-src` keep `unsafe-inline` because the served
Next.js app hydrates from inline scripts and inline styles. The policy is
written by `scripts/set-tauri-url.mjs`; edit it there, not in the JSON.
While the window loads a remote origin, that origin's own response headers
govern its content; this policy covers the shell's local pages and becomes
the operative policy when the static-export iteration bundles the frontend.

## Bundle choices

`productName` is "Berean", `identifier` `com.churchposting.berean`,
publisher Church Posting, category Reference. The version field tracks the
root `package.json`. Windows bundles target NSIS rather than WiX: NSIS
builds with no extra toolchain download and produces the single `.exe`
installer users expect. A WiX `.msi` can join the targets list if managed
deployment ever asks for one.

## Develop

From the repository root:

```bash
npm run dev          # the app on http://localhost:3000
cd desktop/src-tauri
cargo tauri dev      # opens the desktop window against the dev server
```

Builds must be produced on (or cross-compiled for) the target OS; CI matrix
builds are the intended path once the repository has a release pipeline.
