"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="User menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
      >
        <span className="flex flex-col gap-1" aria-hidden="true">
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
          <Link
            href="/my-artifacts"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            My artifacts
          </Link>
          <Link
            href="/liked-artifacts"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Liked artifacts
          </Link>
          <Link
            href="/personal-access-tokens"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            My Personal Access Tokens
          </Link>
        </div>
      )}
    </div>
  );
}
