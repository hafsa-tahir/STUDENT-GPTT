import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  NotebookPen,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/research", label: "Research", icon: Search },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
];

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useSupabaseAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [islandExpanded, setIslandExpanded] = useState(false);

  const tracker = useStudyTimeTracker();

  const dashboardQuery = trpc.workspace.dashboard.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const minutesToday = Math.max(
    dashboardQuery.data?.sessionMinutesToday ?? 0,
    tracker.sessionMinutes
  );

  const name =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Student";
  const firstName = name.split(" ")[0] || name;
  const initial = name.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    await signOut();
    setLocation("/login");
  }

  const isActiveRoute = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FDF3F3] text-[#724060]">
      {/* Top Floating MicroKit Blur-Glide Navbar + Bencho Dynamic Island */}
      <header className="sticky top-0 z-50 w-full px-2.5 pt-2.5 pb-1.5 sm:px-6 sm:pt-3 sm:pb-2">
        <div className="mx-auto max-w-[1380px] rounded-2xl border border-[#724060]/12 bg-white/95 px-3.5 py-2.5 shadow-[0_8px_30px_rgba(114,64,96,0.08)] backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-2">
            {/* Original Brand Logo Restored */}
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl bg-[#F8E7E7] shadow-[0_2px_8px_rgba(114,64,96,0.12)]">
                <img
                  src="/logo.svg"
                  alt="StudentGPT"
                  className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[14px] sm:text-[15px] font-bold leading-none tracking-tight text-[#724060]">
                  StudentGPT
                </span>
                <span className="mt-0.5 text-[7.5px] sm:text-[8px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                  Academic Studio
                </span>
              </div>
            </Link>

            {/* MicroKit Blur-Glide Pill Navigation (Desktop) */}
            <nav
              aria-label="Primary navigation"
              className="hidden lg:flex items-center gap-0.5 rounded-full border border-[#724060]/10 bg-[#FDF3F3]/95 p-1 shadow-inner overflow-x-auto max-w-full"
            >
              {navigation.map(item => {
                const active = isActiveRoute(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? "text-white"
                        : "text-[#724060]/75 hover:text-[#2D1826]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="microkit-blur-glide-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-[#724060] shadow-[0_4px_14px_rgba(114,64,96,0.3)]"
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Side: Bencho Dynamic Island Timer + Well-Padded Profile Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIslandExpanded(prev => !prev)}
                title="Click to expand live study tracker"
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#2D1826] px-2.5 sm:px-3 py-1.5 text-[10.5px] sm:text-[11.5px] font-semibold text-[#FDF3F3] shadow-[0_6px_18px_rgba(45,24,38,0.2)] transition-all duration-300 hover:scale-[1.02]"
              >
                <span
                  className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full shrink-0 ${
                    tracker.isActive
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-[#A070A1]"
                  }`}
                />
                <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 shrink-0" />
                <span className="whitespace-nowrap">
                  {islandExpanded
                    ? `${minutesToday}m · ${tracker.isActive ? "Live" : "Idle"}`
                    : `${minutesToday}m`}
                  <span className="hidden sm:inline">
                    {islandExpanded ? "" : " Active"}
                  </span>
                </span>
                <span className="hidden sm:flex ml-0.5 items-center gap-0.5 h-3 shrink-0">
                  <span className="w-0.5 h-2.5 rounded-full bg-[#F8E7E7] animate-pulse" />
                  <span className="w-0.5 h-3.5 rounded-full bg-[#A070A1] animate-pulse [animation-delay:150ms]" />
                  <span className="w-0.5 h-2 rounded-full bg-[#F8E7E7] animate-pulse [animation-delay:300ms]" />
                </span>
              </button>

              {/* User Profile Pill — Properly Padded inside Header Boundary */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#724060] pl-1.5 pr-2.5 sm:pr-3.5 py-1 sm:py-1.5 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition"
                  aria-expanded={userMenuOpen}
                >
                  <Avatar className="h-6 w-6 border border-white/25 shrink-0">
                    <AvatarFallback className="bg-white/20 text-[11px] font-bold text-white">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[90px] truncate hidden md:inline-block">
                    {firstName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/85 shrink-0" />
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-11 z-50 w-60 rounded-2xl border border-[#F8E7E7] bg-white p-2.5 text-[#724060] shadow-[0_16px_40px_rgba(114,64,96,0.18)]"
                    onMouseLeave={() => setUserMenuOpen(false)}
                  >
                    <div className="border-b border-[#F8E7E7] px-3 py-2.5">
                      <p className="truncate text-[13px] font-bold text-[#2D1826]">
                        {name}
                      </p>
                      <p className="truncate text-[11px] text-[#A070A1]">
                        {user?.email}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#724060]">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{minutesToday}m active study today</span>
                      </div>
                    </div>
                    <div className="pt-1.5 space-y-0.5">
                      <Link
                        href="/subjects"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-[#724060] transition hover:bg-[#FDF3F3]"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-[#A070A1]" />
                        Subjects & Courses
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <LogOut className="h-3.5 w-3.5 text-rose-500" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile & Tablet Scrollable Pill Navigation (All 8 Pages Reachable) */}
          <nav
            aria-label="Mobile primary navigation"
            className="mt-2.5 flex lg:hidden items-center gap-1 overflow-x-auto rounded-xl bg-[#FDF3F3] p-1 border border-[#724060]/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {navigation.map(item => {
              const active = isActiveRoute(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                    active
                      ? "bg-[#724060] text-white shadow-xs"
                      : "text-[#724060]/80 hover:bg-[#F8E7E7]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area with Smooth Page Entrance Transition */}
      <motion.main
        key={location}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        className="min-h-[calc(100vh-80px)] w-full pb-24 lg:pb-8"
      >
        {children}
      </motion.main>

      {/* Mobile Bottom Dock — Scrollable All 8 Routes */}
      <nav
        className="fixed inset-x-2.5 bottom-2.5 z-40 flex h-14 items-center justify-between gap-1 overflow-x-auto rounded-2xl border border-[#724060]/15 bg-white/95 px-2 text-[#724060] shadow-[0_8px_30px_rgba(114,64,96,0.16)] backdrop-blur-md lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Mobile bottom navigation"
      >
        {navigation.map(item => {
          const active = isActiveRoute(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[9.5px] font-medium transition-colors ${
                active
                  ? "bg-[#FDF3F3] text-[#724060] font-bold"
                  : "text-[#724060]/65"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[54px]">{item.label}</span>
            </Link>
          );
        })}
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
        <p className="text-[13px] font-medium text-[#724060]">
          Loading your study workspace…
        </p>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
      <div className="rounded-2xl border border-[#F8E7E7] bg-white p-8 shadow-sm">
        <X className="mx-auto mb-4 h-9 w-9 text-[#A070A1]" />
        <h1 className="text-xl font-bold text-[#724060]">Authentication unavailable</h1>
        <p className="mt-2 text-sm text-[#A070A1]">{message}</p>
      </div>
    </div>
  );
}
