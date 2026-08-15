import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "SocialSync | Cross-Platform Video Publisher",
  description: "Upload once, publish everywhere. Post to Facebook Pages and YouTube Channels automatically with zero repetitive work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark antialiased`}>
      <body className="font-sans min-h-screen bg-[#06040d] text-[#f3f1fe] selection:bg-[#9d4edd] selection:text-white">
        {children}
      </body>
    </html>
  );
}
