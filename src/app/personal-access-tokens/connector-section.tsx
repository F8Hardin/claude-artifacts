"use client";

import { useState } from "react";

type Tab = "claudeai" | "cli" | "config";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black px-3 py-2">
        <code className="flex-1 text-xs font-mono text-neutral-800 dark:text-neutral-200 select-all break-all">
          {value}
        </code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

type Props = {
  mcpUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  mcpConfigPlaceholder: string;
  cliPlaceholder: string;
};

export function ConnectorSection({
  mcpUrl,
  oauthClientId,
  oauthClientSecret,
  mcpConfigPlaceholder,
  cliPlaceholder,
}: Props) {
  const [tab, setTab] = useState<Tab>("claudeai");

  const tabs: { id: Tab; label: string }[] = [
    { id: "claudeai", label: "claude.ai" },
    { id: "cli", label: "Claude Code CLI" },
    { id: "config", label: "MCP config" },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
      <h2 className="font-display text-2xl tracking-wide mb-1">
        Add this to your AI agent
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
        Connect any agent to the artifacts MCP server using the method below.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* claude.ai tab */}
      {tab === "claudeai" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Go to{" "}
            <strong>Settings → Connectors → Add custom connector</strong> in
            claude.ai, then fill in the three fields below.
          </p>

          <CredentialRow label="MCP Server URL" value={mcpUrl} />
          <CredentialRow label="OAuth Client ID" value={oauthClientId} />
          <CredentialRow label="OAuth Client Secret" value={oauthClientSecret} />

          <p className="text-xs text-neutral-400">
            Click <strong>Connect</strong> — claude.ai will redirect you here
            to approve access, then return you to claude.ai. The token will
            appear in your list above as{" "}
            <em>claude.ai (connected via OAuth)</em>.
          </p>

          <a
            href="https://claude.ai/settings/connectors"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Open claude.ai Connectors
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* CLI tab */}
      {tab === "cli" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Generate a token above, then run this command. Replace{" "}
            <code className="font-mono text-xs">cap_your_token_here</code> with
            your token.
          </p>
          <CodeBlock code={cliPlaceholder} />
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Add this to your{" "}
            <code className="font-mono text-xs">claude_desktop_config.json</code>{" "}
            or any MCP client config. Replace{" "}
            <code className="font-mono text-xs">cap_your_token_here</code> with
            your token.
          </p>
          <CodeBlock code={mcpConfigPlaceholder} />
        </div>
      )}
    </section>
  );
}
