"use client";
import { useState, useRef } from "react";
import { Upload, Send, Loader2, FileText, X, AlertTriangle, Code2, AlignLeft, LayoutTemplate, Check } from "lucide-react";
import Papa from "papaparse";
import { marketingTemplates } from "@/lib/marketingTemplates";
import { useToast } from "@/components/Toast";

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

const defaultText = `Hi {{name}},

We help victims of stolen crypto, lost wallet passwords, and investment scams recover their digital assets.

Submit a free case assessment:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133`;

type Mode = "html" | "text";

export default function BulkEmailPage() {
  const { showToast } = useToast();
  const [recipients, setRecipients] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [body, setBody] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failedErrors, setFailedErrors] = useState<string[]>([]);
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
        if (!cols.includes("email")) { showToast("error", "CSV missing a required column", 'Add an "email" column and re-upload.'); return; }
        setCsvColumns(cols);
        setRecipients(data.slice(0, 10000));
      },
    });
  }

  function clearCSV() { setRecipients([]); setCsvColumns([]); setCsvFile(""); setFailedErrors([]); if (fileRef.current) fileRef.current.value = ""; }

  function switchMode(next: Mode) {
    setMode(next);
    setBody(""); // clear body when switching so stale content doesn't bleed over
    setActiveTemplateId(null);
  }

  function applyMarketingTemplate(id: string) {
    const tpl = marketingTemplates.find(t => t.id === id);
    if (!tpl) return;
    setBody(mode === "html" ? tpl.html : tpl.text);
    setActiveTemplateId(id);
    if (!subject) setSubject(tpl.subject);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipients.length) return;
    setSending(true);
    setFailedErrors([]);

    const payload = {
      recipients,
      subject,
      // send as htmlBody or textBody depending on mode — mirrors Single Email behaviour
      ...(mode === "html" ? { htmlBody: body } : { textBody: body, htmlBody: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>` }),
    };

    try {
      const res = await fetch("/api/send/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);

      if (res.ok && data) {
        const { sent = 0, failed = 0, errors = [] } = data;
        if (failed === 0) {
          showToast("success", "Campaign sent", `${sent.toLocaleString()} recipient${sent === 1 ? "" : "s"} delivered.`);
        } else if (sent === 0) {
          showToast("error", "Campaign failed to send", `All ${failed.toLocaleString()} recipients failed. See details below.`);
          setFailedErrors(errors);
        } else {
          showToast("error", "Campaign sent with some failures", `${sent.toLocaleString()} delivered, ${failed.toLocaleString()} failed. See details below.`);
          setFailedErrors(errors);
        }
      } else {
        showToast("error", "Couldn't send campaign", data?.error || `Request failed (${res.status}). Please try again.`);
      }
    } catch {
      showToast("error", "Couldn't send campaign", "Network error — check your connection and try again.");
    }
    setSending(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Bulk Email</h1>
        <p style={{ color: "#8888a0" }}>Upload a CSV and send personalised campaigns to thousands of recipients.</p>
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

        {/* Marketing template gallery */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <LayoutTemplate size={14} color="#8888a0" />
            <label style={{ ...labelS, marginBottom: 0 }}>Marketing Templates</label>
          </div>
          <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 14 }}>
            Pick a starting point, then edit freely below. Each loads in the format you've selected ({mode === "html" ? "HTML" : "plain text"}).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {marketingTemplates.map(tpl => {
              const active = activeTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyMarketingTemplate(tpl.id)}
                  style={{
                    textAlign: "left", padding: 14, borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                    background: active ? "rgba(99,102,241,0.08)" : "#18181f",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#f0f0f5" }}>{tpl.name}</div>
                    {active && <Check size={13} color="#6366f1" style={{ marginLeft: "auto", flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8888a0", lineHeight: 1.5 }}>{tpl.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body — HTML or Text toggle */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <label style={{ ...labelS, marginBottom: 0 }}>Message Body</label>

            {/* Toggle pill */}
            <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "#0c0c0f", border: "1px solid rgba(255,255,255,0.06)" }}>
              {([
                { key: "html", icon: Code2, label: "HTML" },
                { key: "text", icon: AlignLeft, label: "Plain Text" },
              ] as { key: Mode; icon: any; label: string }[]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    fontFamily: "inherit", transition: "all 0.15s",
                    background: mode === key ? "#6366f1" : "transparent",
                    color: mode === key ? "#fff" : "#8888a0",
                  }}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode description */}
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "#0c0c0f", fontSize: 12, color: "#8888a0", display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "html" ? (
              <>
                <Code2 size={13} color="#6366f1" />
                Full HTML — supports styles, images, buttons, and merge tags like {"{{name}}"}.
              </>
            ) : (
              <>
                <AlignLeft size={13} color="#8888a0" />
                Plain text campaign — no formatting, reads like a personal message. Merge tags like {"{{name}}"} still work.
              </>
            )}
          </div>

          <textarea value={body} onChange={e => { setBody(e.target.value); setActiveTemplateId(null); }} required rows={16}
            placeholder={mode === "html"
              ? "Paste your HTML template, or pick one from Marketing Templates above..."
              : "Hi {{name}},\n\nYour message here...\n\n—\nRecoverlance"}
            style={{ ...inputS, resize: "vertical", minHeight: 300, fontFamily: mode === "html" ? "'JetBrains Mono', monospace" : "inherit", fontSize: mode === "html" ? 12 : 14, lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button"
              onClick={() => { setBody(mode === "html" ? defaultTemplate : defaultText); setActiveTemplateId(null); }}
              style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              Load default {mode === "html" ? "HTML" : "plain text"} template →
            </button>
            {body.length > 0 && (
              <span style={{ fontSize: 11, color: "#555566" }}>{body.length} chars</span>
            )}
          </div>
        </div>

        {/* Warning */}
        {recipients.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 12, marginBottom: 16, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#8888a0", margin: 0 }}>
              Sending to <strong style={{ color: "#f0f0f5" }}>{recipients.length.toLocaleString()} recipients</strong>. Make sure your active provider (SES or cPanel) is verified and out of any sandbox/sending limits before a large send.
            </p>
          </div>
        )}

        {/* Failed recipients (only shown when a send had failures — plain, human-readable, no raw JSON) */}
        {failedErrors.length > 0 && (
          <div style={{ padding: 16, borderRadius: 12, marginBottom: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#f0f0f5" }}>
              {failedErrors.length} recipient{failedErrors.length === 1 ? "" : "s"} couldn't be reached
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {failedErrors.slice(0, 5).map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: "#8888a0" }}>{e}</div>
              ))}
              {failedErrors.length > 5 && (
                <div style={{ fontSize: 12, color: "#555566", marginTop: 2 }}>+{failedErrors.length - 5} more — check Send History for the full list.</div>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={sending || !recipients.length}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, background: recipients.length ? "#22c55e" : "#18181f", color: recipients.length ? "#000" : "#8888a0", fontSize: 14, fontWeight: 600, border: "none", cursor: !recipients.length || sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "inherit" }}>
          {sending ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Sending…</> : <><Send size={16} /> Send to {recipients.length ? recipients.length.toLocaleString() : "—"} Recipients</>}
        </button>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
