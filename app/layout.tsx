import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cn } from 'tailwind-variants';
import { AppHeader } from '@/components/app-header';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { THEME_SCRIPT } from '@/lib/theme';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const DOMAIN_URL = 'https://upstreamdev.vercel.app';
export const TITLE = 'Upstream';
export const DESCRIPTION =
  'A weekly digest of releases from the repos you depend on. Upstream reads every changelog, flags breaking changes, and tells you how much work the upgrade is.';

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: '%s · Upstream'
  },
  description: DESCRIPTION,
  keywords: ['changelog', 'release notes', 'dependencies', 'breaking changes', 'developer tools'],
  authors: [{ name: 'Your Name', url: 'https://github.com/anywaylupin' }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: DOMAIN_URL,
    siteName: TITLE,
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION
  }
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={cn(geistSans.variable, geistMono.variable, geistSans.className, 'h-full antialiased')}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delay={300}>
          <AppShell header={<AppHeader />}>{children}</AppShell>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
