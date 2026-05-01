"use client";

export function ArtifactViewer({
  file,
  title,
}: {
  file: string;
  title: string;
}) {
  return (
    <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800">
      <iframe
        src={`/artifacts/${file}`}
        title={title}
        className="w-full h-[calc(100vh-220px)] border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
