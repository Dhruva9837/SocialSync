/**
 * Returns clean API base URL without trailing slash
 */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return url.replace(/\/+$/, "");
}
