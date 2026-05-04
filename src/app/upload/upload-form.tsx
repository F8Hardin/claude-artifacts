"use client";

import { useState } from "react";
import { uploadArtifact } from "./actions";

export function UploadForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await uploadArtifact(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
    // On success, uploadArtifact calls redirect() — no explicit handling needed
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="tags">
          Tags{" "}
          <span className="font-normal text-neutral-400">(comma-separated)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          placeholder="e.g. game, javascript, education"
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* File */}
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="file">
          Artifact File{" "}
          <span className="font-normal text-neutral-400">(.html, .jsx, .js — max 5 MB)</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".html,.jsx,.js,text/html,application/javascript"
          required
          className="w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-neutral-100 dark:file:bg-neutral-800 file:text-sm file:font-medium cursor-pointer"
        />
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <input
          type="hidden"
          name="is_public"
          value="false"
        />
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            name="is_public"
            value="true"
            defaultChecked
            className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">Make public</span>
        </label>
        <span className="text-xs text-neutral-400">
          Public artifacts are visible to everyone
        </span>
      </div>

      <div className="flex items-center gap-3">
        <input type="hidden" name="author_name_visible" value="false" />
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            name="author_name_visible"
            value="true"
            defaultChecked
            className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">Show my name</span>
        </label>
        <span className="text-xs text-neutral-400">
          Hidden names display as anonymous
        </span>
      </div>

      {/* Copyright disclaimer */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Copyright &amp; Content Policy
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          By uploading, you confirm that this content is your original work or
          that you have the legal right to share it. Do not upload content that
          violates copyright, infringes on intellectual property, or breaks any
          applicable laws. Uploaded content may be removed if reported as
          infringing.
        </p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="agree_terms"
            value="true"
            required
            className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
            I confirm I have the rights to share this content and it does not
            violate any copyright or applicable laws.
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Uploading…" : "Upload Artifact"}
      </button>
    </form>
  );
}
