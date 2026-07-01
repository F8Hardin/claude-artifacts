// Non-blocking static checks for known runtime footguns in uploaded artifact
// source. These only ever warn — they must never reject an upload.

const REACT_SOURCE_EXTENSIONS = new Set([".jsx", ".js", ".tsx", ".ts"]);

// Recharts' <ResponsiveContainer> measures its parent via ResizeObserver.
// Inside the sandboxed/cross-origin preview iframe, iOS Safari's
// ResizeObserver can report a zero size or fail to settle, and Recharts
// throws during the commit phase instead of degrading gracefully.
const RESPONSIVE_CONTAINER_PATTERN = /\bResponsiveContainer\b/;

export type ArtifactLintWarning = "responsive-container";

export function lintArtifactSource(
  source: string,
  fileExt: string
): ArtifactLintWarning[] {
  if (!REACT_SOURCE_EXTENSIONS.has(fileExt)) return [];
  const warnings: ArtifactLintWarning[] = [];
  if (RESPONSIVE_CONTAINER_PATTERN.test(source)) {
    warnings.push("responsive-container");
  }
  return warnings;
}
