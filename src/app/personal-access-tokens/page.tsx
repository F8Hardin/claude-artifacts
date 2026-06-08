import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// MCP server endpoint agents connect to. The PAT is passed as a header so
// uploads are attributed to the token's owner without an interactive login.
const MCP_URL = "https://ngpsvlvrsqmpbtmdxvfl.supabase.co/functions/v1/mcp";

const mcpConfig = `{
  "mcpServers": {
    "claude-artifacts": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": { "X-Artifacts-Token": "cap_your_token_here" }
    }
  }
}`;

const claudeCodeCommand = `claude mcp add --transport http claude-artifacts \\
  ${MCP_URL} \\
  --header "X-Artifacts-Token: cap_your_token_here"`;

export default async function PersonalAccessTokensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-5xl tracking-wider mb-2">
          My Personal Access Tokens
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Tokens let agents and scripts upload artifacts to your account
          without signing in each time.
        </p>
      </div>

      <p className="text-center text-neutral-400 py-12">
        Token management is coming soon.
      </p>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        <h2 className="font-display text-2xl tracking-wide mb-1">
          Add this to your AI agent
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Generate a token above, then connect an agent to the artifacts MCP
          server. Replace <code className="font-mono">cap_your_token_here</code>{" "}
          with your token.
        </p>

        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
          MCP config
        </h3>
        <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
          <code>{mcpConfig}</code>
        </pre>

        <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
          Claude Code (CLI)
        </h3>
        <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
          <code>{claudeCodeCommand}</code>
        </pre>

        <p className="mt-4 text-xs text-neutral-400">
          In Claude Desktop or claude.ai, go to Settings → Connectors → Add
          custom connector, paste the URL above, and add the{" "}
          <code className="font-mono">X-Artifacts-Token</code> header.
        </p>
      </section>
    </main>
  );
}
