"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import {
  Video, Upload, AlertTriangle, CheckCircle,
  Tv, Clock, Trash2, FileCheck,
} from "lucide-react";

// Custom Facebook icon (not available in lucide-react)
const FacebookIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "YOUTUBE";
  accountName: string;
  status: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState<("FACEBOOK" | "YOUTUBE")[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("socialsync_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    fetch(`${apiUrl}/api/oauth/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAccounts(data.filter((a) => a.status === "CONNECTED")); })
      .catch((err) => console.error("Error fetching accounts:", err));
  }, []);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const validExts = ["mp4", "mov", "webm"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type) && !validExts.includes(ext)) {
      setError("Invalid file format. Please upload an MP4, MOV, or WebM video."); return;
    }
    if (file.size > 100 * 1024 * 1024) { setError("File size exceeds the 100MB limit."); return; }
    setVideoFile(file);
  };

  const handlePlatformToggle = (platform: "FACEBOOK" | "YOUTUBE") => {
    setPlatforms(platforms.includes(platform) ? platforms.filter((p) => p !== platform) : [...platforms, platform]);
  };

  const removeFile = () => { setVideoFile(null); setUploadProgress(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!videoFile) { setError("Please select a video file to upload."); return; }
    if (platforms.length === 0) { setError("Please select at least one publishing platform."); return; }

    let scheduledAtIso = null;
    if (scheduled) {
      if (!scheduledDate || !scheduledTime) { setError("Please provide both a schedule date and time."); return; }
      const dateObj = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(dateObj.getTime())) { setError("Invalid date or time formatted."); return; }
      if (dateObj <= new Date()) { setError("Scheduled date must be in the future."); return; }
      scheduledAtIso = dateObj.toISOString();
    }

    setLoading(true);
    const token = localStorage.getItem("socialsync_token");
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("caption", caption);
    formData.append("platforms", JSON.stringify(platforms));
    if (scheduledAtIso) formData.append("scheduledAt", scheduledAtIso);

    const xhr = new XMLHttpRequest();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    xhr.open("POST", `${apiUrl}/api/posts`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const response = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        setSuccess(response.message || "Post successfully initialized!");
        setTitle(""); setDescription(""); setCaption(""); setPlatforms([]); setScheduled(false);
        setVideoFile(null); setUploadProgress(null);
        setTimeout(() => router.push("/history"), 1500);
      } else {
        setError(response.error || "Failed to publish post.");
      }
      setLoading(false);
    };
    xhr.onerror = () => { setError("Network error occurred during video upload."); setLoading(false); };
    xhr.send(formData);
  };

  const isYtConnected = accounts.some((a) => a.platform === "YOUTUBE");
  const isFbConnected = accounts.some((a) => a.platform === "FACEBOOK");

  return (
    <div className="flex min-h-screen bg-[#080A12]">
      <Sidebar />

      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#F8FAFC]">Create New Post</h1>
            <p className="text-[#94A3B8] mt-1">Upload your video file once and publish to Facebook Pages or YouTube Channels.</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-4 text-sm text-red-300">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444] mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/8 p-4 text-sm text-green-300">
              <CheckCircle size={18} className="shrink-0 text-[#22C55E] mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-3">

            {/* Left column (2/3) */}
            <div className="space-y-6 md:col-span-2">

              {/* Video Upload */}
              <div className="glass-panel p-6 border-[#6366F1]/10">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6366F1] mb-2.5">
                  Upload Video File (MP4, MOV, WebM — Max 100MB)
                </label>

                {!videoFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      dragOver
                        ? "border-[#6366F1] bg-[#6366F1]/8"
                        : "border-[#252B41] hover:border-[#6366F1]/40 hover:bg-white/5"
                    }`}
                  >
                    <Upload size={32} className="text-[#6366F1] mb-3 animate-bounce" />
                    <span className="font-semibold text-sm text-[#F8FAFC] mb-1">Drag & drop your video file here</span>
                    <span className="text-xs text-[#94A3B8]">or click to browse from files</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-[#252B41]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-[#6366F1]/10 flex items-center justify-center text-[#818CF8] shrink-0">
                        <FileCheck size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-[#F8FAFC] block truncate">{videoFile.name}</span>
                        <span className="text-xs text-[#94A3B8] block">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-2 text-[#EF4444] hover:text-red-300 hover:bg-red-950/20 rounded-lg border border-[#EF4444]/25 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                      <span>Uploading to server…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-[#111528] rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-100"
                        style={{ width: `${uploadProgress}%`, background: "linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Text Fields */}
              <div className="glass-panel p-6 space-y-4 border-[#6366F1]/10">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6366F1] mb-1.5">
                    Post Title (Required — YouTube title)
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter video title"
                    className="w-full glass-input rounded-lg text-sm py-2.5 text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6366F1] mb-1.5">
                    Facebook Caption
                  </label>
                  <textarea
                    rows={3}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write the caption that will appear as the post description on Facebook Pages…"
                    className="w-full glass-input rounded-lg text-sm py-2.5 text-[#F8FAFC] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6366F1] mb-1.5">
                    YouTube Description
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description text for YouTube video upload…"
                    className="w-full glass-input rounded-lg text-sm py-2.5 text-[#F8FAFC] resize-none"
                  />
                </div>
              </div>

            </div>

            {/* Right column (1/3) */}
            <div className="space-y-6">

              {/* Platform Selector */}
              <div className="glass-panel p-6 border-[#6366F1]/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#6366F1] mb-4">Select Platforms</h3>
                <div className="space-y-3">

                  {/* YouTube */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                      !isYtConnected
                        ? "opacity-50 cursor-not-allowed border-[#252B41] bg-black/10"
                        : platforms.includes("YOUTUBE")
                        ? "border-red-500 bg-red-950/10 text-white"
                        : "border-[#252B41] hover:border-[#6366F1]/40 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Tv size={18} className="text-red-500" />
                      <div className="text-left">
                        <span className="text-sm font-semibold block text-[#F8FAFC]">YouTube</span>
                        {!isYtConnected && <span className="text-[10px] text-[#EF4444]">Not Connected</span>}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isYtConnected}
                      checked={platforms.includes("YOUTUBE")}
                      onChange={() => handlePlatformToggle("YOUTUBE")}
                      className="accent-red-600 h-4 w-4 shrink-0 rounded"
                    />
                  </label>

                  {/* Facebook */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                      !isFbConnected
                        ? "opacity-50 cursor-not-allowed border-[#252B41] bg-black/10"
                        : platforms.includes("FACEBOOK")
                        ? "border-blue-500 bg-blue-950/10 text-white"
                        : "border-[#252B41] hover:border-[#6366F1]/40 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FacebookIcon size={18} className="text-blue-500" />
                      <div className="text-left">
                        <span className="text-sm font-semibold block text-[#F8FAFC]">Facebook Page</span>
                        {!isFbConnected && <span className="text-[10px] text-[#EF4444]">Not Connected</span>}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isFbConnected}
                      checked={platforms.includes("FACEBOOK")}
                      onChange={() => handlePlatformToggle("FACEBOOK")}
                      className="accent-blue-600 h-4 w-4 shrink-0 rounded"
                    />
                  </label>

                  {!isYtConnected && !isFbConnected && (
                    <p className="text-xs text-[#EF4444] font-medium mt-3">
                      Warning: You must link at least one account under{" "}
                      <Link href="/accounts" className="underline hover:text-red-300">Connected Accounts</Link>
                      {" "}before publishing.
                    </p>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="glass-panel p-6 border-[#6366F1]/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#6366F1]" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#6366F1]">Schedule Post</h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={scheduled}
                    onChange={() => setScheduled(!scheduled)}
                    className="accent-[#6366F1] h-4 w-4 cursor-pointer"
                  />
                </div>
                {scheduled && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                        Release Date
                      </label>
                      <input
                        type="date"
                        required={scheduled}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full glass-input rounded-lg text-xs py-2 text-[#F8FAFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                        Release Time (Local)
                      </label>
                      <input
                        type="time"
                        required={scheduled}
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full glass-input rounded-lg text-xs py-2 text-[#F8FAFC]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (!isYtConnected && !isFbConnected)}
                className="btn-cta w-full py-3 rounded-xl text-sm"
              >
                {loading ? "Processing Post…" : scheduled ? "Schedule Post Now" : "Publish Video Now"}
              </button>

            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
