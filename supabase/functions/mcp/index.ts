import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL =
  Deno.env.get("APP_URL") ??
  "https://claude-artifacts-mu.vercel.app";

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function validateToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const hash = await sha256hex(raw);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb
    .from("personal_access_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  sb.from("personal_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return data.user_id as string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleToSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    "-" +
    Date.now().toString(36)
  );
}

function contentTypeForExt(ext: string): string {
  return ext === ".html"
    ? "text/html; charset=utf-8"
    : "text/plain; charset=utf-8";
}

// PostgREST parses commas and parentheses inside .or() filter strings, and
// % / _ are SQL LIKE wildcards. Strip them so untrusted search text cannot
// inject extra filter conditions or wildcards into an ilike pattern.
function sanitizeIlikeTerm(query: string): string {
  return query.replace(/[,()%_*\\]/g, " ").replace(/\s+/g, " ").trim();
}

const REACT_SOURCE_EXTENSIONS = new Set([".jsx", ".js", ".tsx", ".ts"]);

// Non-blocking static check — never rejects an upload, only warns. Recharts'
// ResponsiveContainer depends on ResizeObserver, which can crash artifacts
// on iOS Safari inside the sandboxed preview iframe; see SETUP_GUIDE.
function lintArtifactSource(content: string, ext: string): string[] {
  if (!REACT_SOURCE_EXTENSIONS.has(ext)) return [];
  if (/\bResponsiveContainer\b/.test(content)) {
    return [
      "Uses Recharts' ResponsiveContainer, which can crash on iOS Safari inside the artifact preview iframe " +
        "(ResizeObserver can report a zero size or fail to settle). Replace with a hand-rolled inline SVG " +
        "chart or pass explicit width/height instead of ResponsiveContainer.",
    ];
  }
  return [];
}

// ─── Moderation ───────────────────────────────────────────────────────────────
// Mirrors src/lib/moderation.ts. Screens artifacts with a hosted classifier
// before they can be made public. Returns "pending" (fail-safe: stays private)
// whenever the classifier can't run, so a missing key never leaks content.

