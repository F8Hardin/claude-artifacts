import Link from "next/link";
import { Artifact } from "@/lib/artifacts";

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <Link
      href={`/artifact/${artifact.slug}`}
      className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 transition-all hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500"
    >
      <h2 className="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {artifact.title}
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
        {artifact.description}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>{artifact.author}</span>
        <span>{artifact.createdAt}</span>
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
