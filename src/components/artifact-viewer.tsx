"use client";

export function ArtifactViewer({
  previewUrl,
  title,
}: {
  previewUrl: string;
  title: string;
}) {
  return (
    <div className="absolute inset-0">
      <iframe
        src={previewUrl}
        title={title}
        className="block h-full w-full border-0"
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
      />
    </div>
  );
}