async function moderateContent(input: {
  title?: string;
  description?: string;
  content?: string;
}): Promise<{ status: "approved" | "rejected" | "pending"; flagged: string[] }> {
  const apiKey =
    Deno.env.get("MODERATION_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { status: "pending", flagged: [] };

  const text = [input.title, input.description, input.content]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join("\n\n")
    .slice(0, 50_000);
  if (!text) return { status: "approved", flagged: [] };

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!res.ok) return { status: "pending", flagged: [] };
    const data = await res.json();
    const result = data?.results?.[0];
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

function moderationNotice(
  status: "approved" | "rejected" | "pending",
  flagged: string[]
): string | undefined {
  if (status === "approved") return undefined;
  if (status === "rejected") {
    const cats = flagged.length > 0 ? ` (${flagged.join(", ")})` : "";
    return `Stored privately: automated content review flagged this artifact${cats}, so it cannot be made public.`;
  }
  return "Stored privately: automated content review is unavailable, so this artifact stays private until it can be cleared.";
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  // ── Authenticated tools ───────────────────────────────────────────────────
  {
    name: "upload_artifact",
    description:
      "Upload a new artifact to the user's account. Supports HTML, React (JSX/TSX/JS/TS), " +
      "SVG, Markdown, and Mermaid diagram files. " +
      "Pass file content directly in the `content` field — you can provide the full source of " +
      "a file attachment or code you wrote yourself. " +
      "IMPORTANT: You must set `claude_created` to true only when YOU (Claude) wrote or directly generated " +
      "the artifact content in this conversation. Do not set it to true for content you did not create. " +
      "The response may include a `warnings` array for non-fatal issues detected in the source (e.g. " +
      "Recharts ResponsiveContainer usage) — the upload still succeeds, but you should fix and re-upload. " +
      "Uploaded content is screened by automated moderation: the artifact is stored privately and only " +
      "becomes public once it passes review. The response includes `moderation_status` (approved/pending/" +
      "rejected) and, when not approved, a `notice` explaining why it is still private.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title (max 100 chars)" },
        description: { type: "string", description: "Short description of what the artifact does" },
        content: {
          type: "string",
          description:
            "Full source code or file content (max 5 MB). Paste or pass the complete file content here.",
        },
        extension: {
          type: "string",
          enum: [".html", ".jsx", ".js", ".tsx", ".ts", ".svg", ".md", ".markdown", ".mmd"],
          description:
            ".html (rendered as-is), .jsx/.js/.tsx/.ts (React component preview), " +
            ".svg (rendered as an image), .md/.markdown (rendered as formatted text), " +
            ".mmd (rendered as a Mermaid diagram)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Up to 10 tags (30 chars each) for discovery",
        },
        is_public: {
          type: "boolean",
          description: "Whether the artifact is publicly visible (default true)",
          default: true,
        },
        show_name: {
          type: "boolean",
          description: "Whether to display the author's name on the artifact (default true)",
          default: true,
        },
        claude_created: {
          type: "boolean",
          description:
            "Set to true ONLY if you (Claude) directly wrote or generated this artifact content " +
            "in this conversation. This is your attestation of authorship. " +
            "If you did not create the content, set this to false and the upload will be refused.",
        },
      },
      required: ["title", "content", "extension", "claude_created"],
    },
  },
  {
    name: "list_my_artifacts",
    description: "List all artifacts owned by the authenticated user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_artifact",
    description: "Update metadata and/or content of an existing artifact owned by the user.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        content: {
          type: "string",
          description: "New source code (omit to keep existing)",
        },
        tags: { type: "array", items: { type: "string" } },
        is_public: { type: "boolean" },
        show_name: { type: "boolean", description: "Whether to display the author's name" },
      },
      required: ["slug"],
    },
  },
  {
    name: "delete_artifact",
    description: "Permanently delete an artifact and its stored file.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  // ── Public tools (no auth required, but auth unlocks private artifacts) ───
  {
    name: "search_artifacts",
    description:
      "Search public artifacts by keyword. Searches title, description, and tags. Returns matching artifacts with their slugs and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term" },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_top_artifacts",
    description:
      "Get the most-liked public artifacts. Useful for discovering popular content.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results (default 10, max 50)",
        },
      },
    },
  },
  {
    name: "get_artifact_content",
    description:
      "Download and return the full source code of an artifact so it can be read, analysed, or displayed in the conversation. Works for all public artifacts; requires authentication for private ones.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Artifact slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_artifact_setup_guide",
    description:
      "Get the compatibility guide for building artifacts that can be uploaded to Claude Artifacts. " +
      "Explains what libraries and APIs are available in the browser-based React/TSX preview environment " +
      "(React, TypeScript, Tailwind, Recharts, d3, framer-motion, lucide-react icons) and what is not " +
      "(other npm packages, Node.js/Next.js APIs, etc.), along with the structural rules an artifact must " +
      "follow, plus the other supported file formats (.html, .svg, .md/.markdown, .mmd). Also covers a " +
      "known Recharts ResponsiveContainer crash on iOS Safari and how to avoid it. " +
      "Call this before writing an artifact so it can be uploaded successfully.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Setup guide ───────────────────────────────────────────────────────────────

const SETUP_GUIDE = `Make this artifact compatible with a browser-based JSX/TSX preview that has:
- React 18 (loaded as UMD global — do NOT import React, just use hooks directly)
- TypeScript/TSX is supported (type annotations, interfaces, generics are stripped before running)
- Tailwind CSS (via CDN — all utility classes available)
- Recharts 2.5 (loaded as UMD global) — but avoid ResponsiveContainer, see warning below
- d3 7 and framer-motion 11 (loaded as UMD globals)
- lucide-react icons render with real icon shapes for common icons (X, Check, ChevronDown/Up/Left/Right, Search, Menu, Plus, Minus, Trash2, Edit, Settings, User, Heart, Star, ArrowRight/Left, Download, Upload, Copy, ExternalLink, Info, AlertCircle, CheckCircle, XCircle, Calendar, Clock, Mail, Lock, Eye, EyeOff, Loader2); other icon names fall back to a generic placeholder shape
- No other npm packages available (no axios, no date-fns, etc.)
- No Node.js APIs (no fs, no process, no fetch to relative paths)
- No Next.js features (no next/link, no next/router, no server components)
- Must export default a single function component
- All state, logic, and UI must be in one file
- Use standard browser APIs (fetch to absolute URLs is fine)

Recharts ResponsiveContainer warning: ResponsiveContainer relies on ResizeObserver to measure its parent. Inside the sandboxed/cross-origin preview iframe, iOS Safari's ResizeObserver can report a zero size or fail to settle, and Recharts throws during the commit phase instead of degrading gracefully — this crashes the whole component with an undebuggable "Script error." Avoid ResponsiveContainer entirely. Prefer either a hand-rolled inline SVG chart with a fixed viewBox and width: 100% CSS scaling (no resize observation at all), or Recharts components given an explicit fixed width/height prop instead of ResponsiveContainer. Also avoid scale="log" on axes without an explicit, strictly-positive domain — log scales with an auto domain can resolve toward 0, producing NaN in the rendered path.

Please rewrite the artifact to follow these constraints. Replace any unavailable libraries with inline implementations or remove them.

Other supported formats (uploaded with a different extension, not subject to the JSX/TSX rules above):
- .html — rendered as-is
- .svg — rendered as an image
- .md / .markdown — rendered as styled, formatted text
- .mmd — rendered as a Mermaid diagram`;

// ─── Authenticated tool implementations ───────────────────────────────────────

async function toolUpload(userId: string, args: Record<string, unknown>) {
  // Authorship attestation — only Claude-created content may be uploaded via this tool.
  if (args.claude_created !== true) {
    return {
      error:
        "Upload refused: claude_created must be true. " +
        "This tool only accepts artifacts that Claude directly wrote or generated in this conversation.",
    };
  }

  const title = String(args.title ?? "").trim();
  const description = String(args.description ?? "").trim();
  const content = String(args.content ?? "");
  const extension = String(args.extension ?? ".html");
  const isPublic = args.is_public !== false;
  const showName = args.show_name !== false;
  const rawTags = Array.isArray(args.tags) ? args.tags : [];

  if (!title || title.length > 100)
    return { error: "title is required and must be ≤ 100 chars" };
  if (![".html", ".jsx", ".js", ".tsx", ".ts", ".svg", ".md", ".markdown", ".mmd"].includes(extension))
    return { error: "extension must be one of .html, .jsx, .js, .tsx, .ts, .svg, .md, .markdown, .mmd" };
  if (!content) return { error: "content is required" };
  if (content.length > 5 * 1024 * 1024)
    return { error: "content must be under 5 MB" };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { count } = await sb
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((count ?? 0) >= 100) return { error: "Upload limit reached (100 artifacts)" };

  const tags = rawTags
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10)
    .map((t) => t.slice(0, 30));

  const slug = titleToSlug(title);
  const storagePath = `${userId}/${slug}${extension}`;
  const contentType = contentTypeForExt(extension);

  const { error: upErr } = await sb.storage
    .from("artifacts")
    .upload(storagePath, new Blob([content], { type: contentType }), {
      contentType,
    });
  if (upErr) return { error: `Storage failed: ${upErr.message}` };

  // Screen before publishing. is_public can only be true once approved; the DB
  // trigger enforces this too, but we set it explicitly for clarity.
  const moderation = await moderateContent({ title, description, content });

  const { error: insErr } = await sb.from("artifacts").insert({
    slug,
    title,
    description,
    owner_id: userId,
    storage_path: storagePath,
    tags,
    is_public: isPublic && moderation.status === "approved",
    author_name_visible: showName,
    moderation_status: moderation.status,
  });
  if (insErr) {
    await sb.storage.from("artifacts").remove([storagePath]);
    return { error: `DB insert failed: ${insErr.message}` };
  }
  const warnings = lintArtifactSource(content, extension);
  const notice = moderationNotice(moderation.status, moderation.flagged);
  return {
    slug,
    url: `${SITE_URL}/artifact/${slug}`,
    moderation_status: moderation.status,
    ...(notice ? { notice } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

async function toolListMine(userId: string) {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb
    .from("artifacts")
    .select("slug, title, description, tags, is_public, like_count, created_at, updated_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return {
    artifacts: (data ?? []).map((a) => ({
      ...a,
      url: `${SITE_URL}/artifact/${a.slug}`,
    })),
  };
}

async function toolUpdate(userId: string, args: Record<string, unknown>) {
  const slug = String(args.slug ?? "");
  if (!slug) return { error: "slug is required" };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: existing, error: fetchErr } = await sb
    .from("artifacts")
    .select("storage_path, title, description, tags, is_public, author_name_visible")
    .eq("slug", slug)
    .eq("owner_id", userId)
    .single();
  if (fetchErr || !existing) return { error: "Artifact not found" };

  const newTitle = args.title !== undefined ? String(args.title) : existing.title;
  const newDescription =
    args.description !== undefined
      ? String(args.description)
      : existing.description;
  const contentChanged =
    typeof args.content === "string" && args.content.length > 0;

  let warnings: string[] = [];
  if (contentChanged) {
    const ext = existing.storage_path.match(/\.[^.]+$/)?.[0] ?? ".html";
    const contentType = contentTypeForExt(ext);
    const { error: upErr } = await sb.storage
      .from("artifacts")
      .upload(
        existing.storage_path,
        new Blob([args.content as string], { type: contentType }),
        { contentType, upsert: true }
      );
    if (upErr) return { error: `Storage update failed: ${upErr.message}` };
    warnings = lintArtifactSource(args.content as string, ext);
  }

  // Moderation status tracks the screened *content*, so we only re-screen when
  // the content itself changes (the "pending" result is carried through, so
  // unscreened content stays private). A metadata-only edit must never reassign
  // the verdict: otherwise a benign new title could launder a previously
  // rejected/unscreened file to approved+public. Leave the status untouched.
  let moderationStatus: "approved" | "rejected" | "pending" | undefined;
  let moderationFlagged: string[] = [];
  if (contentChanged) {
    const mod = await moderateContent({
      title: newTitle,
      description: newDescription,
      content: args.content as string,
    });
    moderationStatus = mod.status;
    moderationFlagged = mod.flagged;
  }

  const tags = args.tags
    ? (Array.isArray(args.tags) ? args.tags : [])
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10)
        .map((t) => t.slice(0, 30))
    : existing.tags;

  const { error: updErr } = await sb
    .from("artifacts")
    .update({
      title: newTitle,
      description: newDescription,
      tags,
      is_public: args.is_public ?? existing.is_public,
      author_name_visible: args.show_name ?? existing.author_name_visible,
      ...(moderationStatus ? { moderation_status: moderationStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .eq("owner_id", userId);
  if (updErr) return { error: updErr.message };
  const notice = moderationStatus
    ? moderationNotice(moderationStatus, moderationFlagged)
    : undefined;
  return {
    slug,
    updated: true,
    url: `${SITE_URL}/artifact/${slug}`,
    ...(moderationStatus ? { moderation_status: moderationStatus } : {}),
    ...(notice ? { notice } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

async function toolDelete(userId: string, args: Record<string, unknown>) {
  const slug = String(args.slug ?? "");
  if (!slug) return { error: "slug is required" };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: existing, error: fetchErr } = await sb
    .from("artifacts")
    .select("storage_path")
    .eq("slug", slug)
    .eq("owner_id", userId)
    .single();
  if (fetchErr || !existing) return { error: "Artifact not found" };

  await sb.storage.from("artifacts").remove([existing.storage_path]);
  const { error: delErr } = await sb
    .from("artifacts")
    .delete()
    .eq("slug", slug)
    .eq("owner_id", userId);
  if (delErr) return { error: delErr.message };
  return { slug, deleted: true };
}

// ─── Public tool implementations ──────────────────────────────────────────────

async function toolSearch(args: Record<string, unknown>) {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required" };
  const limit = Math.min(Number(args.limit ?? 20), 50);
  const safe = sanitizeIlikeTerm(query);
  const q = `%${safe}%`;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const [titleRes, tagRes] = await Promise.all([
    // Skip the ilike branch entirely if sanitizing left nothing, so a query of
    // only punctuation can't become "%%" and match every public artifact.
    safe
      ? sb
          .from("artifacts")
          .select("slug, title, description, tags, like_count")
          .or(`title.ilike.${q},description.ilike.${q}`)
          .eq("is_public", true)
          .order("like_count", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("artifacts")
      .select("slug, title, description, tags, like_count")
      .contains("tags", [query.toLowerCase()])
      .eq("is_public", true)
      .order("like_count", { ascending: false })
      .limit(limit),
  ]);

  if (titleRes.error) return { error: titleRes.error.message };

  const seen = new Set((titleRes.data ?? []).map((r) => r.slug));
  const combined = [
    ...(titleRes.data ?? []),
    ...(tagRes.data ?? []).filter((r) => !seen.has(r.slug)),
  ].slice(0, limit);

  return {
    query,
    count: combined.length,
    artifacts: combined.map((a) => ({
      ...a,
      url: `${SITE_URL}/artifact/${a.slug}`,
    })),
  };
}

async function toolTopArtifacts(args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit ?? 10), 50);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb
    .from("artifacts")
    .select("slug, title, description, tags, like_count")
    .eq("is_public", true)
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message };
  return {
    artifacts: (data ?? []).map((a) => ({
      ...a,
      url: `${SITE_URL}/artifact/${a.slug}`,
    })),
  };
}

async function toolGetContent(
  userId: string | null,
  args: Record<string, unknown>
) {
  const slug = String(args.slug ?? "");
  if (!slug) return { error: "slug is required" };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: artifact, error: fetchErr } = await sb
    .from("artifacts")
    .select("slug, title, description, tags, is_public, owner_id, storage_path, like_count")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchErr || !artifact) return { error: "Artifact not found" };

  // Private artifacts require ownership
  if (!artifact.is_public && artifact.owner_id !== userId) {
    return { error: "This artifact is private" };
  }

  const { data: blob, error: storageErr } = await sb.storage
    .from("artifacts")
    .download(artifact.storage_path);
  if (storageErr || !blob)
    return { error: `Could not download artifact: ${storageErr?.message}` };

  const source = await blob.text();

  return {
    slug: artifact.slug,
    title: artifact.title,
    description: artifact.description,
    tags: artifact.tags,
    like_count: artifact.like_count,
    url: `${SITE_URL}/artifact/${artifact.slug}`,
    extension: artifact.storage_path.match(/\.[^.]+$/)?.[0] ?? ".html",
    source,
  };
}

// ─── MCP protocol ─────────────────────────────────────────────────────────────

function ok(id: unknown, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcErr(id: unknown, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Returns true if the request is within the limit. Fails OPEN — a limiter error
// must not take down the API — so this is a throttle, not an auth control.
async function checkRateLimit(
  sb: ReturnType<typeof createClient>,
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await sb.rpc("rate_limit_hit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}

function rateLimited(id: unknown): Response {
  return ok(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: "Rate limit exceeded. Please slow down and try again shortly.",
        }),
      },
    ],
  });
}

const PUBLIC_TOOL_NAMES = new Set([
  "search_artifacts",
  "get_top_artifacts",
  "get_artifact_content",
  "get_artifact_setup_guide",
]);
const WRITE_TOOL_NAMES = new Set([
  "upload_artifact",
  "update_artifact",
  "delete_artifact",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Artifacts-Token, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let body: {
    jsonrpc: string;
    method: string;
    params?: unknown;
    id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { method, params, id } = body;

  // ── No-auth methods ────────────────────────────────────────────────────────

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "claude-artifacts", version: "1.0.0" },
    });
  }

  if (method?.startsWith("notifications/")) {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // tools/list is always available — clients discover tools before auth
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  // ── Resolve optional token ─────────────────────────────────────────────────

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const rawToken = req.headers.get("X-Artifacts-Token") || bearerToken || "";
  const userId = rawToken ? await validateToken(rawToken) : null;

  // ── Tool calls ─────────────────────────────────────────────────────────────

  if (method === "tools/call") {
    const p = (params ?? {}) as {
      name: string;
      arguments?: Record<string, unknown>;
    };
    const args = p.arguments ?? {};

    const rlSb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Public tools are unauthenticated, so throttle per client IP.
    if (PUBLIC_TOOL_NAMES.has(p.name)) {
      if (!(await checkRateLimit(rlSb, `mcp:pub:${clientIp(req)}`, 120, 60))) {
        return rateLimited(id);
      }
    }

    // Public tools — no auth required
    if (p.name === "search_artifacts") {
      const result = await toolSearch(args);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    }
    if (p.name === "get_top_artifacts") {
      const result = await toolTopArtifacts(args);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    }
    if (p.name === "get_artifact_content") {
      const result = await toolGetContent(userId, args);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    }
    if (p.name === "get_artifact_setup_guide") {
      return ok(id, {
        content: [{ type: "text", text: SETUP_GUIDE }],
      });
    }

    // Authenticated tools
    if (!userId) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32001, message: "Authentication required" },
        }),
        {
          status: 401,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="claude-artifacts", as_uri="${SITE_URL}"`,
          },
        }
      );
    }

    // Per-user throttle: a general budget for all authed calls plus a stricter
    // budget for writes (upload/update/delete), which are the abuse-prone ones.
    if (!(await checkRateLimit(rlSb, `mcp:user:${userId}`, 300, 60))) {
      return rateLimited(id);
    }
    if (WRITE_TOOL_NAMES.has(p.name)) {
      if (!(await checkRateLimit(rlSb, `mcp:write:${userId}`, 40, 3600))) {
        return rateLimited(id);
      }
    }

    let result: unknown;
    switch (p.name) {
      case "upload_artifact":
        result = await toolUpload(userId, args);
        break;
      case "list_my_artifacts":
        result = await toolListMine(userId);
        break;
      case "update_artifact":
        result = await toolUpdate(userId, args);
        break;
      case "delete_artifact":
        result = await toolDelete(userId, args);
        break;
      default:
        return rpcErr(id, -32601, `Unknown tool: ${p.name}`);
    }
    return ok(id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    });
  }

  return rpcErr(id, -32601, `Method not found: ${method}`);
});
