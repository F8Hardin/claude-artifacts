import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { github_username: string | null; avatar_url: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("github_username, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center gap-2 text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
            <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a.75.75 0 0 1 .091-.086L12 5.432Z" />
          </svg>
        </Link>

        <span className="text-lg font-semibold tracking-tight flex-1">
          Claude Artifacts
        </span>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/upload"
                className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Upload
              </Link>
              <div className="flex items-center gap-2">
                {profile?.avatar_url && (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.github_username ?? "User"}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                )}
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  {profile?.github_username ?? user.email}
                </span>
              </div>
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
