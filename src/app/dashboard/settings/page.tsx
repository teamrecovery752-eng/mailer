"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, Zap, Server, Save, PlugZap } from "lucide-react";

const inputS: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };
const card: React.CSSProperties = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };

type Provider = "SES" | "CPANEL";

type Settings = {
  active: Provider;
  fromName: string;
  fromEmail: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
};

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={labelS}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        style={inputS}
        onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
      />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/settings");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setLoadError(data?.error || `Request failed (${res.status})`);
      } else {
        setSettings(data);
      }
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        // Don't overwrite the masked secret fields the user just typed
        // with the freshly-masked response — just re-fetch cleanly.
        setMessage({ type: "ok", text: "Settings saved." });
        fetchSettings();
      } else {
        setMessage({ type: "err", text: data?.error || `Failed to save settings (${res.status}).` });
      }
    } catch {
      setMessage({ type: "err", text: "Could not reach the server. Check your connection and try again." });
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-connection");
      const data = await res.json().catch(() => null);
      setTestResult(data || { connected: false, error: `Request failed (${res.status})` });
    } catch {
      setTestResult({ connected: false, error: "Could not reach API" });
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "#8888a0" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ ...card, border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <XCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Couldn't load settings</div>
            <div style={{ fontSize: 12, color: "#8888a0" }}>{loadError || "Unknown error."}</div>
          </div>
          <button onClick={fetchSettings}
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const providers: { id: Provider; label: string; sub: string; icon: any }[] = [
    { id: "SES", label: "Amazon SES", sub: "AWS Simple Email Service", icon: Zap },
    { id: "CPANEL", label: "cPanel Email (SMTP)", sub: "Any cPanel-hosted mailbox or SMTP server", icon: Server },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Email Provider Settings</h1>
        <p style={{ color: "#8888a0" }}>Choose and configure which service sends your outgoing email.</p>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Provider picker */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {providers.map(({ id, label, sub, icon: Icon }) => {
            const active = settings.active === id;
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="From Name" value={settings.fromName} onChange={(v) => update("fromName", v)} placeholder="BulkSend" />
            <Field label="From Email" value={settings.fromEmail} onChange={(v) => update("fromEmail", v)} type="email" placeholder="noreply@yourdomain.com" />
          </div>
        </div>

        {/* SES fields */}
        {settings.active === "SES" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Amazon SES Credentials</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="AWS Region" value={settings.sesRegion} onChange={(v) => update("sesRegion", v)} placeholder="us-east-1" />
              <Field label="Access Key ID" value={settings.sesAccessKeyId} onChange={(v) => update("sesAccessKeyId", v)} placeholder="AKIA..." />
              <Field label="Secret Access Key" value={settings.sesSecretAccessKey} onChange={(v) => update("sesSecretAccessKey", v)} type="password" placeholder="Leave blank to keep current value" />
            </div>
          </div>
        )}

        {/* cPanel / SMTP fields */}
        {settings.active === "CPANEL" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>cPanel Email (SMTP) Credentials</div>
            <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 16 }}>
              Use the mailbox's SMTP settings from your cPanel &rarr; Email Accounts &rarr; Connect Devices page.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <Field label="SMTP Host" value={settings.smtpHost} onChange={(v) => update("smtpHost", v)} placeholder="mail.yourdomain.com" />
                <Field label="Port" value={settings.smtpPort} onChange={(v) => update("smtpPort", Number(v) || 0)} type="number" placeholder="465" />
              </div>
              <div>
                <label style={labelS}>Encryption</label>
                <select
                  value={settings.smtpSecure ? "ssl" : "starttls"}
                  onChange={(e) => update("smtpSecure", e.target.value === "ssl")}
                  style={{ ...inputS, cursor: "pointer" }}
                  onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                >
                  <option value="ssl" style={{ background: "#18181f" }}>SSL — port 465</option>
                  <option value="starttls" style={{ background: "#18181f" }}>STARTTLS — port 587 / 25</option>
                </select>
              </div>
              <Field label="Username" value={settings.smtpUsername} onChange={(v) => update("smtpUsername", v)} placeholder="noreply@yourdomain.com" />
              <Field label="Password" value={settings.smtpPassword} onChange={(v) => update("smtpPassword", v)} type="password" placeholder="Leave blank to keep current value" />
            </div>
          </div>
        )}

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

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
            {saving ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
            Save Settings
          </button>
          <button type="button" onClick={handleTest} disabled={testing} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "#18181f", color: "#f0f0f5", fontSize: 14, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", cursor: testing ? "not-allowed" : "pointer", opacity: testing ? 0.6 : 1, fontFamily: "inherit" }}>
            {testing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <PlugZap size={15} />}
            Test Connection
          </button>
        </div>
      </form>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
