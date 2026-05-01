import { Suspense } from "react";
import { SearchBar } from "@/components/search-bar";
import { ArtifactList } from "@/components/artifact-list";

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
      <ArtifactList query={q} />
    </main>
  );
}
