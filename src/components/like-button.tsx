"use client";

import { useState } from "react";
import { toggleLike } from "@/lib/supabase/likes";

export function LikeButton({
  artifactId,
  artifactSlug,
  initialCount,
  initialLiked,
  isAuthenticated,
}: {
  artifactId: string;
  artifactSlug: string;
  initialCount: number;
  initialLiked: boolean;
  isAuthenticated: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!isAuthenticated || pending) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    await toggleLike(artifactId, artifactSlug);
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={isAuthenticated ? (liked ? "Unlike" : "Like") : "Sign in to like"}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        liked
          ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
          : isAuthenticated
          ? "border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          : "border-neutral-200 text-neutral-400 dark:border-neutral-800 cursor-default"
      }`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
