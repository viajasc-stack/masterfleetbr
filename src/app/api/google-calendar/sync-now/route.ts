import { NextRequest, NextResponse } from "next/server";
import { getAuthContextFromBearer } from "../_lib";
import { markGoogleCalendarSyncError, runGoogleCalendarSyncForEmpresa } from "../_sync";

export async function POST(req: NextRequest) {
  let empresaIdForError: string | null = null;
  try {
    const { empresaId } = await getAuthContextFromBearer(req);
    empresaIdForError = empresaId;
    const result = await runGoogleCalendarSyncForEmpresa(empresaId);

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      exported: result.exported,
      duration_ms: result.durationMs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync_error";

    if (empresaIdForError) await markGoogleCalendarSyncError(empresaIdForError, msg);

    if (msg === "unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "forbidden") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
