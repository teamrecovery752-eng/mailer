"use client";
import { useState } from "react";
import { Send, Loader2, Plus, X, Code2, AlignLeft } from "lucide-react";
import { useToast } from "@/components/Toast";

const card = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, marginBottom: 16 };
const inputS: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };

const htmlTemplate = `<!DOCTYPE html>
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

const textTemplate = `Hello {{name}},

Your message goes here.

To submit a case, visit:
https://recoverlance.com/contact

---
Recoverlance
2300 Stockton St, San Francisco, CA 94133
hello@recoverlance.com`;

type Mode = "html" | "text";

export default function SingleEmailPage() {
  const { showToast } = useToast();
  const [to, setTo] = useState("");
  const [toList, setToList] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [replyTo, setReplyTo] = useState("");
  const [sending, setSending] = useState(false);

  function addRecipient() {
    const t = to.trim();
    if (t && !toList.includes(t)) { setToList(p => [...p, t]); setTo(""); }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setBody(""); // clear body when switching so stale content doesn't bleed over
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const recipients = toList.length > 0 ? toList : [to.trim()];
    if (!recipients[0]) return;
    setSending(true);

    const payload = {
      to: recipients,
      subject,
      replyTo: replyTo || undefined,
      // send as htmlBody or textBody depending on mode
      ...(mode === "html" ? { htmlBody: body } : { textBody: body, htmlBody: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>` }),
    };

    try {
      const res = await fetch("/api/send/single", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        const who = recipients.length > 1 ? `${recipients.length} recipients` : recipients[0];
        showToast("success", "Email sent", `Delivered to ${who}.`);
      } else {
        showToast("error", "Couldn't send that email", data?.error || `Request failed (${res.status}). Please try again.`);
      }
    } catch {
      showToast("error", "Couldn't send that email", "Network error — check your connection and try again.");
    }
    setSending(false);
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
            <input value={to} onChange={e => setTo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addRecipient())}
              type="email" placeholder="recipient@example.com" style={{ ...inputS, flex: 1 }}
              onFocus={e => (e.target.style.borderColor = "#6366f1")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
            <button type="button" onClick={addRecipient}
              style={{ padding: "12px 18px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit" }}>
              + Add
            </button>
          </div>
          {toList.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {toList.map(email => (
                <span key={email} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#18181f", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
                  {email}
                  <button type="button" onClick={() => setToList(p => p.filter(e => e !== email))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 0, lineHeight: 1 }}>
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
          <input value={subject} onChange={e => setSubject(e.target.value)} required type="text"
            placeholder="Your subject here..." style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
        </div>

        {/* Body — HTML or Text toggle */}
        <div style={card}>
          {/* Header row with toggle */}
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
                Write full HTML — supports styles, images, buttons, and merge tags like {"{{name}}"}.
              </>
            ) : (
              <>
                <AlignLeft size={13} color="#8888a0" />
                Plain text email — no formatting. Great for personal-looking outreach. Merge tags like {"{{name}}"} still work.
              </>
            )}
          </div>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            required
            rows={16}
            placeholder={mode === "html"
              ? "<!DOCTYPE html>\n<html>...</html>"
              : "Hi {{name}},\n\nYour message here...\n\n—\nRecoverlance"}
            style={{
              ...inputS,
              resize: "vertical",
              minHeight: 300,
              fontFamily: mode === "html" ? "'JetBrains Mono', monospace" : "inherit",
              fontSize: mode === "html" ? 12 : 14,
              lineHeight: 1.65,
            }}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />

          {/* Load template button */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button"
              onClick={() => setBody(mode === "html" ? htmlTemplate : textTemplate)}
              style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              Load {mode === "html" ? "HTML" : "plain text"} starter template →
            </button>
            {body.length > 0 && (
              <span style={{ fontSize: 11, color: "#555566" }}>{body.length} chars</span>
            )}
          </div>
        </div>

        {/* Reply-To */}
        <div style={card}>
          <label style={labelS}>Reply-To (optional)</label>
          <input value={replyTo} onChange={e => setReplyTo(e.target.value)} type="email"
            placeholder="replies@recoverlance.com" style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
        </div>

        <button type="submit" disabled={sending}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1, fontFamily: "inherit" }}>
          {sending ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Sending…</> : <><Send size={16} /> Send Email</>}
        </button>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
