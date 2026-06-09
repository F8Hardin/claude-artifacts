import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://claude-artifacts-f8hardins-projects.vercel.app";

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
  // Update last_used_at — fire and forget
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
  return ext === ".jsx" || ext === ".js"
    ? "text/plain; charset=utf-8"
    : "text/html; charset=utf-8";
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "upload_artifact",
    description: "Upload a new HTML/JSX/JS artifact to the user's account.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title (max 100 chars)" },
        description: { type: "string", description: "Short description" },
        content: { type: "string", description: "Full source code" },
        extension: { type: "string", enum: [".html", ".jsx", ".js"] },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Max 10 tags, 30 chars each",
        },
        is_public: { type: "boolean", default: true },
      },
      required: ["title", "content", "extension"],
    },
  },
  {
    name: "list_artifacts",
    description: "List all artifacts owned by the authenticated user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_artifact",
    description: "Update metadata and/or content of an existing artifact.",
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
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function toolUpload(userId: string, args: Record<string, unknown>) {
  const title = String(args.title ?? "").trim();
  const description = String(args.description ?? "").trim();
  const content = String(args.content ?? "");
  const extension = String(args.extension ?? ".html");
  const isPublic = args.is_public !== false;
  const rawTags = Array.isArray(args.tags) ? args.tags : [];

  if (!title || title.length > 100)
    return { error: "title is required and must be ≤ 100 chars" };
  if (![".html", ".jsx", ".js"].includes(extension))
    return { error: "extension must be .html, .jsx, or .js" };
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

  const { error: insErr } = await sb.from("artifacts").insert({
    slug,
    title,
    description,
    owner_id: userId,
    storage_path: storagePath,
    tags,
    is_public: isPublic,
    author_name_visible: true,
  });
  if (insErr) {
    await sb.storage.from("artifacts").remove([storagePath]);
    return { error: `DB insert failed: ${insErr.message}` };
  }
  return { slug, url: `/artifact/${slug}` };
}

async function toolList(userId: string) {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb
    .from("artifacts")
    .select("slug, title, description, tags, is_public, created_at, updated_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { artifacts: data ?? [] };
}

async function toolUpdate(userId: string, args: Record<string, unknown>) {
  const slug = String(args.slug ?? "");
  if (!slug) return { error: "slug is required" };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: existing, error: fetchErr } = await sb
    .from("artifacts")
    .select("storage_path, title, description, tags, is_public")
    .eq("slug", slug)
    .eq("owner_id", userId)
    .single();
  if (fetchErr || !existing) return { error: "Artifact not found" };

  if (typeof args.content === "string" && args.content.length > 0) {
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
      title: args.title ?? existing.title,
      description: args.description ?? existing.description,
      tags,
      is_public: args.is_public ?? existing.is_public,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .eq("owner_id", userId);
  if (updErr) return { error: updErr.message };
  return { slug, updated: true };
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

// ─── MCP protocol ─────────────────────────────────────────────────────────────

function ok(id: unknown, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcErr(id: unknown, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

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
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { method, params, id } = body;

  // initialize and notifications don't require auth
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

  // Resolve token from either custom header or Authorization: Bearer
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const rawToken =
    req.headers.get("X-Artifacts-Token") || bearerToken || "";

  if (!rawToken) {
    // Return 401 with OAuth discovery so clients can find the auth server
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32001, message: "Authentication required" } }),
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

  const userId = await validateToken(rawToken);
  if (!userId) return rpcErr(id, -32001, "Invalid or expired token");

  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const p = (params ?? {}) as {
      name: string;
      arguments?: Record<string, unknown>;
    };
    const args = p.arguments ?? {};
    let result: unknown;
    switch (p.name) {
      case "upload_artifact":
        result = await toolUpload(userId, args);
        break;
      case "list_artifacts":
        result = await toolList(userId);
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
