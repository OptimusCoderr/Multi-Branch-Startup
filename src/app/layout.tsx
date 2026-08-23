import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { readThemeCookie } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display face for headings/nav/buttons — a distinctive geometric
// sans, paired with Geist for body copy. globals.css maps this to
// `--font-display`, consumed via Tailwind's `font-display` utility.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Branch Inventory",
  description: "Multi-tenant inventory management for companies with multiple branches.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readThemeCookie();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
