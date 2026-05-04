"use client";

import { useState } from "react";
import { signInWithEmail, signUpWithEmail } from "./actions";

function createDefaultUsername(): string {
  return `user-${Math.random().toString(36).slice(2, 8)}`;
}

export function EmailForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState(createDefaultUsername);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    setPending(true);

    const result =
      mode === "signin"
        ? await signInWithEmail(formData)
        : await signUpWithEmail(formData);

    if (result?.error) setError(result.error);
    else if (result && "success" in result) setSuccess(result.success ?? null);
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {mode === "signup" && (
          <>
            <input
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-label="Username"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              name="confirm_password"
              type="password"
              required
              placeholder="Confirm password"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {pending
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-500">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button
              onClick={() => {
                setError(null);
                setSuccess(null);
                setUsername(createDefaultUsername());
                setMode("signup");
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => {
                setError(null);
                setSuccess(null);
                setMode("signin");
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
