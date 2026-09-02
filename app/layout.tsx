import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "tailwind-variants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DOMAIN_URL = "upstreamdev.vercel.app";
const TITLE = "Upstream";
const DESCRIPTION =
  "A weekly digest of releases from the repos you depend on. Upstream reads every changelog, flags breaking changes, and tells you how much work the upgrade is.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · Upstream",
  },
  description: DESCRIPTION,
  keywords: [
    "changelog",
    "release notes",
    "dependencies",
    "breaking changes",
    "developer tools",
  ],
  authors: [{ name: "Your Name", url: "https://github.com/anywaylupin" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: DOMAIN_URL,
    siteName: TITLE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full antialiased",
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
