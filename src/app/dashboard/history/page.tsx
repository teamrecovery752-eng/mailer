"use client";
import { useState, useEffect, useCallback } from "react";
import { Send, Users, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

type Log = { id: string; type: "SINGLE"|"BULK"; status: "SUCCESS"|"PARTIAL"|"FAILED"; subject: string; recipients: string[]; totalSent: number; totalFailed: number; errors: string[]; messageId?: string; sentAt: string; user: { name: string; email: string }; };

const statusColor = { SUCCESS: "#22c55e", PARTIAL: "#f59e0b", FAILED: "#ef4444" };
const statusBg = { SUCCESS: "rgba(34,197,94,0.08)", PARTIAL: "rgba(245,158,11,0.08)", FAILED: "rgba(239,68,68,0.08)" };
const StatusIcon = { SUCCESS: CheckCircle2, PARTIAL: AlertTriangle, FAILED: XCircle };

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<""|"SINGLE"|"BULK">("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "15" });
    if (typeFilter) p.set("type", typeFilter);
    const res = await fetch(`/api/logs?${p}`);
    const data = await res.json();
    setLogs(data.logs || []); setTotal(data.total || 0); setPages(data.pages || 1);
    setLoading(false);
  }, [page, typeFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const thS: React.CSSProperties = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8888a0", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#18181f" };
  const tdS: React.CSSProperties = { padding: "12px 16px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.04)" };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Send History</h1>
          <p style={{ color: "#8888a0" }}>{total} total sends logged</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 2, padding: 4, borderRadius: 10, background: "#111116", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["", "SINGLE", "BULK"] as const).map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                style={{ padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: typeFilter === t ? "#6366f1" : "transparent", color: typeFilter === t ? "#fff" : "#8888a0", fontFamily: "inherit" }}>
                {t === "" ? "All" : t === "SINGLE" ? "Single" : "Bulk"}
              </button>
            ))}
          </div>
          <button onClick={fetchLogs} style={{ padding: 8, borderRadius: 10, background: "#111116", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#8888a0", display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      <div style={{ background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thS}>Subject</th>
              <th style={{ ...thS, width: 70 }}>Type</th>
              <th style={{ ...thS, width: 80, textAlign: "center" }}>Sent</th>
              <th style={{ ...thS, width: 100 }}>Status</th>
              <th style={{ ...thS, width: 120 }}>Sent By</th>
              <th style={{ ...thS, width: 110 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "60px 16px", textAlign: "center", color: "#8888a0" }}>
                <RefreshCw size={18} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 12px" }} />
                Loading logs…
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "60px 16px", textAlign: "center", color: "#8888a0" }}>
                <Send size={28} style={{ display: "block", margin: "0 auto 12px", opacity: 0.3 }} />
                No sends yet.
              </td></tr>
            ) : logs.map(log => {
              const Icon = StatusIcon[log.status];
              const isOpen = expanded === log.id;
              return [
                <tr key={log.id} onClick={() => setExpanded(isOpen ? null : log.id)} style={{ cursor: "pointer", background: isOpen ? "#18181f" : "transparent" }}>
                  <td style={{ ...tdS, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.subject}</td>
                  <td style={tdS}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: log.type === "BULK" ? "#6366f1" : "#8888a0" }}>
                      {log.type === "BULK" ? <Users size={12} /> : <Send size={12} />} {log.type}
                    </span>
                  </td>
                  <td style={{ ...tdS, textAlign: "center" }}>
                    <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: log.totalSent > 0 ? "#22c55e" : "#ef4444" }}>{log.totalSent}</span>
                    {log.totalFailed > 0 && <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}> -{log.totalFailed}</span>}
                  </td>
                  <td style={tdS}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: statusBg[log.status], color: statusColor[log.status] }}>
                      <Icon size={11} /> {log.status}
                    </span>
                  </td>
                  <td style={{ ...tdS, color: "#8888a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{log.user.name}</td>
                  <td style={{ ...tdS, color: "#8888a0", fontSize: 12 }}>{new Date(log.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>,
                isOpen && (
                  <tr key={`${log.id}-exp`}>
                    <td colSpan={6} style={{ padding: "12px 16px 16px", background: "#18181f", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 12 }}>
                        <div>
                          <div style={{ color: "#8888a0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Recipients</div>
                          <div style={{ color: "#f0f0f5" }}>{log.recipients.slice(0, 8).join(", ")}{log.recipients.length > 8 ? ` +${log.recipients.length - 8} more` : ""}</div>
                        </div>
                        {log.messageId && (
                          <div>
                            <div style={{ color: "#8888a0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>SES Message ID</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#6366f1" }}>{log.messageId}</div>
                          </div>
                        )}
                        {log.errors.length > 0 && (
                          <div>
                            <div style={{ color: "#ef4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Errors</div>
                            {log.errors.slice(0, 3).map((e, i) => <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", color: "#8888a0" }}>{e}</div>)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ];
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span style={{ fontSize: 12, color: "#8888a0" }}>Page {page} of {pages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ icon: ChevronLeft, onClick: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 }, { icon: ChevronRight, onClick: () => setPage(p => Math.min(pages, p + 1)), disabled: page === pages }].map(({ icon: Icon, onClick, disabled }, i) => (
              <button key={i} onClick={onClick} disabled={disabled} style={{ padding: 8, borderRadius: 8, background: "#111116", border: "1px solid rgba(255,255,255,0.06)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, color: "#f0f0f5", display: "flex", alignItems: "center" }}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
