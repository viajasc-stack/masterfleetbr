"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

type Notification = {
  id: string;
  titulo: string;
  mensagem: string | null;
  lido: boolean;
  created_at: string;
  meta: Record<string, unknown> | null;
};

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        // refresh counts and items when notifications change
        fetchUnreadCount();
        if (open) fetchNotifications();
      })
      .subscribe();

    return () => {
      // unsubscribe
      supabase.removeChannel(channel);
    };
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  async function fetchUnreadCount() {
    try {
      const { data, error, count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: false })
        .eq("lido", false);
      if (error) throw error;
      setUnreadCount(count ?? (data ? data.length : 0));
    } catch (err) {
      console.error("fetchUnreadCount", err);
    }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotifications(data as Notification[]);
    } catch (err) {
      console.error("fetchNotifications", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error("failed_mark_read");
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lido: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("markAsRead", err);
    }
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await fetchNotifications();
      await fetchUnreadCount();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative text-white/80 hover:text-white text-lg"
        aria-label="Notificações"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white text-slate-900 shadow-lg rounded-md overflow-hidden z-50">
          <div className="p-3 border-b">
            <div className="font-semibold">Notificações</div>
            <div className="text-xs text-slate-500">Últimas 20</div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-slate-500">Carregando...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="p-4 text-sm text-slate-500">Sem notificações</div>
            )}
            {!loading && notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b flex items-start gap-3 hover:bg-slate-50 ${n.lido ? 'opacity-60' : ''}`}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{n.titulo}</div>
                    <div className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  {n.mensagem && <div className="text-sm text-slate-600 mt-1">{n.mensagem}</div>}
                  {n.meta && <div className="text-xs text-slate-400 mt-2">{JSON.stringify(n.meta)}</div>}
                </div>
                {!n.lido && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-xs text-slate-600 hover:text-slate-800"
                  >
                    Marcar lido
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 border-t text-center text-xs text-slate-500">
            <button
                onClick={async () => {
                const ids = notifications.filter((x) => !x.lido).map((x) => x.id);
                if (ids.length === 0) return;
                try {
                  const session = await supabase.auth.getSession();
                  const token = session?.data?.session?.access_token;
                  const res = await fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ ids }),
                  });
                  if (!res.ok) throw new Error('failed_mark_all');
                  setNotifications((prev) => prev.map((n) => ({ ...n, lido: true })));
                  setUnreadCount(0);
                } catch (err) {
                  console.error('markAllRead', err);
                }
              }}
              className="px-3 py-1 text-sm"
            >
              Marcar todas como lidas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
