"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string | null;
};

export function CommentsSection({
  artifactId,
  currentUserId,
}: {
  artifactId: string;
  currentUserId: string | null;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("comments")
      .select("id, body, created_at, user_id")
      .eq("artifact_id", artifactId)
      .order("created_at", { ascending: true });

    if (!rows || rows.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, github_username")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; username: string | null; github_username: string | null }) => [p.id, p])
    );

    setComments(
      rows.map((r: { id: string; body: string; created_at: string; user_id: string }) => {
        const profile = profileMap.get(r.user_id) as { username: string | null; github_username: string | null } | undefined;
        return {
          ...r,
          username: profile?.username ?? profile?.github_username ?? null,
        };
      })
    );
    setLoading(false);
  }, [artifactId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !currentUserId) return;
    setSubmitting(true);

    const supabase = createClient();
    await supabase.from("comments").insert({
      artifact_id: artifactId,
      user_id: currentUserId,
      body: draft.trim(),
    });

    setDraft("");
    setSubmitting(false);
    await loadComments();
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient();
    await supabase.from("comments").delete().eq("id", commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="mt-4 border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Comments{!loading && comments.length > 0 && ` (${comments.length})`}
      </h3>

      {loading ? (
        <p className="text-xs text-neutral-400">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-neutral-400">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {c.username ? (
                    <Link
                      href={`/user/${c.username}`}
                      className="text-xs font-semibold hover:underline"
                    >
                      {c.username}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-400">
                      anonymous
                    </span>
                  )}
                  <span className="text-xs text-neutral-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5 leading-snug">
                  {c.body}
                </p>
              </div>
              {c.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 text-neutral-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 text-base leading-none mt-0.5"
                  aria-label="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {currentUserId ? (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            maxLength={1000}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Post
          </button>
        </form>
      ) : (
        <p className="text-xs text-neutral-400 pt-1">
          <Link href="/login" className="underline hover:text-neutral-600">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}
    </div>
  );
}
