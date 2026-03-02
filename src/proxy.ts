import { NextResponse } from "next/server";

export function proxy() {
  // Proteção de rotas fica no AuthGate (layout client-side)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
