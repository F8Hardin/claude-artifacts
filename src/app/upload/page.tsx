import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Upload Artifact</h1>
      <UploadForm />
    </main>
  );
}
