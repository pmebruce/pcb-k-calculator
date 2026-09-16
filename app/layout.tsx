import type { Metadata, Viewport } from "next";
import { APP_ICON_DATA_URL, APPLE_ICON_DATA_URL } from "@/lib/app-icons";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

const title = "pcb-k計算";
const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://pcb-k-lab-yc.ycchiu15.chatgpt.site").replace(/\/$/, "");
const description = "逐層設定 PCB 銅厚與覆銅率，計算板面與厚度方向等效導熱係數。手機大字介面，支援離線使用。";
export const metadata: Metadata = {
  title, description, applicationName: title,
  appleWebApp: { capable: true, title, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: APP_ICON_DATA_URL, sizes: "192x192", type: "image/png" }],
    apple: [{ url: APPLE_ICON_DATA_URL, sizes: "180x180", type: "image/png" }],
    shortcut: APP_ICON_DATA_URL,
  },
  openGraph: { title, description, type: "website", locale: "zh_TW", url: origin, images: [{ url: `${origin}/og.png`, alt: "PCB — Thermal Conductivity Calculator" }] },
  twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  other: { "mobile-web-app-capable": "yes", "apple-mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#164c3a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><head><link rel="manifest" href={withBasePath("/pcb-k.webmanifest")} crossOrigin="use-credentials" /></head><body>{children}</body></html>;
}
