export type FeriadoBase = {
  id: string;
  data: string; // YYYY-MM-DD
  nome: string;
  cor: string;
  origem: "nacional" | "empresa";
};

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Algoritmo de Meeus/Jones/Butcher (Páscoa no calendário gregoriano)
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mar, 4=abr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getFeriadosNacionais(year: number): FeriadoBase[] {
  const fixed = [
    { md: "01-01", nome: "Confraternização Universal" },
    { md: "04-21", nome: "Tiradentes" },
    { md: "05-01", nome: "Dia do Trabalhador" },
    { md: "09-07", nome: "Independência do Brasil" },
    { md: "10-12", nome: "Nossa Senhora Aparecida" },
    { md: "11-02", nome: "Finados" },
    { md: "11-15", nome: "Proclamação da República" },
    { md: "11-20", nome: "Consciência Negra" },
    { md: "12-25", nome: "Natal" },
  ].map((f) => ({
    id: `nacional-${year}-${f.md}`,
    data: `${year}-${f.md}`,
    nome: f.nome,
    cor: "#fef3c7",
    origem: "nacional" as const,
  }));

  const easter = easterSunday(year);
  const sextaSanta = addDays(easter, -2);

  return [
    ...fixed,
    {
      id: `nacional-${year}-sexta-santa`,
      data: formatDateKey(sextaSanta),
      nome: "Paixão de Cristo",
      cor: "#fef3c7",
      origem: "nacional",
    },
  ];
}
