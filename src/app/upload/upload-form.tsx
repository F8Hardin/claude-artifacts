"use client";

import { useRef, useState } from "react";
import { uploadArtifact } from "./actions";

function CompatibilityGuide() {
  const [open, setOpen] = useState(false);

  const promptText = `Make this artifact compatible with a browser-based JSX preview that has:
- React 18 (loaded as UMD global — do NOT import React, just use hooks directly)
- Tailwind CSS (via CDN — all utility classes available)
- Recharts 2.5 (loaded as UMD global)
- No other npm packages available (no axios, no framer-motion, no date-fns, etc.)
- lucide-react icons render as generic placeholders — replace with inline SVGs or emoji
- No Node.js APIs (no fs, no process, no fetch to relative paths)
- No Next.js features (no next/link, no next/router, no server components)
- Must export default a single function component
- All state, logic, and UI must be in one file
- Use standard browser APIs (fetch to absolute URLs is fine)

Please rewrite the artifact to follow these constraints. Replace any unavailable libraries with inline implementations or remove them.`;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded-lg transition-colors"
      >
        <span>Compatibility Guide for JSX/JS Artifacts</span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm text-neutral-600 dark:text-neutral-300">
          <div>
            <h4 className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
              Available in the preview environment:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>React 18</strong> — hooks, JSX, all standard APIs</li>
              <li><strong>Tailwind CSS</strong> — all utility classes</li>
              <li><strong>Recharts 2.5</strong> — charts and data visualization</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
              Not available:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Other npm packages (axios, framer-motion, date-fns, etc.)</li>
              <li>lucide-react icons (imports won&apos;t error but render as generic circles)</li>
              <li>Node.js / Next.js APIs</li>
              <li>Relative fetch paths or server-side logic</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
              Rules:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Must <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">export default</code> a single function component</li>
              <li>Everything in one file — no multi-file imports</li>
              <li>Use inline SVGs or emoji instead of icon libraries</li>
              <li>Use browser <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">fetch()</code> with absolute URLs if needed</li>
            </ul>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
            <h4 className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
              Paste this prompt to Claude to fix your artifact:
            </h4>
            <div className="relative">
              <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md p-3 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                {promptText}
              </pre>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(promptText)}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Copy this prompt, paste it into Claude along with your artifact code, and it will rewrite it to be compatible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function UploadForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function handleSubmit(formData: FormData) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setPending(true);
    const result = await uploadArtifact(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
      submitting.current = false;
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

      {/* Compatibility Guide */}
      <CompatibilityGuide />

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
          accept=".html,.jsx,.js,text/html,text/javascript,application/javascript,text/plain"
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
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {pending && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {pending ? "Uploading…" : "Upload Artifact"}
      </button>
    </form>
  );
}
