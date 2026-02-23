import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Sempre comece com um response "next" para permitir setar cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // atualiza request cookies (pra leitura no mesmo ciclo)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // seta no response (pra persistir no navegador)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  // Rotas públicas (não bloqueia)
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname.startsWith("/portal");

  // Pega usuário (se não tiver sessão, user = null)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1) Se NÃO está logado e tenta rota privada -> /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2) Se está logado e tenta acessar /login ou /cadastro -> manda pro /dashboard
  if (user && (pathname === "/login" || pathname === "/cadastro" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3) Se está logado e está no painel, precisa ter empresa vinculada
  // (exceto quando está em /configuracoes)
  if (user && !isPublic) {
    if (!pathname.startsWith("/configuracoes")) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Se der erro ou não tiver empresa, manda para /configuracoes
      if (error || !profile?.empresa_id) {
        const url = request.nextUrl.clone();
        url.pathname = "/configuracoes";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};