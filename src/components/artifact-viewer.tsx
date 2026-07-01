"use client";

import { useState } from "react";

export function ArtifactViewer({
  previewUrl,
  title,
}: {
  previewUrl: string;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="absolute inset-0">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-950 z-10">
          <svg className="animate-spin h-8 w-8 text-neutral-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      )}
      <iframe
        src={previewUrl}
        title={title}
        className="block h-full w-full border-0"
        sandbox="allow-scripts allow-modals"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
