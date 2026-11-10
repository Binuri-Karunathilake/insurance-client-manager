import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Client Manager",
    short_name: "Clients",
    description: "Clients, policies, reminders and documents for an insurance agent.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f5f7",
    theme_color: "#2346b8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
