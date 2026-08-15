"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Link from "next/link";
import {
  Video,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface Post {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  logs: { platform: string; status: string; platformUrl: string | null }[];
}

interface StorageStats {
  videoCount: number;
  totalGB: string;
  oldestExpiryDays: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  role: "ADMIN" | "EDITOR";
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [storage, setStorage] = useState<StorageStats>({ videoCount: 0, totalGB: "0.00", oldestExpiryDays: null });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const fetchData = async () => {
    const token = localStorage.getItem("socialsync_token");
    const storedUser = localStorage.getItem("socialsync_user");
    if (storedUser) setUser(JSON.parse(storedUser));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const postsRes = await fetch(`${apiUrl}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (postsRes.ok) setPosts(await postsRes.json());

      const statsRes = await fetch(`${apiUrl}/api/posts/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) setStorage(await statsRes.json());
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const triggerCleanup = async () => {
    if (!confirm("Are you sure you want to trigger manual media cleanup now? This will permanently delete all expired video files from the disk.")) return;
    setCleanupLoading(true);
    setCleanupMessage(null);
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      const res = await fetch(`${apiUrl}/api/admin/cleanup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { setCleanupMessage(data.message || "Manual cleanup complete."); fetchData(); }
      else setCleanupMessage(`Error: ${data.error}`);
    } catch (err: any) {
      setCleanupMessage(`Error: ${err.message}`);
    } finally {
      setCleanupLoading(false);
    }
  };

  const publishedCount = posts.filter((p) => p.status === "COMPLETED").length;
  const scheduledCount = posts.filter((p) => p.status === "SCHEDULED").length;
  const failedCount    = posts.filter((p) => p.status === "FAILED").length;

  return (
    <div className="flex min-h-screen bg-[#080A12]">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC]">Dashboard Overview</h1>
              <p className="text-[#94A3B8] mt-1">
                Welcome back{user ? `, ${user.name}` : ""}. Here is your publishing progress.
              </p>
            </div>
            <Link
              href="/create-post"
              className="btn-cta inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm shrink-0"
            >
              <Video size={18} />
              Create New Post
            </Link>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6366F1] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-8">

              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <div className="glass-panel p-5 border-[#22C55E]/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Published</span>
                    <div className="h-8 w-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
                      <CheckCircle size={18} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#F8FAFC]">{publishedCount}</h2>
                  <p className="text-xs text-[#94A3B8] mt-1">Successfully published posts</p>
                </div>

                <div className="glass-panel p-5 border-[#6366F1]/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Scheduled</span>
                    <div className="h-8 w-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center text-[#818CF8]">
                      <Clock size={18} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#F8FAFC]">{scheduledCount}</h2>
                  <p className="text-xs text-[#94A3B8] mt-1">Awaiting release schedules</p>
                </div>

                <div className="glass-panel p-5 border-[#EF4444]/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Failed Posts</span>
                    <div className="h-8 w-8 rounded-lg bg-[#EF4444]/10 flex items-center justify-center text-[#EF4444]">
                      <XCircle size={18} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#F8FAFC]">{failedCount}</h2>
                  <p className="text-xs text-[#94A3B8] mt-1">Needs attention or retry</p>
                </div>

                <div className="glass-panel p-5 border-[#22D3EE]/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Disk Storage</span>
                    <div className="h-8 w-8 rounded-lg bg-[#22D3EE]/10 flex items-center justify-center text-[#22D3EE]">
                      <Database size={18} />
                    </div>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#F8FAFC]">{storage.totalGB} GB</h2>
                  <p className="text-xs text-[#94A3B8] mt-1">{storage.videoCount} active video files</p>
                </div>

              </div>

              {/* Storage Policy Notice */}
              <div className="glass-panel p-6 border-[#6366F1]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center text-[#818CF8] shrink-0 mt-1 md:mt-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#F8FAFC] text-base">Media Cleanup Storage Policy</h3>
                    <p className="text-sm text-[#94A3B8] mt-0.5">
                      SocialSync retains uploaded media for 7 days. Deletions do not affect already published social media posts.
                    </p>
                    {storage.oldestExpiryDays && (
                      <span className="inline-block mt-2 text-xs font-bold text-[#22D3EE]">
                        Notice: Oldest media expires in {storage.oldestExpiryDays}
                      </span>
                    )}
                  </div>
                </div>

                {user?.role === "ADMIN" && (
                  <div className="shrink-0 w-full md:w-auto flex flex-col gap-2">
                    <button
                      onClick={triggerCleanup}
                      disabled={cleanupLoading}
                      className="px-4 py-2 bg-[#6366F1]/15 hover:bg-[#6366F1]/30 text-[#818CF8] font-semibold border border-[#6366F1]/20 rounded-xl text-xs active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {cleanupLoading ? "Cleaning…" : "Force Manual Cleanup"}
                    </button>
                    {cleanupMessage && (
                      <p className="text-[10px] text-[#6366F1] max-w-50 truncate">{cleanupMessage}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Main content split */}
              <div className="grid gap-6 md:grid-cols-3">

                {/* Recent Activity (2/3) */}
                <div className="glass-panel p-6 md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#F8FAFC] text-lg">Recent Publishing Activity</h3>
                    <Link
                      href="/history"
                      className="text-xs font-semibold text-[#6366F1] hover:text-[#818CF8] flex items-center gap-1"
                    >
                      View All History
                      <ArrowRight size={14} />
                    </Link>
                  </div>

                  {posts.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-[#252B41] rounded-xl">
                      <p className="text-sm text-[#94A3B8] italic">No posts created yet.</p>
                      <Link href="/create-post" className="text-xs text-[#6366F1] mt-2 hover:underline inline-block">
                        Upload your first video
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#252B41]">
                      {posts.slice(0, 5).map((post) => (
                        <div key={post.id} className="py-3.5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-[#F8FAFC] block truncate">{post.title}</span>
                            <span className="text-[11px] text-[#94A3B8] mt-0.5 block">
                              Created on {new Date(post.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex gap-1.5">
                              {post.logs.map((log, index) => (
                                <div
                                  key={index}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                    log.status === "PUBLISHED"
                                      ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/15"
                                      : log.status === "PUBLISHING"
                                      ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15 animate-pulse"
                                      : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/15"
                                  }`}
                                >
                                  {log.platform === "FACEBOOK" ? "FB" : "YT"}
                                </div>
                              ))}
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                post.status === "COMPLETED"
                                  ? "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20"
                                  : post.status === "SCHEDULED"
                                  ? "bg-[#6366F1]/10 text-[#818CF8] border-[#6366F1]/20"
                                  : post.status === "PUBLISHING"
                                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse"
                                  : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Links (1/3) */}
                <div className="glass-panel p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-[#F8FAFC] text-lg mb-4">Quick Links</h3>
                    <div className="space-y-2">
                      <Link
                        href="/create-post"
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-[#252B41] text-sm text-[#94A3B8] hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Video size={16} className="text-[#6366F1]" />
                        <span>Publish New Video</span>
                      </Link>
                      <Link
                        href="/accounts"
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-[#252B41] text-sm text-[#94A3B8] hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Database size={16} className="text-[#22D3EE]" />
                        <span>Connect Social Accounts</span>
                      </Link>
                      <Link
                        href="/history"
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-[#252B41] text-sm text-[#94A3B8] hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Clock size={16} className="text-[#818CF8]" />
                        <span>Track Schedules</span>
                      </Link>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[#252B41] mt-4 text-[11px] text-[#94A3B8]/60">
                    Need help setting up developer accounts? Read Meta or Google OAuth guidelines.
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
