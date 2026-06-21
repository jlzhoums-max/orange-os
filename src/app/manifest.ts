import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orange OS",
    short_name: "Orange OS",
    description: "A private AI-enabled command center for the day.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9fbea",
    theme_color: "#f9fbea",
    categories: ["productivity", "finance", "business"],
    icons: [
      {
        src: "/brand/citrus-logo-mark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/citrus-logo-mark-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "To-do",
        short_name: "To-do",
        description: "Open the To-do tool.",
        url: "/todo",
        icons: [{ src: "/brand/citrus-logo-mark-512.png", sizes: "512x512" }],
      },
      {
        name: "Ledger",
        short_name: "Ledger",
        description: "Open The Ledger tool.",
        url: "/ledger",
        icons: [{ src: "/brand/citrus-logo-mark-512.png", sizes: "512x512" }],
      },
      {
        name: "Real Estate",
        short_name: "Real Estate",
        description: "Open the Real Estate Tool.",
        url: "/real-estate",
        icons: [{ src: "/brand/citrus-logo-mark-512.png", sizes: "512x512" }],
      },
    ],
  };
}
