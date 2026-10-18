import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  NotebookPen,
  Search,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";

export const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/chat", label: "Study Chat", icon: MessageCircle },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/notes", label: "Notes & Revision", icon: NotebookPen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/research", label: "Research", icon: Search },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/planner", label: "Planner", icon: CalendarDays },
];

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useSupabaseAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const name =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Student";
  const initial = name.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    await signOut();
    setLocation("/login");
  }

  return (
    <div className="min-h-screen bg-[#FDF3F3] text-[#724060]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#F8E7E7]/30 bg-[#724060] text-[#FDF3F3] shadow-[0_4px_25px_rgba(114,64,96,0.18)]">
        <div className="mx-auto flex h-16 max-w-[1520px] items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F8E7E7] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                <img src="/logo.svg" alt="StudentGPT" className="h-7 w-7 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-[17px] font-bold leading-tight tracking-tight text-[#FDF3F3]">
                  StudentGPT
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F8E7E7]">
                  Academic Studio
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links — All Pages */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Top navigation">
            {navigation.map(item => {
              const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all ${
                    active
                      ? "bg-[#F8E7E7] font-semibold text-[#724060] shadow-sm ring-1 ring-[#FDF3F3]/40"
                      : "text-[#F8E7E7] hover:bg-[#A070A1]/60 hover:text-[#FDF3F3]"
                  }`}
                >
                  <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-[#724060]" : "text-[#F8E7E7]"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions: Quick Action & User Profile */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/research"
              className="hidden items-center gap-1.5 rounded-xl bg-[#F8E7E7] px-3 py-1.5 text-[12px] font-semibold text-[#724060] shadow-sm transition hover:bg-white md:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#724060]" />
              <span>Research</span>
            </Link>

            {/* User Profile Pill & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 rounded-xl border border-[#A070A1]/60 bg-[#A070A1]/40 px-2.5 py-1.5 transition hover:bg-[#A070A1]/80"
                aria-expanded={userMenuOpen}
              >
                <Avatar className="h-7 w-7 border border-[#F8E7E7]/40">
                  <AvatarFallback className="bg-[#F8E7E7] text-[11px] font-bold text-[#724060]">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[100px] truncate text-[12px] font-medium text-[#FDF3F3] sm:inline-block">
                  {name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#F8E7E7]" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-2 text-[#724060] shadow-[0_12px_36px_rgba(114,64,96,0.22)]"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="border-b border-[#F8E7E7] px-3 py-2">
                    <p className="truncate text-[13px] font-semibold">{name}</p>
                    <p className="truncate text-[11px] text-[#A070A1]">{user?.email}</p>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-[#724060] transition hover:bg-[#F8E7E7]"
                    >
                      <LogOut className="h-3.5 w-3.5 text-[#A070A1]" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#A070A1] bg-[#A070A1]/50 text-[#F8E7E7] hover:bg-[#A070A1] lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="border-t border-[#A070A1] bg-[#724060] px-4 py-4 lg:hidden">
            <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {navigation.map(item => {
                const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium transition ${
                      active
                        ? "bg-[#F8E7E7] font-semibold text-[#724060]"
                        : "text-[#F8E7E7] hover:bg-[#A070A1]"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-[#A070A1] pt-3 text-[12px] text-[#F8E7E7]">
              <span>Logged in as <b>{name}</b></span>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 rounded-lg bg-[#A070A1] px-2.5 py-1 text-[11px] font-medium text-[#FDF3F3]"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area: Takes full width with comfortable padding */}
      <main className="min-h-[calc(100vh-64px)] w-full">
        {children}
      </main>

      {/* Mobile Quick-Bar (Small Screens) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-[#A070A1]/50 bg-[#724060]/95 px-2 text-[#FDF3F3] shadow-lg backdrop-blur lg:hidden"
        aria-label="Mobile bottom navigation"
      >
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location === "/" ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Home</span>
        </Link>
        <Link
          href="/chat"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/chat") ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Chat</span>
        </Link>
        <Link
          href="/documents"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/documents") ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Docs</span>
        </Link>
        <Link
          href="/notes"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/notes") ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <NotebookPen className="h-4 w-4" />
          <span>Notes</span>
        </Link>
        <Link
          href="/practice"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/practice") ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Practice</span>
        </Link>
        <Link
          href="/research"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/research") ? "text-[#F8E7E7] font-semibold" : "text-[#F8E7E7]/80"
          }`}
        >
          <Search className="h-4 w-4" />
          <span>Research</span>
        </Link>
      </nav>
    </div>
  );
}

export function AppLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FDF3F3]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-3 border-[#A070A1] border-t-transparent"
          aria-label="Loading StudentGPT"
        />
        <p className="text-[12px] font-medium uppercase tracking-widest text-[#724060]">
          Loading StudentGPT…
        </p>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
      <div className="rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-8 shadow-sm">
        <X className="mx-auto mb-4 h-9 w-9 text-[#A070A1]" />
        <h1 className="text-xl font-bold text-[#724060]">Authentication unavailable</h1>
        <p className="mt-2 text-sm text-[#A070A1]">{message}</p>
      </div>
    </div>
  );
}
