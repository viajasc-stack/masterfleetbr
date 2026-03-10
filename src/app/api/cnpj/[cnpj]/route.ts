import { NextResponse } from "next/server";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

type CnpjPayload = {
  cnpj: string;
  nome_empresa: string;
  razao_social: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
};

async function fetchBrasilApi(cnpjDigits: string): Promise<CnpjPayload | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    razao_social?: string;
    nome_fantasia?: string;
    email?: string;
    ddd_telefone_1?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };

  const endereco = [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ");

  return {
    cnpj: cnpjDigits,
    nome_empresa: data.nome_fantasia || data.razao_social || "",
    razao_social: data.razao_social || "",
    email: data.email || "",
    telefone: data.ddd_telefone_1 || "",
    endereco,
    cidade: data.municipio || "",
    estado: data.uf || "",
    cep: data.cep || "",
  };
}

async function fetchReceitaWs(cnpjDigits: string): Promise<CnpjPayload | null> {
  const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjDigits}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    status?: string;
    nome?: string;
    fantasia?: string;
    email?: string;
    telefone?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };

  if ((data.status ?? "").toUpperCase() !== "OK") return null;

  const endereco = [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ");

  return {
    cnpj: cnpjDigits,
    nome_empresa: data.fantasia || data.nome || "",
    razao_social: data.nome || "",
    email: data.email || "",
    telefone: data.telefone || "",
    endereco,
    cidade: data.municipio || "",
    estado: data.uf || "",
    cep: data.cep || "",
  };
}

export async function GET(_: Request, context: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await context.params;
  const cnpjDigits = onlyDigits(cnpj);

  if (cnpjDigits.length !== 14) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  try {
    const brasilApiData = await fetchBrasilApi(cnpjDigits);
    if (brasilApiData) return NextResponse.json(brasilApiData);

    const receitaWsData = await fetchReceitaWs(cnpjDigits);
    if (receitaWsData) return NextResponse.json(receitaWsData);

    return NextResponse.json(
      { error: "CNPJ não encontrado nas bases disponíveis no momento" },
      { status: 404 }
    );
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CNPJ" }, { status: 500 });
  }
}
