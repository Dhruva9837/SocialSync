/**
 * Returns clean API base URL without trailing slash
 */
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  // Automatic fallback for production domain if NEXT_PUBLIC_API_URL was not baked into Vercel build
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "https://socialsync-tckf.onrender.com";
  }

  return "http://localhost:5000";
}
