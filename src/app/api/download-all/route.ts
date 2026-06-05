import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { fetchArtifactsByOwner, getStorageUrl } from "@/lib/supabase/artifacts";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const artifacts = await fetchArtifactsByOwner(user.id);

  if (artifacts.length === 0) {
    return new NextResponse("No artifacts to download", { status: 404 });
  }

  if (artifacts.length > 200) {
    return new NextResponse("Too many artifacts to download at once", { status: 413 });
  }

  const fileEntries = await Promise.all(
    artifacts.map(async (artifact) => {
      const url = getStorageUrl(artifact.storage_path);
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const ext = artifact.storage_path.slice(artifact.storage_path.lastIndexOf("."));
      const filename = `${artifact.slug}${ext}`;
      return [filename, new Uint8Array(buf)] as [string, Uint8Array];
    })
  );

  const files: Record<string, Uint8Array> = {};
  for (const entry of fileEntries) {
    if (entry) files[entry[0]] = entry[1];
  }

  const zipped = zipSync(files);

  return new NextResponse(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="my-artifacts.zip"',
    },
  });
}
