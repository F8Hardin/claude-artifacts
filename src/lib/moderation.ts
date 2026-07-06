// ─── Upload content moderation ───────────────────────────────────────────────
//
// Artifacts are executable documents we host and serve publicly, uploaded by
// untrusted third-party agents. Before anything is made public it is screened
// by a hosted classifier (OpenAI's moderation endpoint). Visibility is gated in
// the database by `is_public`, and a trigger guarantees `is_public` can only be
// true when `moderation_status = 'approved'` — so an artifact is "private until
// cleared" no matter which write path set it.
//
// Statuses:
//   "approved" — the classifier ran and flagged nothing; may be published.
//   "rejected" — the classifier flagged the content; stays private.
//   "pending"  — the classifier could not run (no API key or a transport
//                error). The artifact stays private until it can be cleared,
//                so a misconfiguration fails safe (nothing leaks public).

export type ModerationStatus = "approved" | "rejected" | "pending";

export interface ModerationResult {
  status: ModerationStatus;
  /** Flagged category names when status is "rejected". */
  flagged: string[];
}

// The moderation endpoint is generous but not unbounded, and artifacts can be
// up to 5 MB. Scan a leading window that covers virtually every real artifact;
// oversized minified blobs are truncated (documented limitation).
const MAX_MODERATION_CHARS = 50_000;

const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";

function moderationApiKey(): string | undefined {
  return process.env.MODERATION_API_KEY ?? process.env.OPENAI_API_KEY;
}

/**
 * Screen artifact title/description/content with the hosted classifier.
 * Never throws — on any failure it returns "pending" so the caller keeps the
 * artifact private rather than publishing unscreened content.
 */
export async function moderateArtifact(input: {
  title?: string;
  description?: string;
  content?: string;
}): Promise<ModerationResult> {
  const apiKey = moderationApiKey();
  if (!apiKey) return { status: "pending", flagged: [] };

  const text = [input.title, input.description, input.content]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n\n")
    .slice(0, MAX_MODERATION_CHARS);

  if (!text) return { status: "approved", flagged: [] };

  try {
    const res = await fetch(MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!res.ok) return { status: "pending", flagged: [] };

    const data = (await res.json()) as {
      results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
    };
    const result = data.results?.[0];
    if (!result) return { status: "pending", flagged: [] };

    if (result.flagged) {
      const flagged = Object.entries(result.categories ?? {})
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      return { status: "rejected", flagged };
    }
    return { status: "approved", flagged: [] };
  } catch {
    return { status: "pending", flagged: [] };
  }
}
