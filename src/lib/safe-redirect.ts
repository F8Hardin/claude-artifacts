// Returns a safe same-origin destination for post-auth redirects.
//
// Only a plain absolute path is allowed. Everything else collapses to "/".
// In particular this rejects values a browser can resolve to an external
// origin — protocol-relative ("//evil.com"), backslash tricks ("/\\evil.com"),
// and non-path values ("@evil.com", "https://evil.com") — which would
// otherwise be open-redirect vectors when interpolated into a redirect target.
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
