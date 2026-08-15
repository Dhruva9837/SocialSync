"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function YouTubeCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    // Prevent double requests in React 18/19 Strict Mode
    if (sentRef.current) return;
    sentRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = localStorage.getItem("socialsync_token");

    if (!code) {
      setError("No authorization code found in the callback URL.");
      return;
    }

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    // Exchange code in the backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    fetch(`${apiUrl}/api/oauth/youtube/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to connect YouTube channel");
        }
        // Redirect to accounts on success
        router.replace("/accounts");
      })
      .catch((err) => {
        setError(err.message || "An unexpected error occurred during channel association.");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06040d] px-4">
      <div className="w-full max-w-md glass-panel p-8 text-center">
        {error ? (
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/20 border border-red-500/20 text-red-400 mb-4">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
            <p className="text-sm text-red-300 mb-6">{error}</p>
            <Link
              href="/accounts"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white font-medium transition-all"
            >
              <ArrowLeft size={16} />
              Return to Accounts
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Connecting YouTube Channel</h2>
            <p className="text-sm text-purple-300/70">
              Please wait while we associate your YouTube Channel access and refresh tokens...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
