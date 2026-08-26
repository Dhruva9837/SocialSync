"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import {
  Clock, CheckCircle, XCircle, AlertTriangle,
  Play, RotateCcw, ExternalLink, Video, X,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface PublishLog {
  id: string;
  platform: "FACEBOOK" | "YOUTUBE";
  status: "PUBLISHING" | "PUBLISHED" | "FAILED";
  platformPostId: string | null;
  platformUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
}

interface Media {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "ACTIVE" | "EXPIRED";
  expiresAt: string;
}

interface Post {
  id: string;
  title: string;
  description: string;
  caption: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "COMPLETED" | "FAILED";
  scheduledAt: string | null;
  createdAt: string;
  media: Media[];
  logs: PublishLog[];
}

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const fetchPosts = async () => {
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = getApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      setPosts(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleRetry = async (logId: string) => {
    setError(null); setFeedback(null);
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = getApiUrl();
    try {
      const res = await fetch(`${apiUrl}/api/posts/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger retry");
      setFeedback("Retry initiated in the background.");
      fetchPosts();
      setTimeout(fetchPosts, 5000);
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="flex min-h-screen bg-[#080A12]">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC]">Post History</h1>
            <p className="text-[#94A3B8] mt-1">Track the publishing status of all videos and manage retries.</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-4 text-sm text-red-300">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444] mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          {feedback && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#6366F1]/20 bg-[#6366F1]/8 p-4 text-sm text-[#818CF8]">
              <CheckCircle size={18} className="shrink-0 text-[#6366F1] mt-0.5" />
              <p>{feedback}</p>
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6366F1] border-t-transparent" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 glass-panel border-dashed border-[#252B41]">
              <p className="text-[#94A3B8] italic mb-4">No publishing history found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => {
                const activeMedia = post.media.find((m) => m.status === "ACTIVE");
                return (
                  <div key={post.id} className="glass-panel p-6 border-[#252B41] space-y-4">

                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#252B41] pb-4">
                      <div>
                        <h3 className="font-extrabold text-[#F8FAFC] text-lg">{post.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#94A3B8] mt-1">
                          <span>Uploaded: {new Date(post.createdAt).toLocaleString()}</span>
                          {post.scheduledAt && (
                            <span className="flex items-center gap-1 text-[#818CF8] font-medium">
                              <Clock size={12} />
                              Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {activeMedia && (
                          <button
                            onClick={() => { setPreviewPostId(post.id); setPreviewTitle(post.title); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818CF8] text-xs font-semibold hover:bg-[#6366F1]/20 transition-all"
                          >
                            <Play size={12} fill="currentColor" />
                            Preview Video
                          </button>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
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

                    {/* Media Expiry */}
                    <div className="text-xs">
                      {activeMedia ? (
                        <p className="text-[#94A3B8]">
                          Video file: <span className="text-[#F8FAFC] font-medium">{activeMedia.fileName}</span>{" "}
                          ({(activeMedia.fileSize / (1024 * 1024)).toFixed(2)} MB) —{" "}
                          <span className="text-[#22D3EE] font-medium">
                            Expires in {Math.ceil((new Date(activeMedia.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                          </span>
                        </p>
                      ) : (
                        <p className="text-[#EF4444] font-medium flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          Media expired (Video file permanently cleaned up. Published links remain unaffected).
                        </p>
                      )}
                    </div>

                    {/* Platform Logs */}
                    <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-2">
                      {post.logs.map((log) => (
                        <div key={log.id} className="p-4 rounded-xl bg-white/5 border border-[#252B41] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                                {log.platform}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  log.status === "PUBLISHED"
                                    ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/15"
                                    : log.status === "PUBLISHING"
                                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/15 animate-pulse"
                                    : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/15"
                                }`}
                              >
                                {log.status}
                              </span>
                            </div>

                            {log.errorMessage && (
                              <p className="text-xs text-red-300/80 mb-3 bg-red-950/10 border border-[#EF4444]/10 p-2.5 rounded-lg font-mono leading-relaxed">
                                {log.errorMessage}
                              </p>
                            )}
                            {log.publishedAt && (
                              <p className="text-[10px] text-[#94A3B8] mb-2">
                                Published at: {new Date(log.publishedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 mt-2">
                            {log.platformUrl && (
                              <a
                                href={log.platformUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#818CF8] border border-[#6366F1]/20 rounded-lg text-xs font-semibold transition-all"
                              >
                                View Post
                                <ExternalLink size={12} />
                              </a>
                            )}
                            {log.status === "FAILED" && activeMedia && (
                              <button
                                onClick={() => handleRetry(log.id)}
                                className="btn-cta flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold"
                              >
                                <RotateCcw size={12} />
                                Retry Publish
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Video Preview Modal */}
      {previewPostId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl glass-panel border-[#252B41] overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b border-[#252B41] bg-black/25">
              <div className="flex items-center gap-2">
                <Video className="text-[#6366F1]" size={18} />
                <span className="font-bold text-[#F8FAFC] text-sm truncate max-w-100">{previewTitle}</span>
              </div>
              <button
                onClick={() => { setPreviewPostId(null); setPreviewTitle(""); }}
                className="p-1.5 hover:bg-white/5 text-[#94A3B8] hover:text-white rounded-lg border border-[#252B41]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                src={`${getApiUrl()}/api/posts/media/${previewPostId}`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
