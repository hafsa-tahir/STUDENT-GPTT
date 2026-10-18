import { CardNav } from "@/components/CardNav";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  NotebookPen,
  Search,
  X,
  Zap
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";

const navigation = [
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

  // Live active study tracker
  const tracker = useStudyTimeTracker();

  // Query live dashboard minutes to show live tally
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
  const initial = name.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    await signOut();
    setLocation("/login");
  }

  const cardNavItems = [
    {
      label: "Study Spaces",
      description: "Your daily rhythm, focus sessions, and AI tutoring.",
      links: [
        { label: "Overview & Activity", href: "/" },
        { label: "Study Chat Assistant", href: "/chat" },
        { label: "Planner & Schedule", href: "/planner" }
      ]
    },
    {
      label: "Learning Engine",
      description: "Exhaustive notes, active recall, and course docs.",
      links: [
        { label: "Notes & Revision Guides", href: "/notes" },
        { label: "Practice Quizzes & Cards", href: "/practice" },
        { label: "Documents Library", href: "/documents" }
      ]
    },
    {
      label: "Academic Studio",
      description: "Deep research, scholarly papers, and curriculum.",
      links: [
        { label: "Research Paper Studio", href: "/research" },
        { label: "Subjects & Activity Hub", href: "/subjects" },
        { label: "Add New Subject", href: "/subjects?create=1" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FDF3F3] text-[#724060]">
      {/* Top React Bits <CardNav /> Integration */}
      <header className="sticky top-0 z-50 w-full px-3 py-3 sm:px-6 transition-all">
        <CardNav
          logo={
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F8E7E7] shadow-[0_2px_8px_rgba(114,64,96,0.12)]">
                <img src="/logo.svg" alt="StudentGPT" className="h-5 w-5 object-contain" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[15px] font-bold leading-none tracking-tight text-[#724060]">
                  StudentGPT
                </span>
                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                  Academic Studio
                </span>
              </div>
            </div>
          }
          logoHref="/"
          items={cardNavItems}
          cta={{
            element: (
              <div className="flex items-center gap-2">
                {/* Live Active Study Timer Pill */}
                <Link
                  href="/"
                  title={tracker.isActive ? "Actively tracking study time" : "Study timer ready"}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-2.5 py-1.5 text-[11px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      tracker.isActive
                        ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20"
                        : "bg-[#A070A1]"
                    }`}
                  />
                  <Clock3 className="h-3.5 w-3.5 text-[#A070A1]" />
                  <span>{minutesToday}m Today</span>
                </Link>

                {/* User Profile Pill & Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(prev => !prev)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#724060] px-3 py-1.5 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition"
                    aria-expanded={userMenuOpen}
                  >
                    <Avatar className="h-5 w-5 border border-white/20">
                      <AvatarFallback className="bg-white/20 text-[10px] font-bold text-white">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[75px] truncate hidden sm:inline-block">{name}</span>
                    <ChevronDown className="h-3 w-3 text-white/80" />
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-[#F8E7E7] bg-white p-2 text-[#724060] shadow-[0_16px_40px_rgba(114,64,96,0.18)]"
                      onMouseLeave={() => setUserMenuOpen(false)}
                    >
                      <div className="border-b border-[#F8E7E7] px-3 py-2">
                        <p className="truncate text-[13px] font-semibold">{name}</p>
                        <p className="truncate text-[11px] text-[#A070A1]">{user?.email}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#724060]">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{minutesToday}m active study today</span>
                        </div>
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-[#724060] transition hover:bg-[#FDF3F3]"
                        >
                          <LogOut className="h-3.5 w-3.5 text-[#A070A1]" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }}
          theme="academic"
          surface="glass"
          cardEffect="rise"
          openOn="click"
          maxWidth={960}
          linkComponent={Link}
        />
      </header>

      {/* Main Content Area */}
      <main className="min-h-[calc(100vh-80px)] w-full">
        {children}
      </main>

      {/* Mobile Quick-Bar (Small Screens for instant one-thumb navigation) */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-2xl border border-[#F8E7E7] bg-white/95 px-2 text-[#724060] shadow-[0_8px_30px_rgba(114,64,96,0.12)] backdrop-blur lg:hidden"
        aria-label="Mobile bottom navigation"
      >
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location === "/" ? "text-[#724060] font-bold" : "text-[#724060]/70"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Home</span>
        </Link>
        <Link
          href="/chat"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/chat") ? "text-[#724060] font-bold" : "text-[#724060]/70"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Chat</span>
        </Link>
        <Link
          href="/documents"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/documents") ? "text-[#724060] font-bold" : "text-[#724060]/70"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Docs</span>
        </Link>
        <Link
          href="/notes"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/notes") ? "text-[#724060] font-bold" : "text-[#724060]/70"
          }`}
        >
          <NotebookPen className="h-4 w-4" />
          <span>Notes</span>
        </Link>
        <Link
          href="/practice"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/practice") ? "text-[#724060] font-bold" : "text-[#724060]/70"
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Practice</span>
        </Link>
        <Link
          href="/research"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            location.startsWith("/research") ? "text-[#724060] font-bold" : "text-[#724060]/70"
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
      <div className="rounded-2xl border border-[#F8E7E7] bg-white p-8 shadow-sm">
        <X className="mx-auto mb-4 h-9 w-9 text-[#A070A1]" />
        <h1 className="text-xl font-bold text-[#724060]">Authentication unavailable</h1>
        <p className="mt-2 text-sm text-[#A070A1]">{message}</p>
      </div>
    </div>
  );
}
