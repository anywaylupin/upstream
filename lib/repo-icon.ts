/**
 * GitHub has no repo logo, so the closest thing is the icon of the repo's homepage.
 * The homepage is set by the repo owner, so it is untrusted: https only, public hostnames only, a short timeout and a size cap.
 */
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|\d+\.\d+\.\d+\.\d+|\[.*\])$/i;
const MAX_BYTES = 64 * 1024;

function publicHttps(raw: string, base?: URL): URL | null {
  try {
    const url = new URL(raw, base);
    return url.protocol === 'https:' && !PRIVATE_HOST.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** Best icon link in a page's <head>: apple-touch-icon is square and large, plain icon next. */
export function pickIcon(html: string, base: URL): string | null {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const attr = (tag: string, name: string) =>
    tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? null;

  for (const rel of ['apple-touch-icon', 'icon', 'shortcut icon']) {
    const tag = links.find((l) => attr(l, 'rel')?.toLowerCase().split(/\s+/).join(' ') === rel);
    const href = tag && attr(tag, 'href');
    const url = href && !href.startsWith('data:') ? publicHttps(href, base) : null;
    if (url) return url.href;
  }
  return null;
}

/** The icon links live in <head>; the first 64 KB is plenty. */
export async function findRepoIcon(homepage: string | null | undefined): Promise<string | null> {
  const page = homepage ? publicHttps(homepage.includes('://') ? homepage : `https://${homepage}`) : null;
  if (!page) return null;

  try {
    const res = await fetch(page, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.body || !publicHttps(res.url)) return null;
    if (!res.headers.get('content-type')?.includes('text/html')) return null;

    const reader = res.body.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    return pickIcon(html, new URL(res.url));
  } catch {
    return null;
  }
}
