import { NextRequest, NextResponse } from "next/server";

type TenantResolve = {
  empresa_id?: string;
  empresa_nome?: string;
  host?: string;
  source?: "custom_domain" | "subdomain";
};

const BASE_DOMAIN = (process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "masterfleetbr.com.br").toLowerCase();

function normalizeHost(rawHost: string | null): string {
  return (rawHost ?? "").trim().toLowerCase().split(":")[0];
}

function getRequestHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  return normalizeHost(forwarded || host);
}

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0"
  );
}

function isVercelHost(host: string): boolean {
  return host.endsWith(".vercel.app") || host.endsWith(".vercel.sh");
}

function getPlatformHosts(): Set<string> {
  const configured = (process.env.NEXT_PUBLIC_APP_HOSTS ?? "")
    .split(",")
    .map((h) => normalizeHost(h))
    .filter(Boolean);

  return new Set([
    BASE_DOMAIN,
    `www.${BASE_DOMAIN}`,
    ...configured,
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ]);
}

async function resolveTenantByHost(host: string): Promise<TenantResolve | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_tenant_by_host`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ p_host: host }),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as TenantResolve | null;
    if (!data?.empresa_id) return null;

    return data;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // Proteção de auth continua no AuthGate (layout client-side)
  // Aqui resolvemos tenant por host customizado para URL personalizada.
  const host = getRequestHost(request);
  if (!host || isLocalHost(host)) return NextResponse.next();

  // Acessos via domínio padrão da Vercel devem sempre ser tratados como host da plataforma.
  // Evita redirecionamento para domínio custom indisponível (ex.: base_domain sem DNS ativo).
  if (isVercelHost(host)) return NextResponse.next();

  const platformHosts = getPlatformHosts();
  const isPlatformHost = platformHosts.has(host);
  if (isPlatformHost) return NextResponse.next();

  const tenant = await resolveTenantByHost(host);
  if (!tenant?.empresa_id) {
    // Fallback seguro: host não reconhecido redireciona para domínio principal.
    const fallbackUrl = new URL(
      process.env.NEXT_PUBLIC_APP_FALLBACK_URL ?? `https://${BASE_DOMAIN}`
    );
    const redirectTo = request.nextUrl.clone();
    redirectTo.protocol = fallbackUrl.protocol;
    redirectTo.host = fallbackUrl.host;
    return NextResponse.redirect(redirectTo, 307);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mf-tenant-host", host);
  requestHeaders.set("x-mf-tenant-empresa-id", tenant.empresa_id);
  requestHeaders.set("x-mf-tenant-source", tenant.source ?? "custom_domain");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set("mf_tenant_host", host, {
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: false,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
