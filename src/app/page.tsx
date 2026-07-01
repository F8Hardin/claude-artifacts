import { Suspense } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { ArtifactList } from "@/components/artifact-list";
import { ArtifactCard } from "@/components/artifact-card";
import { fetchTopRated, fetchLatest } from "@/lib/supabase/artifacts";

const sectionCard =
  "rounded-2xl border border-neutral-400 dark:border-neutral-700 " +
  "bg-neutral-100 dark:bg-[#0d0d0d] p-6 " +
  "shadow-[4px_4px_24px_rgba(0,0,0,0.10)] dark:shadow-[4px_4px_24px_rgba(0,0,0,0.8)]";

async function TopRatedSection() {
  const artifacts = await fetchTopRated(6);
  if (artifacts.length === 0) return null;
  return (
    <section className={`mb-8 ${sectionCard}`}>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-display text-4xl tracking-wider">Top Rated</h2>
        <Link
          href="/top-rated"
          className="font-display text-2xl tracking-wider text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          View Top 100 →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artifacts.map((artifact) => (
          <ArtifactCard key={artifact.slug} artifact={artifact} />
        ))}
      </div>
    </section>
  );
}

async function LatestSection() {
  const artifacts = await fetchLatest(10);
  if (artifacts.length === 0) return null;
  return (
    <section className={sectionCard}>
      <h2 className="font-display text-4xl tracking-wider mb-5">Latest</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artifacts.map((artifact) => (
          <ArtifactCard key={artifact.slug} artifact={artifact} />
        ))}
      </div>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl sm:text-6xl tracking-wide sm:tracking-widest mb-2">
          Claude Artifacts Glossary
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Interactive artifacts built with Claude. Click to explore.
        </p>
      </div>
      <div className="flex justify-center mb-8">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {q ? (
        <ArtifactList query={q} />
      ) : (
        <>
          <TopRatedSection />
          <LatestSection />
        </>
      )}
    </main>
  );
}
