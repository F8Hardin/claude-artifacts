import { Suspense } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { ArtifactList } from "@/components/artifact-list";
import { ArtifactCard } from "@/components/artifact-card";
import { fetchTopRated, fetchLatest } from "@/lib/supabase/artifacts";

async function TopRatedSection() {
  const artifacts = await fetchTopRated(5);
  if (artifacts.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Top Rated</h2>
        <Link
          href="/top-rated"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View top 100 →
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
    <section>
      <h2 className="text-xl font-bold tracking-tight mb-4">Latest</h2>
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
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Claude Artifacts
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
