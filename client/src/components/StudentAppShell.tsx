import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const activeNavItem =
    navigation.find(item => isActiveRoute(item.href)) ?? navigation[0];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FDF3F3] text-[#724060]">
      {/* Top Floating Navbar (Single Clean Row on Mobile & Desktop) */}
      <header className="sticky top-0 z-50 w-full px-3 pt-2.5 pb-1.5 sm:px-6 sm:pt-3 sm:pb-2">
        <div className="mx-auto max-w-[1380px] rounded-2xl border border-[#724060]/12 bg-white/95 px-3.5 py-2.5 shadow-[0_8px_30px_rgba(114,64,96,0.08)] backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-2">
            {/* Brand Logo */}
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 shrink-0"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F8E7E7] shadow-[0_2px_8px_rgba(114,64,96,0.12)]">
                <img
                  src="/logo.svg"
                  alt="StudentGPT"
                  className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[14.5px] sm:text-[15px] font-bold leading-none tracking-tight text-[#724060]">
                  StudentGPT
                </span>
                <span className="mt-0.5 text-[7.5px] sm:text-[8px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                  Academic Studio
                </span>
              </div>
            </Link>

            {/* MicroKit Blur-Glide Pill Navigation (Desktop lg+) */}
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

            {/* Right Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Bencho Dynamic Island Timer */}
              <button
                type="button"
                onClick={() => setIslandExpanded(prev => !prev)}
                title="Click to expand live study tracker"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2D1826] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[11.5px] font-semibold text-[#FDF3F3] shadow-[0_6px_18px_rgba(45,24,38,0.2)] transition-all duration-300 hover:scale-[1.02]"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    tracker.isActive
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-[#A070A1]"
                  }`}
                />
                <Flame className="h-3.5 w-3.5 text-amber-300 shrink-0" />
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

              {/* Desktop User Profile Pill (lg+) */}
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(prev => !prev)}
                  className="flex items-center gap-2 rounded-full bg-[#724060] pl-1.5 pr-3.5 py-1.5 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition"
                  aria-expanded={userMenuOpen}
                >
                  <Avatar className="h-6 w-6 border border-white/25 shrink-0">
                    <AvatarFallback className="bg-white/20 text-[11px] font-bold text-white">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[90px] truncate hidden xl:inline-block">
                    {firstName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/85 shrink-0" />
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-[#F8E7E7] bg-white p-2.5 text-[#724060] shadow-[0_16px_40px_rgba(114,64,96,0.18)]"
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

              {/* Mobile & Tablet Menu Button (< lg) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
                className="inline-flex lg:hidden items-center gap-2 rounded-full bg-[#724060] pl-3 pr-2.5 py-1.5 text-[12px] font-bold text-white shadow-xs transition active:scale-95"
              >
                <span>{activeNavItem.label}</span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20">
                  {mobileMenuOpen ? (
                    <X className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Menu className="h-3.5 w-3.5 text-white" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Clean Bento Dropdown Menu (< lg) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden lg:hidden"
              >
                <div className="mt-3 border-t border-[#F8E7E7] pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {navigation.map(item => {
                      const active = isActiveRoute(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition ${
                            active
                              ? "bg-[#724060] text-white shadow-xs"
                              : "bg-[#FDF3F3] text-[#2D1826] hover:bg-[#F8E7E7]"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              active ? "text-white" : "text-[#724060]"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Mobile Account Footer Bar */}
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#FDF3F3] px-3.5 py-2.5 border border-[#F8E7E7]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-7 w-7 border border-[#724060]/20 shrink-0">
                        <AvatarFallback className="bg-[#724060] text-[11px] font-bold text-white">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-bold text-[#2D1826]">
                          {name}
                        </p>
                        <p className="truncate text-[10.5px] text-[#724060]/75">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-bold text-rose-700 shadow-2xs border border-rose-100 hover:bg-rose-50"
                    >
                      <LogOut className="h-3.5 w-3.5 text-rose-500" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Area with Smooth Page Entrance Transition */}
      <motion.main
        key={location}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        className="min-h-[calc(100vh-80px)] w-full max-w-full overflow-x-hidden pb-10"
      >
        {children}
      </motion.main>
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
