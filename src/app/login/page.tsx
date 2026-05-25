"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    res?.ok ? router.push("/dashboard") : setError("Invalid email or password.");
  }

  const inputS: React.CSSProperties = {
    width: "100%", padding: "14px 16px 14px 44px",
    background: "#18181f", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, color: "#f0f0f5", fontSize: 14,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0c0f", position: "relative", overflow: "hidden" }}>
      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      {/* Glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, padding: "0 20px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", margin: "0 auto 20px" }}>
            <ShieldCheck size={28} color="#6366f1" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Recoverlance Mailer</h1>
          <p style={{ fontSize: 14, color: "#8888a0" }}>Sign in to access your email dashboard</p>
        </div>

        {/* Card */}
        <div style={{ background: "#111116", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8888a0" }}>Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} color="#8888a0" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@recoverlance.com" style={inputS}
                  onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#8888a0" }}>Password</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} color="#8888a0" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••••" style={{ ...inputS, paddingRight: 48 }}
                  onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.6)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 0, display: "flex" }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>
                ⚠ {error}
              </div>
            )}

            {/* Button */}
            <button type="submit" disabled={loading}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px", borderRadius: 12, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", marginTop: 4 }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "#5355d8")}
              onMouseLeave={e => (e.currentTarget.style.background = "#6366f1")}>
              {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</> : "Sign In"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#555566", marginTop: 24 }}>
          Recoverlance Mailer — Powered by Amazon SES
        </p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
