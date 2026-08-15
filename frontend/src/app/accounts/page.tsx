"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { Link2, Unlink, AlertTriangle, CheckCircle, Video } from "lucide-react";

const FacebookIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "YOUTUBE";
  accountId: string;
  accountName: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchAccounts = async () => {
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${apiUrl}/api/oauth/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      setAccounts(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleConnect = async (platform: "facebook" | "youtube") => {
    setError(null); setMessage(null);
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${apiUrl}/api/oauth/${platform}/url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to initiate connection for ${platform}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) { setError(err.message); }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account? Any scheduled posts to this account may fail.")) return;
    setError(null); setMessage(null);
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${apiUrl}/api/oauth/accounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disconnect account");
      setMessage("Account disconnected successfully");
      fetchAccounts();
    } catch (err: any) { setError(err.message); }
  };

  const ytConnected = accounts.filter((a) => a.platform === "YOUTUBE");
  const fbConnected = accounts.filter((a) => a.platform === "FACEBOOK");

  return (
    <div className="flex min-h-screen bg-[#080A12]">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC]">Connected Accounts</h1>
            <p className="text-[#94A3B8] mt-1">Link your Facebook Pages and YouTube Channels to publish content.</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-4 text-sm text-red-300">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444] mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          {message && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/8 p-4 text-sm text-green-300">
              <CheckCircle size={18} className="shrink-0 text-[#22C55E] mt-0.5" />
              <p>{message}</p>
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6366F1] border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">

              {/* YouTube Card */}
              <div className="glass-panel p-6 flex flex-col justify-between border-red-500/10">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                        <Video size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#F8FAFC] text-lg">YouTube</h3>
                        <p className="text-xs text-red-400/60">YouTube Channels</p>
                      </div>
                    </div>
                    {ytConnected.length > 0 && (
                      <span className="px-2.5 py-1 text-xs rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 font-medium">
                        Connected
                      </span>
                    )}
                  </div>

                  {ytConnected.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {ytConnected.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[#252B41] text-sm">
                          <div className="overflow-hidden">
                            <span className="font-semibold text-[#F8FAFC] block truncate">{account.accountName}</span>
                            <span className="text-[10px] text-[#94A3B8] block truncate">ID: {account.accountId}</span>
                          </div>
                          <button
                            onClick={() => handleDisconnect(account.id)}
                            className="p-1.5 text-[#EF4444] hover:text-red-300 hover:bg-red-950/20 rounded-md border border-[#EF4444]/25"
                            title="Disconnect"
                          >
                            <Unlink size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#94A3B8] mb-6 italic">No YouTube channel linked yet.</p>
                  )}
                </div>
                <button
                  onClick={() => handleConnect("youtube")}
                  className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all font-semibold text-white text-sm"
                >
                  Connect YouTube Channel
                </button>
              </div>

              {/* Facebook Card */}
              <div className="glass-panel p-6 flex flex-col justify-between border-blue-500/10">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <FacebookIcon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#F8FAFC] text-lg">Facebook</h3>
                        <p className="text-xs text-blue-400/60">Facebook Pages</p>
                      </div>
                    </div>
                    {fbConnected.length > 0 && (
                      <span className="px-2.5 py-1 text-xs rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 font-medium">
                        Connected
                      </span>
                    )}
                  </div>

                  {fbConnected.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {fbConnected.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[#252B41] text-sm">
                          <div className="overflow-hidden">
                            <span className="font-semibold text-[#F8FAFC] block truncate">{account.accountName}</span>
                            <span className="text-[10px] text-[#94A3B8] block truncate">ID: {account.accountId}</span>
                          </div>
                          <button
                            onClick={() => handleDisconnect(account.id)}
                            className="p-1.5 text-[#EF4444] hover:text-red-300 hover:bg-red-950/20 rounded-md border border-[#EF4444]/25"
                            title="Disconnect"
                          >
                            <Unlink size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#94A3B8] mb-6 italic">No Facebook page linked yet.</p>
                  )}
                </div>
                <button
                  onClick={() => handleConnect("facebook")}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all font-semibold text-white text-sm"
                >
                  Connect Facebook Page
                </button>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
