import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    </main>
  );
}
