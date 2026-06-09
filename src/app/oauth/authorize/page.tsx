import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getClient(clientId: string) {
  const supabase = await createClient();
  // oauth_clients has RLS disabled — session client can read non-sensitive columns
  const { data } = await supabase
    .from("oauth_clients")
    .select("id, name, redirect_uri_prefix")
    .eq("id", clientId)
    .maybeSingle();
  return data;
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { client_id, redirect_uri, state, response_type, code_challenge, code_challenge_method } = params;

  // Validate required params
  if (!client_id || !redirect_uri || response_type !== "code") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Invalid request</h1>
          <p className="text-sm text-neutral-500">Missing or invalid OAuth parameters.</p>
        </div>
      </main>
    );
  }

  const client = await getClient(client_id);
  if (!client || !redirect_uri.startsWith(client.redirect_uri_prefix)) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Unknown client</h1>
          <p className="text-sm text-neutral-500">This application is not registered.</p>
        </div>
      </main>
    );
  }

  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const next = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-3">
            <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Connect {client.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Signed in as <strong>{user.email}</strong>
          </p>
        </div>

        <div className="rounded-lg border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 p-4 mb-6 space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            This will allow {client.name} to:
          </p>
          <ul className="space-y-1.5">
            {[
              "Upload artifacts to your account",
              "List your artifacts",
              "Update your artifacts",
              "Delete your artifacts",
            ].map((perm) => (
              <li key={perm} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {perm}
              </li>
            ))}
          </ul>
        </div>

        <form action="/api/oauth/authorize" method="POST" className="space-y-3">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="state" value={state ?? ""} />
          {code_challenge && <input type="hidden" name="code_challenge" value={code_challenge} />}
          {code_challenge_method && <input type="hidden" name="code_challenge_method" value={code_challenge_method} />}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Allow access
          </button>
        </form>

        <form action={`${redirect_uri}?error=access_denied&state=${state ?? ""}`} method="GET" className="mt-2">
          <button
            type="submit"
            className="w-full rounded-lg border border-neutral-200 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
