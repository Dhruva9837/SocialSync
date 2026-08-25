"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertTriangle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("socialsync_token")) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");

      localStorage.setItem("socialsync_token", data.token);
      localStorage.setItem("socialsync_user", JSON.stringify(data.user));
      router.replace("/dashboard");
    } catch (err: any) {
      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        setError("Unable to connect to backend server. Please verify your Render backend URL is set in Vercel (NEXT_PUBLIC_API_URL).");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#080A12] px-4 overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6366F1]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-72 w-72 translate-x-1/2 translate-y-1/2 rounded-full bg-[#22D3EE]/10 blur-3xl" />

      <div className="w-full max-w-md glass-panel p-8 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-[#6366F1]/30 mb-4"
               style={{ background: "linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)" }}>
            <span className="font-extrabold text-2xl text-white">S</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">Welcome to SocialSync</h1>
          <p className="text-sm text-[#94A3B8] mt-1">Sign in to publish posts and connect accounts</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/8 p-4 text-sm text-red-300">
            <AlertTriangle size={18} className="shrink-0 text-[#EF4444] mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
              Email Address
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 z-10">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                style={{ paddingLeft: "2.75rem", paddingRight: "1rem" }}
                className="w-full glass-input rounded-xl text-sm py-3 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
              Password
            </label>
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 z-10">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                className="w-full glass-input rounded-xl text-sm py-3 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10 p-1 rounded-md"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-cta w-full py-3 mt-3 rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
