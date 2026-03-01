import { NextResponse, type NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // ✅ Não faz redirect nenhum. Quem protege é o AuthGate no layout do painel.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};