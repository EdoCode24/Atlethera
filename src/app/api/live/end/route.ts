import { NextResponse } from "next/server";
import { livekitEnv, roomService } from "@/lib/livekit/server";
import { createSupabaseServer, currentUser } from "@/lib/supabase/server";

/** The coach ends a live meeting for everyone: the session closes and the room is removed. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { liveMeetingId?: string } | null;
  if (!body?.liveMeetingId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("end_live_meeting", { p_id: body.liveMeetingId });
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const env = livekitEnv();
  if (env) {
    try {
      // Removing the room disconnects everyone still in it.
      await roomService(env).deleteRoom((data as { room: string }).room);
    } catch {
      // Already gone.
    }
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
