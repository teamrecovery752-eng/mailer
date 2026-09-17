"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileText, X, Loader2, ListFilter, Download, ShieldAlert,
  CheckCircle2, Send, Trash2, Plus, ShieldOff, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { SPREADSHEET_ACCEPT, parseRecipientFile } from "@/lib/recipientFile";
import { stashCleanedRecipients } from "@/lib/recipientHandoff";

const card: React.CSSProperties = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 16 };
const labelS: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };
const inputS: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

type BadEntry = { email: string; reasons: string[] };
type CleanResult = { total: number; goodCount: number; badCount: number; good: any[]; bad: BadEntry[] };

type Suppression = { id: string; email: string; reason: string; detail: string; source: string; createdAt: string };

const REASON_META: Record<string, { label: string; color: string }> = {
  INVALID_FORMAT: { label: "Invalid format", color: "#ef4444" },
  INVALID_DOMAIN: { label: "No mail servers", color: "#f59e0b" },
  BOUNCED: { label: "Bounced", color: "#ef4444" },
  MANUAL: { label: "Manual", color: "#8888a0" },
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ListCleaningPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [showBadTable, setShowBadTable] = useState(true);

  function clearFile() {
    setRows([]);
    setColumns([]);
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    parseRecipientFile(file)
      .then(({ data, columns, emailCol }) => {
        if (!emailCol) {
          showToast("error", "Missing required column", 'Add an "email" column (any capitalisation) and re-upload.');
          clearFile();
          return;
        }
        setColumns(columns);
        setRows(data.slice(0, 20000));
      })
      .catch((err: Error) => {
        showToast("error", "Couldn't read file", err.message);
        clearFile();
      });
  }

  async function handleClean() {
    if (!rows.length) return;
    setCleaning(true);
    setResult(null);
    try {
      const res = await fetch("/api/validate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", "Couldn't clean list", data?.error || `Request failed (${res.status})`);
      } else {
        setResult(data);
        showToast(
          data.badCount ? "info" : "success",
          data.badCount ? `Found ${data.badCount.toLocaleString()} bad email${data.badCount === 1 ? "" : "s"}` : "List is clean",
          `${data.goodCount.toLocaleString()} good out of ${data.total.toLocaleString()} total.`
        );
      }
    } catch {
      showToast("error", "Couldn't clean list", "Could not reach the server. Check your connection and try again.");
    }
    setCleaning(false);
  }

  function handleSendToBulk() {
    if (!result?.good.length) return;
    stashCleanedRecipients(result.good, columns);
    router.push("/dashboard/bulk");
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>List Cleaning</h1>
        <p style={{ color: "#8888a0" }}>
          Upload a recipient list and remove bad addresses before you send — invalid formats, domains with no mail servers, duplicates, and anything that's bounced before.
        </p>
      </div>

      {/* Upload */}
      <div style={card}>
        <label style={labelS}>Recipient List</label>
        <input ref={fileRef} type="file" accept={SPREADSHEET_ACCEPT} onChange={handleFile} style={{ display: "none" }} />

        {!rows.length ? (
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 24px", borderRadius: 12, border: "2px dashed rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
            <Upload size={28} color="#8888a0" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#f0f0f5", marginBottom: 4 }}>Click to upload CSV or Excel</div>
              <div style={{ fontSize: 12, color: "#8888a0" }}>.csv, .xlsx, .xls, .ods — must have an "email" column, any capitalisation or position.</div>
            </div>
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "#18181f", marginBottom: 16 }}>
              <FileText size={18} color="#6366f1" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fileName}</div>
                <div style={{ fontSize: 12, color: "#8888a0" }}>{rows.length.toLocaleString()} rows · {columns.join(", ")}</div>
              </div>
              <button type="button" onClick={clearFile} style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <button type="button" onClick={handleClean} disabled={cleaning}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 20px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: cleaning ? "not-allowed" : "pointer", opacity: cleaning ? 0.6 : 1, fontFamily: "inherit" }}>
              {cleaning ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <ListFilter size={15} />}
              {cleaning ? "Checking formats, domains, and bounce history…" : "Clean List"}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 18 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{result.total.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</div>
            </div>
            <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 18, border: "1px solid rgba(34,197,94,0.2)" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>{result.goodCount.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Good</div>
            </div>
            <div style={{ ...card, marginBottom: 0, textAlign: "center", padding: 18, border: result.badCount ? "1px solid rgba(239,68,68,0.2)" : undefined }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: result.badCount ? "#ef4444" : "#f0f0f5" }}>{result.badCount.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bad</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={handleSendToBulk} disabled={!result.goodCount}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: result.goodCount ? "#22c55e" : "#18181f", color: result.goodCount ? "#000" : "#8888a0", fontSize: 13, fontWeight: 600, border: "none", cursor: result.goodCount ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <Send size={14} /> Send Good List to Bulk Email
              </button>
              <button type="button" onClick={() => downloadCsv("good-emails.csv", [["email"], ...result.good.map((r) => [r.email])])} disabled={!result.goodCount}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#18181f", color: "#f0f0f5", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: result.goodCount ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <Download size={14} /> Download Good ({result.goodCount})
              </button>
              <button type="button" onClick={() => downloadCsv("bad-emails.csv", [["email", "reason"], ...result.bad.map((b) => [b.email, b.reasons.join("; ")])])} disabled={!result.badCount}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#18181f", color: "#f0f0f5", fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: result.badCount ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <Download size={14} /> Download Bad ({result.badCount})
              </button>
            </div>
          </div>

          {result.badCount > 0 && (
            <div style={card}>
              <button type="button" onClick={() => setShowBadTable((v) => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#f0f0f5", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
                  <ShieldAlert size={15} color="#ef4444" /> Bad Emails ({result.badCount.toLocaleString()})
                </div>
                {showBadTable ? <ChevronUp size={16} color="#8888a0" /> : <ChevronDown size={16} color="#8888a0" />}
              </button>

              {showBadTable && (
                <div style={{ marginTop: 16, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", maxHeight: 360, overflowY: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 14px", background: "#18181f", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Email</th>
                        <th style={{ textAlign: "left", padding: "8px 14px", background: "#18181f", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bad.slice(0, 500).map((b, i) => (
                        <tr key={i}>
                          <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#f0f0f5", whiteSpace: "nowrap" }}>{b.email}</td>
                          <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#8888a0" }}>{b.reasons.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.bad.length > 500 && (
                    <div style={{ padding: "10px 14px", fontSize: 11, color: "#8888a0", textAlign: "center" }}>
                      Showing first 500 of {result.bad.length.toLocaleString()} — download the full list above.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <SuppressionManager />
    </div>
  );
}

// Manage the persistent list of known-bad addresses — the ones every
// future "Clean List" run checks against. Grows automatically whenever a
// real send bounces, and can be topped up manually (e.g. paste addresses
// straight from a provider's own suppression dashboard).
function SuppressionManager() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Suppression[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pasteValue, setPasteValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/suppressions")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!pasteValue.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: pasteValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", "Couldn't add addresses", data?.error || `Request failed (${res.status})`);
      } else {
        showToast("success", `Added ${data.added} address${data.added === 1 ? "" : "es"}`, data.skipped?.length ? `Skipped ${data.skipped.length} invalid: ${data.skipped.slice(0, 5).join(", ")}${data.skipped.length > 5 ? "…" : ""}` : undefined);
        setPasteValue("");
        load();
      }
    } catch {
      showToast("error", "Couldn't add addresses", "Could not reach the server. Check your connection and try again.");
    }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/suppressions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev?.filter((i) => i.id !== id) || null);
      } else {
        const data = await res.json().catch(() => null);
        showToast("error", "Couldn't remove address", data?.error || "Try again.");
      }
    } catch {
      showToast("error", "Couldn't remove address", "Could not reach the server. Check your connection and try again.");
    }
    setRemovingId(null);
  }

  return (
    <div style={card}>
      <button type="button" onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#f0f0f5", fontFamily: "inherit" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
          <ShieldOff size={15} color="#8888a0" /> Suppression List{items ? ` (${items.length.toLocaleString()})` : ""}
        </div>
        {expanded ? <ChevronUp size={16} color="#8888a0" /> : <ChevronDown size={16} color="#8888a0" />}
      </button>
      <p style={{ fontSize: 12, color: "#8888a0", marginTop: 6 }}>
        Addresses that get automatically skipped by "Clean List" — filed here whenever a real send bounces, or added by hand below.
      </p>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="Paste addresses — one per line, or comma-separated"
              rows={2}
              style={{ ...inputS, flex: 1, resize: "vertical", fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <button type="button" onClick={handleAdd} disabled={adding || !pasteValue.trim()}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: adding || !pasteValue.trim() ? "not-allowed" : "pointer", opacity: adding || !pasteValue.trim() ? 0.6 : 1, fontFamily: "inherit", flexShrink: 0, height: 44 }}>
              {adding ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
              Add
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "#8888a0" }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : !items?.length ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 12, color: "#8888a0" }}>
              <CheckCircle2 size={20} style={{ display: "block", margin: "0 auto 8px", opacity: 0.5 }} />
              Nothing suppressed yet.
            </div>
          ) : (
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 14px", background: "#18181f", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Email</th>
                    <th style={{ textAlign: "left", padding: "8px 14px", background: "#18181f", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Reason</th>
                    <th style={{ textAlign: "left", padding: "8px 14px", background: "#18181f", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Source</th>
                    <th style={{ width: 40, background: "#18181f", borderBottom: "1px solid rgba(255,255,255,0.06)" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = REASON_META[item.reason] || { label: item.reason, color: "#8888a0" };
                    return (
                      <tr key={item.id}>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#f0f0f5", whiteSpace: "nowrap" }}>{item.email}</td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: `${meta.color}1a`, padding: "2px 6px", borderRadius: 5 }}>{meta.label}</span>
                          {item.detail && <span style={{ marginLeft: 8, color: "#8888a0" }}>{item.detail}</span>}
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#8888a0" }}>{item.source || "—"}</td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <button type="button" onClick={() => handleRemove(item.id)} disabled={removingId === item.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 4 }}>
                            {removingId === item.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={13} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
