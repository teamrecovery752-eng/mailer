"use client";
import { useState, useEffect, useCallback } from "react";
import { UserPlus, Pencil, Trash2, CheckCircle2, XCircle, ShieldCheck, User, Loader2, X } from "lucide-react";

type UserRecord = { id: string; name: string; email: string; role: "ADMIN"|"USER"; isActive: boolean; createdAt: string; };

const inputS: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "#18181f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f0f0f5", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const labelS: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8888a0" };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.75)" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#111116", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8888a0", padding: 4 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord|null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "USER" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() { setForm({ name: "", email: "", password: "", role: "USER" }); setError(""); setShowCreate(true); }
  function openEdit(u: UserRecord) { setForm({ name: u.name, email: u.email, password: "", role: u.role }); setError(""); setEditUser(u); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError("");
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json(); setSubmitting(false);
    res.ok ? (setShowCreate(false), fetchUsers()) : setError(data.error || "Failed");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editUser) return; setSubmitting(true); setError("");
    const body: any = { name: form.name, email: form.email, role: form.role };
    if (form.password) body.password = form.password;
    const res = await fetch(`/api/users/${editUser.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json(); setSubmitting(false);
    res.ok ? (setEditUser(null), fetchUsers()) : setError(data.error || "Failed");
  }

  async function toggleActive(u: UserRecord) {
    await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !u.isActive }) });
    fetchUsers();
  }

  async function handleDelete(u: UserRecord) {
    if (!confirm(`Delete ${u.name}?`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    fetchUsers();
  }

  const UserForm = ({ onSubmit, isEdit }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[
        { label: "Full Name *", key: "name", type: "text", placeholder: "Jane Smith", required: true },
        { label: "Email *", key: "email", type: "email", placeholder: "jane@recoverlance.com", required: true },
        { label: isEdit ? "New Password (leave blank to keep)" : "Password *", key: "password", type: "password", placeholder: "••••••••", required: !isEdit },
      ].map(({ label, key, type, placeholder, required }) => (
        <div key={key}>
          <label style={labelS}>{label}</label>
          <input value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} type={type} placeholder={placeholder} required={required} style={inputS}
            onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
        </div>
      ))}
      <div>
        <label style={labelS}>Role</label>
        <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...inputS, cursor: "pointer" }}
          onFocus={e => (e.target.style.borderColor = "#6366f1")} onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}>
          <option value="USER" style={{ background: "#18181f" }}>User — can send emails</option>
          <option value="ADMIN" style={{ background: "#18181f" }}>Admin — full access</option>
        </select>
      </div>
      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>{error}</div>}
      <button type="submit" disabled={submitting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "inherit" }}>
        {submitting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : isEdit ? "Save Changes" : "Create User"}
      </button>
    </form>
  );

  const thS: React.CSSProperties = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8888a0", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#18181f" };
  const tdS: React.CSSProperties = { padding: "14px 16px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.04)" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Users</h1>
          <p style={{ color: "#8888a0" }}>Manage who can access BulkSend.</p>
        </div>
        <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <UserPlus size={15} /> Add User
        </button>
      </div>

      <div style={{ background: "#111116", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thS}>User</th>
              <th style={{ ...thS, width: 200 }}>Email</th>
              <th style={{ ...thS, width: 90 }}>Role</th>
              <th style={{ ...thS, width: 90 }}>Status</th>
              <th style={{ ...thS, width: 90, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: "50px", textAlign: "center", color: "#8888a0" }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 10px" }} />Loading…
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "50px", textAlign: "center", color: "#8888a0" }}>No users yet.</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td style={tdS}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#8888a0", marginTop: 2 }}>Joined {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                </td>
                <td style={{ ...tdS, color: "#8888a0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{u.email}</td>
                <td style={tdS}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: u.role === "ADMIN" ? "rgba(99,102,241,0.1)" : "#18181f", color: u.role === "ADMIN" ? "#6366f1" : "#8888a0" }}>
                    {u.role === "ADMIN" ? <ShieldCheck size={11} /> : <User size={11} />} {u.role}
                  </span>
                </td>
                <td style={tdS}>
                  <button onClick={() => toggleActive(u)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit", background: u.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: u.isActive ? "#22c55e" : "#ef4444" }}>
                    {u.isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {u.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td style={{ ...tdS, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button onClick={() => openEdit(u)} style={{ padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "#8888a0" }} title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(u)} style={{ padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <Modal title="Create New User" onClose={() => setShowCreate(false)}><UserForm onSubmit={handleCreate} /></Modal>}
      {editUser && <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}><UserForm onSubmit={handleEdit} isEdit /></Modal>}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
