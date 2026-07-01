import Link from "next/link";
import { Artifact } from "@/lib/artifacts";

function getAuthorLabel(artifact: Artifact): string {
  if (!artifact.author_name_visible) return "anonymous";
  return artifact.author_username ?? "anonymous";
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <Link
      href={`/artifact/${artifact.slug}`}
      className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {artifact.title}
        </h2>
        {!artifact.is_public && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            Private
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
        {artifact.description}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>{getAuthorLabel(artifact)}</span>
        <div className="flex items-center gap-2.5">
          {artifact.like_count > 0 && (
            <span className="flex items-center gap-1">
              <span aria-hidden>♥</span>
              {artifact.like_count}
            </span>
          )}
          <span>{new Date(artifact.created_at).toLocaleDateString(undefined, { timeZone: "UTC" })}</span>
        </div>
      </div>
      {artifact.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {artifact.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
