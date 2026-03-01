import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  throw new Error("Supabase ENV not configured for server route");
}

const supabase = createClient(supabaseUrl, serviceRole);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const accessToken = req.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  let userId: string | null = null;

  if (accessToken) {
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!error && data?.user) userId = data.user.id;
    } catch (err) {
      // ignore
    }
  }

  try {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ lido: true })
      .in("id", body.ids);

    if (updateError) throw updateError;

    // insert audit rows
    const auditRows = body.ids.map((id: string) => ({ notification_id: id, user_id: userId, action: 'mark_read' }));
    const { error: auditError } = await supabase.from('notifications_audit').insert(auditRows);
    if (auditError) throw auditError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('mark-read error', err);
    return NextResponse.json({ error: err.message || 'server_error' }, { status: 500 });
  }
}
