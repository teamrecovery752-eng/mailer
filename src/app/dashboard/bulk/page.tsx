"use client";
import { useState, useRef } from "react";
import { Upload, Send, Loader2, CheckCircle2, XCircle, FileText, X, AlertTriangle, Code2 } from "lucide-react";
import Papa from "papaparse";

const card = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputS: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };

const defaultTemplate = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px}
.card{background:#fff;border-radius:12px;padding:40px;max-width:560px;margin:0 auto}
h1{color:#111;font-size:22px;margin-bottom:16px}
p{color:#555;line-height:1.7;margin-bottom:16px}
.btn{display:inline-block;background:#00d4ff;color:#0a0f1e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700}
.footer{text-align:center;margin-top:32px;font-size:12px;color:#999}
</style></head>
<body><div class="card">
<h1>Hi {{name}},</h1>
<p>We help victims of stolen crypto, lost wallet passwords, and investment scams recover their digital assets.</p>
<a href="https://recoverlance.com/contact" class="btn">Submit a Free Case Assessment</a>
<div class="footer">Recoverlance · 2300 Stockton St, San Francisco, CA 94133<br><a href="#">Unsubscribe</a></div>
</div></body></html>`;

export default function BulkEmailPage() {
  const [recipients, setRecipients] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as any[];
        if (!data.length) return;
        const cols = Object.keys(data[0]);
        if (!cols.includes("email")) { alert('CSV must have an "email" column.'); return; }
        setCsvColumns(cols);
        setRecipients(data.slice(0, 10000));
      },
    });
  }

  function clearCSV() { setRecipients([]); setCsvColumns([]); setCsvFile(""); if (fileRef.current) fileRef.current.value = ""; }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipients.length) return;
    setStatus("loading"); setResult(null);
    try {
      const res = await fetch("/api/send/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipients, subject, htmlBody }) });
      const data = await res.json();
      res.ok ? (setStatus("success"), setResult(data)) : (setStatus("error"), setResult(data));
    } catch { setStatus("error"); setResult({ error: "Network error" }); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Bulk Email</h1>
        <p style={{ color: "#8888a0" }}>Upload a CSV and send personalised emails to thousands of recipients.</p>
      </div>

      <form onSubmit={handleSend}>
        {/* CSV Upload */}
        <div style={card}>
          <label style={labelS}>Recipients CSV</label>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />

          {!recipients.length ? (
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 24px", borderRadius: 12, border: "2px dashed rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}>
              <Upload size={28} color="#8888a0" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#f0f0f5", marginBottom: 4 }}>Click to upload CSV</div>
                <div style={{ fontSize: 12, color: "#8888a0" }}>Must have an "email" column. Use column names as merge tags e.g. name, email.</div>
              </div>
            </button>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "#18181f", marginBottom: 16 }}>
                <FileText size={18} color="#6366f1" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{csvFile}</div>
                  <div style={{ fontSize: 12, color: "#8888a0" }}>{recipients.length.toLocaleString()} recipients · {csvColumns.join(", ")}</div>
                </div>
                <button type="button" onClick={clearCSV} style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              {/* Preview */}
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 16px", background: "#18181f", color: "#8888a0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Preview — first 5 rows</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>{csvColumns.map(col => <th key={col} style={{ textAlign: "left", padding: "8px 16px", color: "#8888a0", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{col}</th>)}</tr>
                    </thead>
                    <tbody>
                      {recipients.slice(0, 5).map((row, i) => (
                        <tr key={i}>{csvColumns.map(col => <td key={col} style={{ padding: "8px 16px", color: "#8888a0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row[col]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subject */}
        <div style={card}>
          <label style={labelS}>Subject Line</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} required type="text" placeholder="e.g. Your crypto recovery update" style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
          <p style={{ fontSize: 12, color: "#8888a0", marginTop: 8 }}>Use column names in double curly braces to personalise e.g. {"{{name}}"}</p>
        </div>

        {/* HTML Template */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ ...labelS, marginBottom: 0 }}>HTML Template</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8888a0" }}>
              <Code2 size={13} /> Use {"{{column_name}}"} as merge tags
            </div>
          </div>
          <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} required rows={16}
            placeholder="Paste your HTML template. Use column names in double curly braces as placeholders..."
            style={{ ...inputS, resize: "vertical", minHeight: 300, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
          <button type="button" onClick={() => setHtmlBody(defaultTemplate)} style={{ marginTop: 8, fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Load Recoverlance template →
          </button>
        </div>

        {/* Warning */}
        {recipients.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, marginBottom: 16, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#8888a0", margin: 0 }}>
              Sending to <strong style={{ color: "#f0f0f5" }}>{recipients.length.toLocaleString()} recipients</strong>. Ensure your SES account is out of sandbox and your domain is verified.
            </p>
          </div>
        )}

        {/* Result */}
        {status !== "idle" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, marginBottom: 16, background: status === "success" ? "rgba(34,197,94,0.08)" : status === "error" ? "rgba(239,68,68,0.08)" : "#18181f", border: `1px solid ${status === "success" ? "rgba(34,197,94,0.3)" : status === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}` }}>
            {status === "success" && <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0 }} />}
            {status === "error" && <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />}
            {status === "loading" && <Loader2 size={18} color="#6366f1" style={{ flexShrink: 0, animation: "spin 1s linear infinite" }} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {status === "success" ? `Done — ${result?.sent} sent, ${result?.failed} failed` : status === "error" ? result?.error : "Sending…"}
              </div>
              {result?.errors?.slice(0, 3).map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: "#8888a0", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{e}</div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={status === "loading" || !recipients.length}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, background: recipients.length ? "#22c55e" : "#18181f", color: recipients.length ? "#000" : "#8888a0", fontSize: 14, fontWeight: 600, border: "none", cursor: !recipients.length || status === "loading" ? "not-allowed" : "pointer", opacity: status === "loading" ? 0.6 : 1, fontFamily: "inherit" }}>
          {status === "loading" ? <><Loader2 size={16} /> Sending…</> : <><Send size={16} /> Send to {recipients.length ? recipients.length.toLocaleString() : "—"} Recipients</>}
        </button>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
