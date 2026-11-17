import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Opens a document: checks the signed-in user can see it (row-level
// security), then redirects to a storage link that expires in 2 minutes.
// Files are never public and links are never stored in the page.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch {
    return new NextResponse("Not signed in", { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path as string, 120);
  if (error || !data) return new NextResponse("Couldn't open the file", { status: 502 });

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
