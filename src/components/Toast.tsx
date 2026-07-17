"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, detail?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { bg: string; border: string; color: string; icon: any }> = {
  success: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "#22c55e", icon: CheckCircle2 },
  error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "#ef4444", icon: XCircle },
  info: { bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.3)", color: "#6366f1", icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, detail?: string, duration = 5000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, title, detail }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: "fixed", top: 20, right: 20, zIndex: 200,
        display: "flex", flexDirection: "column", gap: 10,
        width: "min(380px, calc(100vw - 40px))",
      }}>
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div key={t.id} role="status" style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", borderRadius: 12,
              background: "#111116", border: `1px solid ${s.border}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              animation: "toast-in 0.2s ease-out",
            }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.bg }}>
                <Icon size={13} color={s.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f0f5" }}>{t.title}</div>
                {t.detail && <div style={{ fontSize: 12, color: "#8888a0", marginTop: 3, lineHeight: 1.4 }}>{t.detail}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 2, flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
