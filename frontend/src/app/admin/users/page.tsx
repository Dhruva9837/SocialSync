"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import {
  Users, Trash2, ShieldCheck, User,
  AlertTriangle, CheckCircle, Plus,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "EDITOR">("EDITOR");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchUsers = async () => {
    const token = localStorage.getItem("socialsync_token");
    try {
      const res = await fetch("http://localhost:5000/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) throw new Error("Access forbidden. You must be an administrator to view this page.");
      if (!res.ok) throw new Error("Failed to fetch user roster");
      setUsers(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setFeedback(null);
    const token = localStorage.getItem("socialsync_token");
    if (users.length >= 5) {
      setError("Maximum limit of 5 authorized users has been reached. Please remove a user before adding a new one.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setFeedback(`User ${name} created successfully!`);
      setName(""); setEmail(""); setPassword(""); setRole("EDITOR");
      setShowAddForm(false);
      fetchUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${userName}? This action cannot be undone.`)) return;
    setError(null); setFeedback(null);
    const token = localStorage.getItem("socialsync_token");
    try {
      const res = await fetch(`http://localhost:5000/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setFeedback(`User ${userName} revoked access successfully.`);
      fetchUsers();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="flex min-h-screen bg-[#080A12]">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC]">Team Management</h1>
              <p className="text-[#94A3B8] mt-1">
                Authorise and manage dashboard login permissions (Maximum 5 users total).
              </p>
            </div>
            {users.length < 5 && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-cta flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs"
              >
                <Plus size={16} />
                Add Member
              </button>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-4 text-sm text-red-300">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444] mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          {feedback && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/8 p-4 text-sm text-green-300">
              <CheckCircle size={18} className="shrink-0 text-[#22C55E] mt-0.5" />
              <p>{feedback}</p>
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6366F1] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Add Member Form */}
              {showAddForm && (
                <div className="glass-panel p-6 border-[#6366F1]/20 space-y-4">
                  <h3 className="text-base font-bold text-[#F8FAFC] mb-2">Create Authorized User</h3>
                  <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Team member name"
                        className="w-full glass-input rounded-lg text-xs py-2 text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@domain.com"
                        className="w-full glass-input rounded-lg text-xs py-2 text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full glass-input rounded-lg text-xs py-2 text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Access Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full glass-input rounded-lg text-xs bg-[#111528] border border-[#252B41] py-2 text-[#94A3B8]"
                      >
                        <option value="EDITOR">EDITOR (Publish, Schedule, Connect)</option>
                        <option value="ADMIN">ADMIN (All rights + Team management)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 bg-transparent hover:bg-white/5 border border-[#252B41] text-[#F8FAFC] rounded-lg text-xs font-semibold active:scale-[0.98] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-cta px-4 py-2 rounded-lg text-xs"
                      >
                        Create Account
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Members List */}
              <div className="glass-panel p-6 border-[#252B41]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#F8FAFC] text-base">Authorized Team Members</h3>
                  <span className="text-xs font-bold text-[#6366F1] bg-[#6366F1]/10 border border-[#6366F1]/20 px-2.5 py-1 rounded-full">
                    {users.length} / 5 Users Limit
                  </span>
                </div>

                <div className="divide-y divide-[#252B41]">
                  {users.map((member) => (
                    <div key={member.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center text-[#818CF8]">
                          <User size={18} />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-[#F8FAFC] block">{member.name}</span>
                          <span className="text-xs text-[#94A3B8] block mt-0.5">{member.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          {member.role === "ADMIN" ? (
                            <>
                              <ShieldCheck size={14} className="text-[#6366F1]" />
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#6366F1]">Admin</span>
                            </>
                          ) : (
                            <>
                              <Users size={14} className="text-[#94A3B8]" />
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">Editor</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteUser(member.id, member.name)}
                          className="p-2 text-[#EF4444] hover:text-red-300 hover:bg-red-950/20 rounded-lg border border-[#EF4444]/25 shrink-0"
                          title="Revoke Permission"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
