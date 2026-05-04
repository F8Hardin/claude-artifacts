"use client";

import { useState } from "react";
import Link from "next/link";
import { Artifact } from "@/lib/artifacts";

function getAuthorLabel(artifact: Artifact): string {
  if (!artifact.author_name_visible) return "anonymous";
  return artifact.author_username ?? "anonymous";
}

export function ArtifactInfoPanel({
  artifact,
  canEdit,
}: {
  artifact: Artifact;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="absolute inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.07)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex min-h-12 items-center gap-3 py-1.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
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
              by {getAuthorLabel(artifact)} &middot;{" "}
              {new Date(artifact.created_at).toLocaleDateString()}
            </p>
          </div>

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
          </div>
        )}
      </div>
    </section>
  );
}
