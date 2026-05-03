import Link from "next/link";

export default function AuthCodeError() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">Authentication Failed</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Something went wrong during sign in. Please try again.
        </p>
        <Link
          href="/login"
          className="inline-block text-blue-600 dark:text-blue-400 hover:underline"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
