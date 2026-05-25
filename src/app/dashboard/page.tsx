"use client";
import { useState, useEffect } from "react";
import { Send, Users, Zap, CheckCircle2, XCircle, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

const card = { background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };

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

  useEffect(() => {
    fetch("/api/test-connection")
      .then(r => r.json())
      .then(d => { setConn(d); setChecking(false); })
      .catch(() => { setConn({ connected: false, error: "Could not reach API" }); setChecking(false); });
  }, []);

  const borderColor = checking ? "rgba(255,255,255,0.06)" : conn?.connected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#8888a0" }}>Welcome back. Your SES email portal is ready.</p>
      </div>

      {/* SES Status */}
      <div style={{ ...card, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        {checking
          ? <Activity size={18} color="#8888a0" />
          : conn?.connected
            ? <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0 }} />
            : <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {checking ? "Checking SES connection…" : conn?.connected ? "Amazon SES Connected" : "SES Connection Failed"}
          </div>
          {!checking && (
            <div style={{ fontSize: 12, color: "#8888a0", marginTop: 2 }}>
              {conn?.connected ? `Region: ${conn.region} · From: ${conn.fromEmail}` : conn?.error}
            </div>
          )}
        </div>
        {!checking && !conn?.connected && (
          <a href="https://console.aws.amazon.com/ses" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#6366f1", textDecoration: "none" }}>
            AWS Console →
          </a>
        )}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard icon={Send} label="Emails Sent" value="—" sub="Session total" color="#6366f1" />
        <StatCard icon={CheckCircle2} label="Delivered" value="—" sub="Success rate" color="#22c55e" />
        <StatCard icon={Users} label="Recipients" value="—" sub="Unique addresses" color="#f59e0b" />
        <StatCard icon={Zap} label="SES Quota" value="—" sub="Daily limit" color="#a78bfa" />
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
            "Verify recoverlance.com domain in AWS SES console",
            "Add DKIM, DMARC, and SPF DNS records to your domain",
            "Request production access (exit SES sandbox)",
            "Set DATABASE_URL, NEXTAUTH_SECRET, and AWS credentials in Vercel",
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
