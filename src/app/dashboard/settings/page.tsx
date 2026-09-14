"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCircle2, XCircle, Zap, Server, Save, PlugZap, Send,
  FileCode, Code2, Image as ImageIcon, Trash2, Eye, Plus, Globe, Star,
  Pencil, Power,
} from "lucide-react";
import { notifyDomainsUpdated } from "@/lib/domainEvents";

const inputS: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };
const card: React.CSSProperties = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };
const MASK = "••••••••";

type Provider = "SES" | "CPANEL" | "RESEND";

type Domain = {
  id: string;
  label: string;
  domain: string;
  isDefault: boolean;
  isActive: boolean;
  active: Provider;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  resendApiKey: string;
  companyName: string;
  website: string;
  contactUrl: string;
  address: string;
  accentColor: string;
  unsubscribeText: string;
  signatureEnabled: boolean;
  signatureHtml: string;
  secretsConfigured?: { sesSecretAccessKey: boolean; smtpPassword: boolean; resendApiKey: boolean };
};

const blankDomain: Domain = {
  id: "",
  label: "",
  domain: "",
  isDefault: false,
  isActive: true,
  active: "SES",
  fromName: "",
  fromEmail: "",
  replyTo: "",
  sesRegion: "us-east-1",
  sesAccessKeyId: "",
  sesSecretAccessKey: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
  resendApiKey: "",
  companyName: "",
  website: "",
  contactUrl: "",
  address: "",
  accentColor: "#6366f1",
  unsubscribeText: "Reply STOP to unsubscribe",
  signatureEnabled: false,
  signatureHtml: "",
  secretsConfigured: { sesSecretAccessKey: false, smtpPassword: false, resendApiKey: false },
};

// Mirrors the server-side check in lib/domains.ts so the Save button can
// block with a clear inline message before ever hitting the API — this is
// what stops a provider switch from silently persisting with a missing
// password/API key. A secret counts as present if either the user just
// typed a new one, or one is already saved server-side (secretsConfigured)
// and they left it blank to keep it.
function missingFieldsFor(d: Domain): string[] {
  const secretsOk = d.secretsConfigured || { sesSecretAccessKey: false, smtpPassword: false, resendApiKey: false };
  const missing: string[] = [];
  if (!d.label.trim()) missing.push("Label");
  if (!d.domain.trim()) missing.push("Domain");
  if (!d.fromName.trim()) missing.push("From Name");
  if (!d.fromEmail.trim()) missing.push("From Email");

  if (d.active === "SES") {
    if (!d.sesRegion.trim()) missing.push("AWS Region");
    if (!d.sesAccessKeyId.trim()) missing.push("Access Key ID");
    if (!d.sesSecretAccessKey.trim() && !secretsOk.sesSecretAccessKey) missing.push("Secret Access Key");
  } else if (d.active === "CPANEL") {
    if (!d.smtpHost.trim()) missing.push("SMTP Host");
    if (!d.smtpPort) missing.push("Port");
    if (!d.smtpUsername.trim()) missing.push("Username");
    if (!d.smtpPassword.trim() && !secretsOk.smtpPassword) missing.push("Password");
  } else if (d.active === "RESEND") {
    if (!d.resendApiKey.trim() && !secretsOk.resendApiKey) missing.push("API Key");
  }
  return missing;
}

