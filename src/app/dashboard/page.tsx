"use client";
import { useState, useEffect, useCallback } from "react";
import { Send, Users, CheckCircle2, XCircle, Activity, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { MAIL_SETTINGS_UPDATED_EVENT } from "@/lib/mailSettingsEvents";

const card = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };

// Single source of truth for how each mail provider is displayed across the
// dashboard, so nothing hardcodes "SES" or "cPanel" once Resend (or any
// future provider) is the active one.
const PROVIDER_LABELS: Record<string, string> = {
  SES: "Amazon SES",
  CPANEL: "cPanel Email",
  RESEND: "Resend",
};
const providerLabel = (id?: string | null) => (id && PROVIDER_LABELS[id]) || "Email Provider";

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div style={card}>
      <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, border: `1px solid ${color}30`, marginBottom: 16 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#8888a0" }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [conn, setConn] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);

  const checkConnection = useCallback(() => {
    setChecking(true);
    fetch("/api/test-connection")
      .then(r => r.json())
      .then(d => { setConn(d); setChecking(false); })
      .catch(() => { setConn({ connected: false, error: "Could not reach API" }); setChecking(false); });
  }, []);

  const loadStats = useCallback(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(d => { if (d?.error) throw new Error(d.error); setStats(d); setStatsError(false); })
      .catch(() => setStatsError(true));
  }, []);

  useEffect(() => {
    checkConnection();
    loadStats();
    // Switching providers in Settings changes what "connected" means here
    // (and the fromEmail shown), so re-check immediately instead of
    // requiring a page refresh to see the new status.
    window.addEventListener(MAIL_SETTINGS_UPDATED_EVENT, checkConnection);
    return () => window.removeEventListener(MAIL_SETTINGS_UPDATED_EVENT, checkConnection);
  }, [checkConnection, loadStats]);

  const borderColor = checking ? "rgba(255,255,255,0.06)" : conn?.connected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#8888a0" }}>Welcome back. Your email portal is ready.</p>
      </div>

      {/* Provider Status */}
      <div style={{ ...card, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        {checking
          ? <Activity size={18} color="#8888a0" />
          : conn?.connected
            ? <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0 }} />
            : <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {checking
              ? "Checking connection…"
              : conn?.connected
                ? `${providerLabel(conn?.provider)} Connected`
                : `${providerLabel(conn?.provider)} Connection Failed`}
          </div>
          {!checking && (
            <div style={{ fontSize: 12, color: "#8888a0", marginTop: 2 }}>
              {conn?.connected ? conn.detail : conn?.error}
            </div>
          )}
        </div>
        {!checking && !conn?.connected && (
          <a href="/dashboard/settings"
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#6366f1", textDecoration: "none" }}>
            Fix in Settings →
          </a>
        )}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard icon={Send} label="Emails Sent" value={stats ? stats.emailsSent.toLocaleString() : statsError ? "—" : "…"} sub="All-time total" color="#6366f1" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats ? (stats.deliveryRate == null ? "—" : `${stats.deliveryRate}%`) : statsError ? "—" : "…"} sub="Success rate" color="#22c55e" />
        <StatCard icon={Users} label="Recipients" value={stats ? stats.uniqueRecipients.toLocaleString() : statsError ? "—" : "…"} sub="Unique addresses" color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Sent Today" value={stats ? stats.sentToday.toLocaleString() : statsError ? "—" : "…"} sub="Since midnight" color="#a78bfa" />
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[
          { href: "/dashboard/single", icon: Send, title: "Single Email", desc: "Compose and send to one or multiple recipients. Supports HTML.", color: "#6366f1" },
          { href: "/dashboard/bulk", icon: Users, title: "Bulk Email", desc: "Upload a CSV and send personalised campaigns at scale.", color: "#22c55e" },
        ].map(({ href, icon: Icon, title, desc, color }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{ ...card, cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon size={18} color={color} />
                </div>
                <ArrowRight size={16} color="#8888a0" />
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#8888a0", lineHeight: 1.5 }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Setup checklist */}
      <div style={{ ...card, background: "#18181f" }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>📋 First-time setup checklist</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Choose a provider (Amazon SES, cPanel Email, or Resend) in Settings",
            "Verify your sending domain and add DKIM/DMARC/SPF DNS records",
            "For SES: request production access (exit SES sandbox). For Resend/cPanel: confirm your sending limits.",
            "Set DATABASE_URL and AUTH_SECRET in Vercel",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "#8888a0", fontSize: 13 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{i + 1}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
