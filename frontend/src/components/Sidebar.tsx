"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Video,
  Link2,
  History,
  Users,
  LogOut,
  User,
  ShieldCheck,
  Menu,
  X,
  Database,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR";
}

interface StorageStats {
  videoCount: number;
  totalGB: string;
  oldestExpiryDays: string | null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [storage, setStorage] = useState<StorageStats>({
    videoCount: 0,
    totalGB: "0.00",
    oldestExpiryDays: null,
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("socialsync_user");
    const token = localStorage.getItem("socialsync_token");
    if (!storedUser || !token) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(storedUser));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    fetch(`${apiUrl}/api/posts/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.clear();
          router.push("/login");
          return;
        }
        return res.json();
      })
      .then((data) => { if (data) setStorage(data); })
      .catch((err) => console.error("Error fetching stats:", err));
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard",          href: "/dashboard",   icon: LayoutDashboard },
    { name: "Create Post",        href: "/create-post", icon: Video },
    { name: "Connected Accounts", href: "/accounts",    icon: Link2 },
    { name: "Post History",       href: "/history",     icon: History },
  ];

  if (!user) return null;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-6">
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/logo.svg"
            alt="SocialSync Logo"
            className="h-9 w-9 rounded-xl shadow-lg shadow-[#6366F1]/30 object-contain"
          />
          <span
            className="text-xl font-extrabold tracking-wider bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #F8FAFC 0%, #818CF8 50%, #22D3EE 100%)" }}
          >
            SOCIALSYNC
          </span>
        </div>

        {/* User Card */}
        <div className="glass-panel p-4 mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6366F1]/15 border border-[#6366F1]/25 flex items-center justify-center text-[#818CF8]">
            <User size={18} />
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold truncate text-[#F8FAFC]">{user.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {user.role === "ADMIN" ? (
                <>
                  <ShieldCheck size={12} className="text-[#6366F1]" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#6366F1]">Admin</span>
                </>
              ) : (
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">Editor</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white shadow-md shadow-[#6366F1]/20"
                    : "text-[#94A3B8] hover:text-white hover:bg-white/5"
                }`}
                style={isActive ? { background: "linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)" } : {}}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} className={isActive ? "text-white" : "text-[#6366F1]/70"} />
                {item.name}
              </Link>
            );
          })}

          {/* Admin Section */}
          {user.role === "ADMIN" && (
            <div className="pt-4 mt-4 border-t border-[#252B41]">
              <span className="px-4 text-[10px] uppercase font-bold tracking-widest text-[#6366F1]/60 block mb-2">
                System
              </span>
              <Link
                href="/admin/users"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  pathname === "/admin/users"
                    ? "text-white shadow-md shadow-[#6366F1]/20"
                    : "text-[#94A3B8] hover:text-white hover:bg-white/5"
                }`}
                style={pathname === "/admin/users" ? { background: "linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)" } : {}}
                onClick={() => setIsOpen(false)}
              >
                <Users size={18} className={pathname === "/admin/users" ? "text-white" : "text-[#6366F1]/70"} />
                Team Management
              </Link>
            </div>
          )}
        </nav>
      </div>

      <div>
        {/* Storage panel */}
        <div className="glass-panel p-4 mb-4 border-[#6366F1]/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6366F1] mb-2">
            <Database size={14} />
            <span>Temp Storage Status</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>Media Count:</span>
              <span className="font-semibold text-[#F8FAFC]">{storage.videoCount} / ∞</span>
            </div>
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>Disk Space:</span>
              <span className="font-semibold text-[#F8FAFC]">{storage.totalGB} GB</span>
            </div>
            {storage.oldestExpiryDays && (
              <div className="mt-2 text-[10px] text-[#22D3EE] font-medium">
                Oldest media expires in {storage.oldestExpiryDays}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#EF4444] hover:text-red-300 hover:bg-red-950/20 transition-all duration-200"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar */}
      <header className="flex h-16 w-full items-center justify-between border-b border-[#252B41] bg-[#080A12]/80 px-6 backdrop-blur-md lg:hidden z-40 fixed top-0 left-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, #6366F1 0%, #22D3EE 100%)" }}
          >
            <span className="font-extrabold text-white">S</span>
          </div>
          <span className="text-lg font-bold tracking-wider text-[#F8FAFC]">SOCIALSYNC</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg border border-[#252B41]"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-[#252B41] bg-[#0B0E1C]/90 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 lg:static lg:flex lg:h-screen lg:flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
