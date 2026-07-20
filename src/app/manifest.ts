import type { MetadataRoute } from "next";

/*
 * PWA manifest: the installed app opens on the workspace and stands alone.
 * Colors are the design tokens from globals.css (paper ground, ink mark);
 * the icons are the leaded-window set built by scripts/build-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Berean",
    short_name: "Berean",
    description:
      "Scripture study and authored knowledge. A study prepared, by Church Posting.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#f3ecdd",
    theme_color: "#f3ecdd",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
