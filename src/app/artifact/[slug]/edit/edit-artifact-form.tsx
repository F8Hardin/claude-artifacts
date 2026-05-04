"use client";

import { useState } from "react";
import { Artifact } from "@/lib/artifacts";
import { deleteArtifactDetails, updateArtifactDetails } from "../actions";

export function EditArtifactForm({ artifact }: { artifact: Artifact }) {
  const [updatePending, setUpdatePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(formData: FormData) {
    setError(null);
    setUpdatePending(true);
    const result = await updateArtifactDetails(artifact.slug, formData);

    if (result?.error) {
      setError(result.error);
      setUpdatePending(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${artifact.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError(null);
    setDeletePending(true);
    const result = await deleteArtifactDetails(artifact.slug);

    if (result?.error) {
      setError(result.error);
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-8">
      <form action={handleUpdate} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={artifact.title}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            htmlFor="description"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={artifact.description}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="tags">
            Tags{" "}
            <span className="font-normal text-neutral-400">
              (comma-separated)
            </span>
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            defaultValue={artifact.tags.join(", ")}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <input type="hidden" name="is_public" value="false" />
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="is_public"
              value="true"
              defaultChecked={artifact.is_public}
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
              defaultChecked={artifact.author_name_visible}
              className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium">Show my name</span>
          </label>
          <span className="text-xs text-neutral-400">
            Hidden names display as anonymous
          </span>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={updatePending || deletePending}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {updatePending ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6">
        <button
          type="button"
          onClick={handleDelete}
          disabled={updatePending || deletePending}
          className="w-full py-2.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
        >
          {deletePending ? "Deleting..." : "Delete Artifact"}
        </button>
      </div>
    </div>
  );
}
