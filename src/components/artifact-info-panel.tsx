"use client";

import { useState } from "react";
import Link from "next/link";
import { Artifact } from "@/lib/artifacts";
import { CommentsSection } from "@/components/comments-section";
import { LikeButton } from "@/components/like-button";

function getAuthorLabel(artifact: Artifact): string {
  if (!artifact.author_name_visible) return "anonymous";
  return artifact.author_username ?? "anonymous";
}

const LINT_WARNING_MESSAGES: Record<string, string> = {
  "responsive-container":
    "This artifact uses Recharts' ResponsiveContainer, which can crash on iOS Safari inside the artifact preview iframe (ResizeObserver can report a zero size or fail to settle). Consider a hand-rolled inline SVG chart, or pass explicit width/height instead of ResponsiveContainer.",
};

export function ArtifactInfoPanel({
  artifact,
  canEdit,
  currentUserId,
  userHasLiked,
  lintWarnings = [],
}: {
  artifact: Artifact;
  canEdit: boolean;
  currentUserId: string | null;
  userHasLiked: boolean;
  lintWarnings?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);

  const visibleWarnings = lintWarnings.filter(
    (w) => LINT_WARNING_MESSAGES[w] && !dismissedWarnings.includes(w)
  );

  // Only the owner sees moderation state, and only when it isn't approved
  // (an approved artifact needs no banner).
  const reviewNotice =
    canEdit && artifact.moderation_status !== "approved"
      ? artifact.moderation_status === "rejected"
        ? {
            tone: "reject" as const,
            text: "This artifact was flagged by automated content review and can't be made public. Edit it to comply with the content policy, then re-save to request another review.",
          }
        : {
            tone: "pending" as const,
            text: "This artifact is awaiting automated content review and stays private until it's cleared. If review is currently unavailable, it remains private until it can run.",
          }
      : null;

  return (
    <section className="absolute inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.07)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto max-w-5xl px-4">
        {reviewNotice && (
          <div
            className={
              reviewNotice.tone === "reject"
                ? "border-b border-red-200 bg-red-50 px-1 py-2 text-xs leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                : "border-b border-blue-200 bg-blue-50 px-1 py-2 text-xs leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
            }
          >
            {reviewNotice.text}
          </div>
        )}
        {visibleWarnings.map((w) => (
          <div
            key={w}
            className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-1 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <span className="flex-1 leading-relaxed">{LINT_WARNING_MESSAGES[w]}</span>
            <button
              type="button"
              onClick={() => setDismissedWarnings((prev) => [...prev, w])}
              className="shrink-0 font-medium hover:underline"
            >
              Dismiss
            </button>
          </div>
        ))}
        <div className="flex min-h-12 items-center gap-3 py-1.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 text-base leading-none hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {expanded ? "v" : "^"}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-semibold">
                {artifact.title}
              </h1>
              {!artifact.is_public && (
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                  Private
                </span>
              )}
            </div>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {artifact.author_name_visible && artifact.author_username ? (
                <>
                  by{" "}
                  <Link
                    href={`/user/${artifact.author_username}`}
                    className="hover:underline"
                  >
                    {artifact.author_username}
                  </Link>
                  {" "}
                </>
              ) : (
                <>by anonymous &middot; </>
              )}
              {new Date(artifact.created_at).toLocaleDateString(undefined, { timeZone: "UTC" })}
            </p>
          </div>

          <LikeButton
            artifactId={artifact.id}
            artifactSlug={artifact.slug}
            initialCount={artifact.like_count}
            initialLiked={userHasLiked}
            isAuthenticated={!!currentUserId}
          />

          {canEdit && (
            <Link
              href={`/artifact/${artifact.slug}/edit`}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Edit
            </Link>
          )}
        </div>

        {expanded && (
          <div className="max-h-[45vh] overflow-y-auto pb-5 pt-1">
            {artifact.description && (
              <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {artifact.description}
              </p>
            )}

            {artifact.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {artifact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="mt-4 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {showComments ? "Hide comments" : "View comments"}
            </button>

            {showComments && (
              <CommentsSection
                artifactId={artifact.id}
                currentUserId={currentUserId}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
