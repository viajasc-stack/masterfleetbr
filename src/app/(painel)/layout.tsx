import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex">
        {/* Sidebar (dark) */}
        <Sidebar />

        {/* Conteúdo (claro) */}
        <div className="flex min-h-screen flex-1 flex-col">
          <div className="border-b border-slate-200 bg-white">
            <Topbar />
          </div>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}