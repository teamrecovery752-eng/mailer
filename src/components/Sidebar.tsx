"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Send, Users, History, LogOut, ShieldCheck, Zap, UserCog } from "lucide-react";

const baseNav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/single", icon: Send, label: "Single Email" },
  { href: "/dashboard/bulk", icon: Users, label: "Bulk Email" },
  { href: "/dashboard/history", icon: History, label: "Send History" },
];
const adminNav = [
  { href: "/dashboard/users", icon: UserCog, label: "Users" },
];

const S = {
  aside: {
    position: "fixed" as const, left: 0, top: 0, height: "100%", width: 240,
    display: "flex", flexDirection: "column" as const, zIndex: 20,
    background: "#111116", borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
  },
  nav: { flex: 1, padding: 12, display: "flex", flexDirection: "column" as const, gap: 2, overflowY: "auto" as const },
  navLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: "#8888a0",
    padding: "8px 12px",
  },
  navLinkBase: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 8, fontSize: 14,
    fontWeight: 500, textDecoration: "none", transition: "all 0.15s",
  },
  badge: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 8, margin: "0 12px 8px",
    background: "#18181f",
  },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#22c55e", marginLeft: "auto" },
  userBox: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 8, background: "#18181f",
    margin: "0 12px", marginBottom: 8,
  },
  avatar: {
    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700,
  },
  signOut: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 8, fontSize: 14,
    fontWeight: 500, color: "#8888a0", cursor: "pointer",
    background: "none", border: "none", width: "100%",
    margin: "0 0 4px 0",
  },
};

export default function Sidebar() {
  const path = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const nav = isAdmin ? [...baseNav, ...adminNav] : baseNav;

  return (
    <aside style={S.aside}>
      {/* Logo */}
      <div style={S.logo}>
        <div style={S.logoIcon}>
          <ShieldCheck size={16} color="#6366f1" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>BulkSend</div>
          <div style={{ fontSize: 11, color: "#8888a0", marginTop: 2 }}>by Recoverlance</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.navLabel}>Navigation</div>
        {nav.map(({ href, icon: Icon, label }) => {
          const active = href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
          return (
            <Link key={href} href={href} style={{
              ...S.navLinkBase,
              background: active ? "#6366f1" : "transparent",
              color: active ? "#fff" : "#8888a0",
            }}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Session */}
      {session?.user && (
        <div style={{ padding: "0", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <div style={S.userBox}>
            <div style={S.avatar}>{session.user.name?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.name}</div>
              <div style={{ fontSize: 11, color: "#8888a0" }}>{(session.user as any).role}</div>
            </div>
          </div>
        </div>
      )}

      {/* SES badge */}
      <div style={S.badge}>
        <Zap size={13} color="#22c55e" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#8888a0" }}>Amazon SES</span>
        <div style={S.dot} />
      </div>

      {/* Sign out */}
      <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
        <button style={S.signOut} onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut size={16} style={{ flexShrink: 0 }} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
