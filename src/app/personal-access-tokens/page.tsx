import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTokens } from "./actions";
import { TokenManager } from "./token-manager";
import { ConnectorSection } from "./connector-section";

const MCP_URL = "https://ngpsvlvrsqmpbtmdxvfl.supabase.co/functions/v1/mcp";
const OAUTH_CLIENT_ID = "claude_artifacts_connector";
const OAUTH_CLIENT_SECRET = "cs_iNXcgOdVM4BQ-Jz3BVo2RJyO-GOPXFlLerXFk-e_Brw";

const MCP_CONFIG_PLACEHOLDER = `{
  "mcpServers": {
    "claude-artifacts": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": { "X-Artifacts-Token": "cap_your_token_here" }
    }
  }
}`;

const CLI_PLACEHOLDER = `claude mcp add --transport http claude-artifacts \\
  ${MCP_URL} \\
  --header "X-Artifacts-Token: cap_your_token_here"`;

export default async function PersonalAccessTokensPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tokens = await listTokens();

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-12">
      <div>
        <h1 className="font-display text-5xl tracking-wider mb-2">
          My Personal Access Tokens
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Tokens let agents and scripts upload artifacts to your account
          without signing in each time. Each token represents you — name one
          per agent so you can revoke them individually.
        </p>
      </div>

      <TokenManager initialTokens={tokens} mcpUrl={MCP_URL} />

      <ConnectorSection
        mcpUrl={MCP_URL}
        oauthClientId={OAUTH_CLIENT_ID}
        oauthClientSecret={OAUTH_CLIENT_SECRET}
        mcpConfigPlaceholder={MCP_CONFIG_PLACEHOLDER}
        cliPlaceholder={CLI_PLACEHOLDER}
      />
    </main>
  );
}
