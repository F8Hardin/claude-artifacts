"use client";

import { useTransition, useState, useRef } from "react";
import { createToken, revokeToken, revokeAllTokens } from "./actions";

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isExpired(expires_at: string | null) {
  return expires_at ? new Date(expires_at) < new Date() : false;
}

// ─── One-time reveal panel ────────────────────────────────────────────────────

function TokenReveal({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/30">
      <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
        Token generated — copy it now. You won&apos;t see it again.
      </p>
      <div className="flex items-center gap-2 mt-3">
        <code className="flex-1 overflow-x-auto rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-mono text-neutral-800 dark:border-green-900 dark:bg-black dark:text-neutral-200 select-all">
          {token}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 text-xs text-green-700 underline dark:text-green-400"
      >
        I&apos;ve copied it — dismiss
      </button>
    </div>
  );
}

// ─── Generate form ────────────────────────────────────────────────────────────

function GenerateForm({ onCreated }: { onCreated: (token: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLSelectElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = nameRef.current?.value.trim() ?? "";
    if (!name) return;

    const expiryDays = expiryRef.current?.value ?? "never";
    const expiresAt =
      expiryDays === "never"
        ? null
        : new Date(Date.now() + parseInt(expiryDays) * 86400_000).toISOString();

    setError(null);
    startTransition(async () => {
      const result = await createToken(name, expiresAt);
      if (result.error) {
        setError(result.error);
      } else {
        if (nameRef.current) nameRef.current.value = "";
        onCreated(result.rawToken);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-neutral-500 mb-1" htmlFor="token-name">
          Token name
        </label>
        <input
          ref={nameRef}
          id="token-name"
          type="text"
          required
          placeholder="e.g. Desktop agent"
          maxLength={64}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1" htmlFor="token-expiry">
          Expires
        </label>
        <select
          ref={expiryRef}
          id="token-expiry"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <option value="never">Never</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Generating…" : "Generate token"}
      </button>
      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </form>
  );
}

// ─── Token list ───────────────────────────────────────────────────────────────

function TokenList({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);

  function handleRevoke(id: string) {
    setRevoking(id);
    startTransition(async () => {
      await revokeToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setRevoking(null);
    });
  }

  function handleRevokeAll() {
    startTransition(async () => {
      await revokeAllTokens();
      setTokens([]);
    });
  }

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-4">
        No tokens yet. Generate one above.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {tokens.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-neutral-950"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {t.name}
                </span>
                {isExpired(t.expires_at) && (
                  <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-0.5 dark:bg-red-900/30 dark:text-red-400">
                    expired
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                <span className="text-xs font-mono text-neutral-400">{t.token_prefix}…</span>
                <span className="text-xs text-neutral-400">
                  Created {formatDate(t.created_at)}
                </span>
                <span className="text-xs text-neutral-400">
                  Last used {formatDate(t.last_used_at)}
                </span>
                {t.expires_at && (
                  <span className="text-xs text-neutral-400">
                    Expires {formatDate(t.expires_at)}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={revoking === t.id || pending}
              onClick={() => handleRevoke(t.id)}
              className="shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
            >
              {revoking === t.id ? "Revoking…" : "Revoke"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={handleRevokeAll}
        className="mt-3 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
      >
        Revoke all tokens
      </button>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

function mcpConfig(mcpUrl: string, token: string) {
  return `{
  "mcpServers": {
    "claude-artifacts": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": { "X-Artifacts-Token": "${token}" }
    }
  }
}`;
}

function claudeCodeCommand(mcpUrl: string, token: string) {
  return `claude mcp add --transport http claude-artifacts \\\n  ${mcpUrl} \\\n  --header "X-Artifacts-Token: ${token}"`;
}

type TokenManagerProps = {
  initialTokens: TokenRow[];
  mcpUrl: string;
};

export function TokenManager({ initialTokens, mcpUrl }: TokenManagerProps) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState(initialTokens);

  function handleCreated(raw: string) {
    setNewToken(raw);
    // Reload the token list from server state via revalidatePath (triggered by action)
    setTokens((prev) => prev); // list refreshes on next server render; client optimistically shows reveal
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
          Generate a new token
        </h2>
        <GenerateForm onCreated={handleCreated} />
        {newToken && (
          <div className="mt-4 space-y-4">
            <TokenReveal token={newToken} onDismiss={() => setNewToken(null)} />
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Your token is filled in — copy the config below
              </p>
              <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 mb-3">
                <code>{mcpConfig(mcpUrl, newToken)}</code>
              </pre>
              <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
                <code>{claudeCodeCommand(mcpUrl, newToken)}</code>
              </pre>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
          Active tokens
        </h2>
        <TokenList initialTokens={tokens} />
      </section>
    </div>
  );
}
