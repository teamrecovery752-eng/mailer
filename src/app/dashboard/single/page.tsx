"use client";
import { useState } from "react";
import { Send, Loader2, CheckCircle2, XCircle, Plus, X } from "lucide-react";

const card = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputS: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };

export default function SingleEmailPage() {
  const [to, setTo] = useState("");
  const [toList, setToList] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);

  function addRecipient() {
    const t = to.trim();
    if (t && !toList.includes(t)) { setToList(p => [...p, t]); setTo(""); }
  }

  const defaultTemplate = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px}
.card{background:#fff;border-radius:12px;padding:40px;max-width:560px;margin:0 auto}
h1{color:#111;font-size:24px;margin-bottom:16px}
p{color:#555;line-height:1.7;margin-bottom:16px}
.btn{display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600}
.footer{text-align:center;margin-top:32px;font-size:12px;color:#999}
</style></head>
<body><div class="card">
<h1>Hello {{name}},</h1>
<p>Your message goes here.</p>
<a href="https://recoverlance.com/contact" class="btn">Submit a Case</a>
<div class="footer">Recoverlance · 2300 Stockton St, San Francisco, CA 94133</div>
</div></body></html>`;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const recipients = toList.length > 0 ? toList : [to.trim()];
    if (!recipients[0]) return;
    setStatus("loading"); setResult(null);
    try {
      const res = await fetch("/api/send/single", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: recipients, subject, htmlBody, replyTo: replyTo || undefined }) });
      const data = await res.json();
      res.ok ? (setStatus("success"), setResult(data)) : (setStatus("error"), setResult(data));
    } catch { setStatus("error"); setResult({ error: "Network error" }); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Single Email</h1>
        <p style={{ color: "#8888a0" }}>Send an email to one or multiple recipients via Amazon SES.</p>
      </div>

      <form onSubmit={handleSend}>
        {/* Recipients */}
        <div style={card}>
          <label style={labelS}>Recipients</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={to} onChange={e => setTo(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())}
              type="email" placeholder="recipient@example.com" style={{ ...inputS, flex: 1 }}
              onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
            <button type="button" onClick={addRecipient} style={{ padding: "12px 18px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
              + Add
            </button>
          </div>
          {toList.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toList.map(email => (
                <span key={email} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#18181f", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                  {email}
                  <button type="button" onClick={() => setToList(p => p.filter(e => e !== email))} style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 0, lineHeight: 1 }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, color: "#8888a0", marginTop: 8 }}>Press Enter or click Add for multiple recipients.</p>
        </div>

        {/* Subject */}
        <div style={card}>
          <label style={labelS}>Subject Line</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} required type="text" placeholder="Your subject here..." style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
        </div>

        {/* Body */}
        <div style={card}>
          <label style={labelS}>Email Body (HTML)</label>
          <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} required rows={14}
            placeholder="Paste your HTML email here..."
            style={{ ...inputS, resize: "vertical", minHeight: 280, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
          <button type="button" onClick={() => setHtmlBody(defaultTemplate)} style={{ marginTop: 8, fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Load starter template →
          </button>
        </div>

        {/* Reply-To */}
        <div style={card}>
          <label style={labelS}>Reply-To (optional)</label>
          <input value={replyTo} onChange={e => setReplyTo(e.target.value)} type="email" placeholder="replies@recoverlance.com" style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
        </div>

        {/* Result */}
        {status !== "idle" && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, marginBottom: 16, background: status === "success" ? "rgba(34,197,94,0.08)" : status === "error" ? "rgba(239,68,68,0.08)" : "#18181f", border: `1px solid ${status === "success" ? "rgba(34,197,94,0.3)" : status === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}` }}>
            {status === "success" && <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />}
            {status === "error" && <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />}
            {status === "loading" && <Loader2 size={18} color="#6366f1" style={{ flexShrink: 0, marginTop: 1, animation: "spin 1s linear infinite" }} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{status === "success" ? "Email sent!" : status === "error" ? "Failed to send" : "Sending…"}</div>
              {result && <div style={{ fontSize: 12, color: "#8888a0", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{JSON.stringify(result)}</div>}
            </div>
          </div>
        )}

        <button type="submit" disabled={status === "loading"} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: status === "loading" ? "not-allowed" : "pointer", opacity: status === "loading" ? 0.6 : 1, fontFamily: "inherit" }}>
          {status === "loading" ? <><Loader2 size={16} /> Sending…</> : <><Send size={16} /> Send Email</>}
        </button>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