function Field({ label, value, onChange, type = "text", placeholder, hint }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: { text: string; ok: boolean } }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ ...labelS, marginBottom: 0 }}>{label}</label>
        {hint && (
          <span style={{ fontSize: 11, fontWeight: 600, color: hint.ok ? "#22c55e" : "#f59e0b" }}>{hint.text}</span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        style={{ ...inputS, ...(hint && !hint.ok ? { borderColor: "rgba(245,158,11,0.4)" } : {}) }}
        onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
        onBlur={(e) => (e.target.style.borderColor = hint && !hint.ok ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)")}
      />
    </div>
  );
}

// Three ways to arrive at the same thing — a plain HTML string saved as
// domain.signatureHtml. Whichever tab the admin used last is just how
// that string got built:
//  - "file"  → reads an uploaded .html/.htm file's text content as-is.
//  - "code"  → the textarea *is* signatureHtml, edited directly.
//  - "image" → reads an uploaded picture as a base64 data URI and wraps
//              it in a single <img> tag, so no separate image hosting
//              is needed — the picture travels inside the HTML itself.
type SigTab = "file" | "code" | "image";

function SignatureSection({
  enabled,
  html,
  onEnabledChange,
  onHtmlChange,
}: {
  enabled: boolean;
  html: string;
  onEnabledChange: (v: boolean) => void;
  onHtmlChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<SigTab>("code");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5MB, comfortably under the 2MB signature cap once base64-encoded

  function handleHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setFileError("");
    const reader = new FileReader();
    reader.onload = () => {
      onHtmlChange(String(reader.result || ""));
      setFileName(file.name);
    };
    reader.onerror = () => setFileError("Couldn't read that file. Try again.");
    reader.readAsText(file);
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError("");
    if (!file.type.startsWith("image/")) { setFileError("That's not an image file."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setFileError(`Image is too large (max ${(MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(1)}MB) — compress it and try again.`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      onHtmlChange(`<img src="${dataUrl}" alt="Email signature" style="display:block;max-width:100%;height:auto;border:0;" />`);
      setFileName(file.name);
    };
    reader.onerror = () => setFileError("Couldn't read that image. Try again.");
    reader.readAsDataURL(file);
  }

  const tabs: { id: SigTab; label: string; icon: any }[] = [
    { id: "file", label: "HTML File", icon: FileCode },
    { id: "code", label: "HTML Code", icon: Code2 },
    { id: "image", label: "Picture", icon: ImageIcon },
  ];

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Email Signature</div>

        {/* Enable/disable toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <span style={{ fontSize: 12, color: "#8888a0" }}>{enabled ? "Appended to every send" : "Off"}</span>
          <span
            onClick={() => onEnabledChange(!enabled)}
            style={{ width: 34, height: 20, borderRadius: 999, background: enabled ? "#6366f1" : "rgba(255,255,255,0.12)", position: "relative", transition: "background 0.15s", flexShrink: 0 }}
          >
            <span style={{ position: "absolute", top: 2, left: enabled ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
          </span>
        </label>
      </div>
      <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
        Added to the bottom of every outgoing HTML email sent through this domain — Single and Bulk, on any provider.
      </p>

      {/* Source tabs */}
      <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "#0c0c0f", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14, width: "fit-content" }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setFileError(""); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, border: "none",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "inherit", transition: "all 0.15s",
              background: tab === id ? "#6366f1" : "transparent",
              color: tab === id ? "#fff" : "#8888a0",
            }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <div>
          <input ref={fileInputRef} type="file" accept=".html,.htm,text/html" onChange={handleHtmlFile} style={{ display: "none" }} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            <FileCode size={14} />
            {fileName || "Choose an .html file…"}
          </button>
          <p style={{ fontSize: 12, color: "#8888a0", marginTop: 8 }}>Upload a signature exported as an HTML file — its contents are loaded below and can still be edited.</p>
        </div>
      )}

      {tab === "image" && (
        <div>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} />
          <button type="button" onClick={() => imageInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            <ImageIcon size={14} />
            {fileName || "Choose an image…"}
          </button>
          <p style={{ fontSize: 12, color: "#8888a0", marginTop: 8 }}>Upload a signature saved as a single picture (PNG/JPG). It's embedded directly, so it displays even when recipients block external images.</p>
        </div>
      )}

      {fileError && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12 }}>
          {fileError}
        </div>
      )}

      {/* The HTML — always visible/editable regardless of how it got here */}
      <div style={{ marginTop: tab === "code" ? 0 : 14 }}>
        <label style={labelS}>HTML Source</label>
        <textarea
          value={html}
          onChange={(e) => onHtmlChange(e.target.value)}
          rows={7}
          placeholder='<table>…your signature markup…</table>'
          style={{ ...inputS, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6 }}
          onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        {html && (
          <button type="button" onClick={() => { onHtmlChange(""); setFileName(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#8888a0", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            <Trash2 size={12} /> Clear signature
          </button>
        )}
      </div>

      {/* Live preview */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Eye size={13} color="#8888a0" />
          <label style={{ ...labelS, marginBottom: 0 }}>Preview</label>
        </div>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#fff" }}>
          {html ? (
            <iframe
              srcDoc={`<!DOCTYPE html><html><body style="margin:0;padding:16px;">${html}</body></html>`}
              sandbox=""
              style={{ width: "100%", height: 220, border: "none", display: "block" }}
              title="Signature preview"
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#aaa" }}>Nothing to preview yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const providers: { id: Provider; label: string; sub: string; icon: any }[] = [
  { id: "SES", label: "Amazon SES", sub: "AWS Simple Email Service", icon: Zap },
  { id: "CPANEL", label: "cPanel Email (SMTP)", sub: "Any cPanel-hosted mailbox or SMTP server", icon: Server },
  { id: "RESEND", label: "Resend", sub: "resend.com transactional email API", icon: Send },
];

// The full add/edit form for one domain — provider + credentials, sender
// identity, branding (used to fill {{companyName}} etc. in every
// template), and the per-domain signature. Shared between "add new
// domain" and "edit existing domain".
function DomainForm({
  initial,
  isNew,
  onSaved,
  onDeleted,
  onCancel,
}: {
  initial: Domain;
  isNew: boolean;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Domain>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function update<K extends keyof Domain>(key: K, value: Domain[K]) {
    setD((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const missing = missingFieldsFor(d);
    if (missing.length) {
      setMessage({ type: "err", text: `Can't save — missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(isNew ? "/api/domains" : `/api/domains/${d.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setMessage({ type: "ok", text: isNew ? "Domain added." : "Domain saved." });
        notifyDomainsUpdated();
        onSaved();
      } else {
        setMessage({ type: "err", text: data?.error || `Failed to save (${res.status}).` });
      }
    } catch {
      setMessage({ type: "err", text: "Could not reach the server. Check your connection and try again." });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${d.label || "this domain"}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/domains/${d.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        notifyDomainsUpdated();
        onDeleted();
      } else {
        setMessage({ type: "err", text: data?.error || "Could not delete domain." });
      }
    } catch {
      setMessage({ type: "err", text: "Could not reach the server. Check your connection and try again." });
    }
    setDeleting(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/test-connection?domainId=${d.id}`);
      const data = await res.json().catch(() => null);
      setTestResult(data || { connected: false, error: `Request failed (${res.status})` });
    } catch {
      setTestResult({ connected: false, error: "Could not reach API" });
    }
    setTesting(false);
  }

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Label + domain */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Domain</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label="Label" value={d.label} onChange={(v) => update("label", v)} placeholder="e.g. Recoverlance" />
          <Field label="Domain" value={d.domain} onChange={(v) => update("domain", v)} placeholder="e.g. recoverlance.com" />
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={d.isActive} onChange={(e) => update("isActive", e.target.checked)} />
            Active (selectable when sending)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={d.isDefault} onChange={(e) => update("isDefault", e.target.checked)} />
            Default domain
          </label>
        </div>
      </div>

      {/* Provider picker */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {providers.map(({ id, label, sub, icon: Icon }) => {
          const active = d.active === id;
          return (
            <div
              key={id}
              onClick={() => update("active", id)}
              style={{
                ...card,
                cursor: "pointer",
                padding: 18,
                border: `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.06)"}`,
                background: active ? "rgba(99,102,241,0.08)" : "#111116",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Icon size={16} color={active ? "#6366f1" : "#8888a0"} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                {active && <CheckCircle2 size={14} color="#6366f1" style={{ marginLeft: "auto" }} />}
              </div>
              <div style={{ fontSize: 12, color: "#8888a0" }}>{sub}</div>
            </div>
          );
        })}
      </div>

      {/* Shared "from" identity */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Sender Identity</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label="From Name" value={d.fromName} onChange={(v) => update("fromName", v)} placeholder="Recoverlance" />
          <Field label="From Email" value={d.fromEmail} onChange={(v) => update("fromEmail", v)} type="email" placeholder="noreply@yourdomain.com" />
        </div>
        <Field label="Reply-To (optional)" value={d.replyTo} onChange={(v) => update("replyTo", v)} type="email" placeholder="replies@yourdomain.com" />
      </div>

      {/* SES fields */}
      {d.active === "SES" && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Amazon SES Credentials</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="AWS Region" value={d.sesRegion} onChange={(v) => update("sesRegion", v)} placeholder="us-east-1" />
            <Field label="Access Key ID" value={d.sesAccessKeyId} onChange={(v) => update("sesAccessKeyId", v)} placeholder="AKIA..." />
            <Field label="Secret Access Key" value={d.sesSecretAccessKey} onChange={(v) => update("sesSecretAccessKey", v)} type="password" placeholder={d.secretsConfigured?.sesSecretAccessKey ? "Leave blank to keep the saved key" : "Required — no key saved yet"}
              hint={d.secretsConfigured?.sesSecretAccessKey ? { text: "✓ Saved", ok: true } : { text: "Not set — required", ok: false }} />
          </div>
        </div>
      )}

      {/* cPanel / SMTP fields */}
      {d.active === "CPANEL" && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>cPanel Email (SMTP) Credentials</div>
          <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
            Use the mailbox's SMTP settings from your cPanel &rarr; Email Accounts &rarr; Connect Devices page.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <Field label="SMTP Host" value={d.smtpHost} onChange={(v) => update("smtpHost", v)} placeholder="mail.yourdomain.com" />
              <Field label="Port" value={d.smtpPort} onChange={(v) => update("smtpPort", Number(v) || 0)} type="number" placeholder="465" />
            </div>
            <div>
              <label style={labelS}>Encryption</label>
              <select
                value={d.smtpSecure ? "ssl" : "starttls"}
                onChange={(e) => update("smtpSecure", e.target.value === "ssl")}
                style={{ ...inputS, cursor: "pointer" }}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              >
                <option value="ssl" style={{ background: "#18181f" }}>SSL — port 465</option>
                <option value="starttls" style={{ background: "#18181f" }}>STARTTLS — port 587 / 25</option>
              </select>
            </div>
            <Field label="Username" value={d.smtpUsername} onChange={(v) => update("smtpUsername", v)} placeholder="noreply@yourdomain.com" />
            <Field label="Password" value={d.smtpPassword} onChange={(v) => update("smtpPassword", v)} type="password" placeholder={d.secretsConfigured?.smtpPassword ? "Leave blank to keep the saved password" : "Required — no password saved yet"}
              hint={d.secretsConfigured?.smtpPassword ? { text: "✓ Saved", ok: true } : { text: "Not set — required", ok: false }} />
          </div>
        </div>
      )}

      {/* Resend fields */}
      {d.active === "RESEND" && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Resend Credentials</div>
          <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
            Create a key at resend.com/api-keys, and make sure your "From Email" domain is a verified sender in Resend.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="API Key" value={d.resendApiKey} onChange={(v) => update("resendApiKey", v)} type="password" placeholder={d.secretsConfigured?.resendApiKey ? "re_... — leave blank to keep the saved key" : "Required — no key saved yet"}
              hint={d.secretsConfigured?.resendApiKey ? { text: "✓ Saved", ok: true } : { text: "Not set — required", ok: false }} />
          </div>
        </div>
      )}

      {/* Branding — flows into every template via {{companyName}} etc. */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Branding</div>
        <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
          Fills the {"{{companyName}}"}, {"{{website}}"}, {"{{contactUrl}}"}, {"{{address}}"}, {"{{accentColor}}"} and {"{{unsubscribeText}}"} merge tags in every marketing template and any custom template using them — so the same template reads correctly no matter which domain sends it.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Company Name" value={d.companyName} onChange={(v) => update("companyName", v)} placeholder="Recoverlance" />
            <Field label="Website" value={d.website} onChange={(v) => update("website", v)} placeholder="https://recoverlance.com" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Contact / CTA URL" value={d.contactUrl} onChange={(v) => update("contactUrl", v)} placeholder="https://recoverlance.com/contact" />
            <div>
              <label style={labelS}>Accent Color</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(d.accentColor) ? d.accentColor : "#6366f1"} onChange={(e) => update("accentColor", e.target.value)}
                  style={{ width: 44, height: 42, padding: 2, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#18181f", cursor: "pointer" }} />
                <input value={d.accentColor} onChange={(e) => update("accentColor", e.target.value)} placeholder="#6366f1"
                  style={{ ...inputS, flex: 1 }}
                  onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
              </div>
            </div>
          </div>
          <Field label="Mailing Address" value={d.address} onChange={(v) => update("address", v)} placeholder="2300 Stockton St, San Francisco, CA 94133" />
          <Field label="Unsubscribe Text" value={d.unsubscribeText} onChange={(v) => update("unsubscribeText", v)} placeholder="Reply STOP to unsubscribe" />
        </div>
      </div>

      {/* Email signature */}
      <SignatureSection
        enabled={d.signatureEnabled}
        html={d.signatureHtml}
        onEnabledChange={(v) => update("signatureEnabled", v)}
        onHtmlChange={(v) => update("signatureHtml", v)}
      />

      {message && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: message.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${message.type === "ok" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, color: message.type === "ok" ? "#22c55e" : "#ef4444" }}>
          {message.text}
        </div>
      )}

      {testResult && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, background: testResult.connected ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${testResult.connected ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, color: testResult.connected ? "#22c55e" : "#ef4444" }}>
          {testResult.connected ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          <span>{testResult.connected ? testResult.detail || "Connected" : testResult.error || "Connection failed"}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
          {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
          {isNew ? "Add Domain" : "Save Changes"}
        </button>
        {!isNew && (
          <button type="button" onClick={handleTest} disabled={testing} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "#18181f", color: "#f0f0f5", fontSize: 14, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: testing ? "not-allowed" : "pointer", opacity: testing ? 0.6 : 1, fontFamily: "inherit" }}>
            {testing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <PlugZap size={15} />}
            Test Connection
          </button>
        )}
        <button type="button" onClick={onCancel} style={{ padding: "12px 20px", borderRadius: 10, background: "transparent", color: "#8888a0", fontSize: 14, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        {!isNew && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 14, fontWeight: 600, border: "1px solid rgba(239,68,68,0.2)", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "inherit", marginLeft: "auto" }}>
            {deleting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={15} />}
            Delete Domain
          </button>
        )}
      </div>
    </form>
  );
}

// A collapsed summary row for one saved domain in the list, with quick
// actions (edit / make default / enable-disable) that don't require
// opening the full form.
function DomainRow({
  domain,
  onEdit,
  onQuickUpdate,
}: {
  domain: Domain;
  onEdit: () => void;
  onQuickUpdate: (patch: Partial<Domain>) => void;
}) {
  const meta = providers.find((p) => p.id === domain.active);
  const Icon = meta?.icon ?? Zap;
  const configured = missingFieldsFor(domain).length === 0;

  return (
    <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: 18, flexWrap: "wrap" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", flexShrink: 0 }}>
        <Globe size={17} color="#6366f1" />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{domain.label}</div>
          {domain.isDefault && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: 5 }}>
              <Star size={10} /> DEFAULT
            </span>
          )}
          {!domain.isActive && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#8888a0", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 5 }}>
              DISABLED
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#8888a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {domain.domain} · {domain.fromEmail || "no from-address set"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: configured ? "#22c55e" : "#f59e0b", flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: configured ? "#22c55e" : "#f59e0b" }} />
        <Icon size={13} />
        {meta?.label}
      </div>
      {!domain.isDefault && (
        <button type="button" onClick={() => onQuickUpdate({ isDefault: true })} title="Make default"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", color: "#8888a0", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", flexShrink: 0 }}>
          <Star size={12} /> Make default
        </button>
      )}
      <button type="button" onClick={() => onQuickUpdate({ isActive: !domain.isActive })} title={domain.isActive ? "Disable" : "Enable"}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", color: "#8888a0", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", flexShrink: 0 }}>
        <Power size={12} /> {domain.isActive ? "Disable" : "Enable"}
      </button>
      <button type="button" onClick={onEdit}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", flexShrink: 0 }}>
        <Pencil size={12} /> Edit
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/domains");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setLoadError((data && data.error) || `Request failed (${res.status})`);
      } else {
        // The API sends back "••••••••" as a stand-in for any secret
        // that's already set (so real credentials never round-trip to
        // the browser). Blank those out here; the field's placeholder
        // already tells the admin "leave blank to keep current value".
        setDomains(data.map((raw: any) => ({
          ...raw,
          sesSecretAccessKey: raw.sesSecretAccessKey === MASK ? "" : raw.sesSecretAccessKey,
          smtpPassword: raw.smtpPassword === MASK ? "" : raw.smtpPassword,
          resendApiKey: raw.resendApiKey === MASK ? "" : raw.resendApiKey,
        })));
      }
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  async function quickUpdate(domain: Domain, patch: Partial<Domain>) {
    try {
      const res = await fetch(`/api/domains/${domain.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...domain, ...patch }),
      });
      if (res.ok) {
        notifyDomainsUpdated();
        fetchDomains();
      }
    } catch {}
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "#8888a0" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (loadError || !domains) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ ...card, border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Couldn't load domains</div>
            <div style={{ fontSize: 12, color: "#8888a0" }}>{loadError || "Unknown error."}</div>
          </div>
          <button onClick={fetchDomains}
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const editingDomain = editingId === "new" ? blankDomain : domains.find((d) => d.id === editingId) || null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sending Domains</h1>
          <p style={{ color: "#8888a0" }}>
            Add every domain/brand you send from. Each one has its own provider, credentials, and branding — used everywhere, including every marketing template.
          </p>
        </div>
        {!editingDomain && (
          <button onClick={() => setEditingId("new")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}>
            <Plus size={15} /> Add Domain
          </button>
        )}
      </div>

      {editingDomain ? (
        <DomainForm
          key={editingId}
          initial={editingDomain}
          isNew={editingId === "new"}
          onSaved={() => { setEditingId(null); fetchDomains(); }}
          onDeleted={() => { setEditingId(null); fetchDomains(); }}
          onCancel={() => setEditingId(null)}
        />
      ) : domains.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 48 }}>
          <Globe size={28} color="#8888a0" style={{ display: "block", margin: "0 auto 14px", opacity: 0.5 }} />
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>No domains configured yet</div>
          <p style={{ fontSize: 13, color: "#8888a0", marginBottom: 20 }}>Add your first sending domain to start sending Single or Bulk email.</p>
          <button onClick={() => setEditingId("new")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={15} /> Add Domain
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {domains.map((domain) => (
            <DomainRow
              key={domain.id}
              domain={domain}
              onEdit={() => setEditingId(domain.id)}
              onQuickUpdate={(patch) => quickUpdate(domain, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
