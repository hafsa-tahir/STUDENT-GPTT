import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { BookOpen, CalendarDays, ChevronDown, FileText, LayoutDashboard, LogOut, MessageCircle, NotebookPen, PanelLeftClose, PanelLeftOpen, Plus, Search, X, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/chat", label: "Study chat", icon: MessageCircle },
  { href: "/research", label: "Research", icon: Search },
  { href: "/notes", label: "Notes & revision", icon: NotebookPen },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/practice", label: "Practice", icon: Zap },
];

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useSupabaseAuth();
  const [menuOpen, setMenuOpen] = useState(false); const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split("@")[0] || "Student";
  const initial = name.slice(0, 1).toUpperCase();

  async function handleSignOut() {
    await signOut();
    setLocation("/login");
  }

  return (
    <div className="min-h-screen bg-[#FDF3F3] text-[#724060]">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden bg-[#724060] py-5 text-[#FDF3F3] transition-[width,padding] duration-200 lg:flex ${sidebarCollapsed ? "w-[88px] px-3" : "w-[280px] px-4"}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40" style={{ background: "radial-gradient(circle at 15% 0%, #A070A1 0, transparent 48%), radial-gradient(circle at 90% 8%, #F8E7E7 0, transparent 38%)" }} />
        <div className={`relative mb-9 flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3 px-2"}`}><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#F8E7E7] shadow-[0_12px_28px_rgba(114,64,96,.24)]"><img src="/manus-storage/studentgpt-logo-option-1_b720cde2.png" alt="StudentGPT" className="h-8 w-8 object-contain" /></div>{!sidebarCollapsed && <span><span className="block text-[18px] font-semibold tracking-[-.04em]">StudentGPT</span><span className="block text-[10px] font-semibold uppercase tracking-[.15em] text-[#F8E7E7]">Academic studio</span></span>}</Link><button type="button" onClick={() => setSidebarCollapsed(value => !value)} className={`grid h-8 w-8 place-items-center rounded-lg text-[#F8E7E7] hover:bg-[#A070A1] hover:text-[#FDF3F3] ${sidebarCollapsed ? "absolute -right-1 top-11" : "ml-auto"}`} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button></div>
        <Button onClick={() => setLocation("/research")} title="Start a research line" className={`relative mb-8 h-11 w-full rounded-xl bg-[#F8E7E7] text-[13px] font-semibold text-[#724060] shadow-[0_8px_22px_rgba(114,64,96,.16)] hover:bg-[#FDF3F3] ${sidebarCollapsed ? "justify-center px-0" : "justify-start gap-2 px-3.5"}`}><Plus className="h-4 w-4" />{!sidebarCollapsed && " Start a research line"}</Button>
        <nav className="relative space-y-1" aria-label="Primary navigation">{!sidebarCollapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#F8E7E7]">Workspace</p>}{navigation.slice(0, 4).map(item => { const active = location === item.href; return <Link key={item.href} href={item.href} title={item.label} className={`flex h-10 items-center rounded-xl text-[13px] font-medium transition-all ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[#F8E7E7] text-[#724060] shadow-[inset_0_1px_0_#FDF3F3]" : "text-[#F8E7E7] hover:bg-[#A070A1] hover:text-[#FDF3F3]"}`}><item.icon className={`h-4 w-4 shrink-0 ${active ? "text-[#724060]" : ""}`} />{!sidebarCollapsed && item.label}</Link>; })}{!sidebarCollapsed && <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#F8E7E7]">Learning tools</p>}{sidebarCollapsed && <div className="my-4 border-t border-[#A070A1]" />}{navigation.slice(4).map(item => { const active = location === item.href; return <Link key={item.href} href={item.href} title={item.label} className={`flex h-10 items-center rounded-xl text-[13px] font-medium transition-all ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[#F8E7E7] text-[#724060] shadow-[inset_0_1px_0_#FDF3F3]" : "text-[#F8E7E7] hover:bg-[#A070A1] hover:text-[#FDF3F3]"}`}><item.icon className={`h-4 w-4 shrink-0 ${active ? "text-[#724060]" : ""}`} />{!sidebarCollapsed && item.label}</Link>; })}</nav>
        <div className={`relative mt-auto border border-[#A070A1] bg-[#A070A1] p-2 ${sidebarCollapsed ? "rounded-xl" : "rounded-2xl"}`}><button onClick={() => setMenuOpen(open => !open)} className={`flex w-full items-center rounded-xl px-2 py-2 text-left hover:bg-[#724060] ${sidebarCollapsed ? "justify-center" : "gap-3"}`} aria-expanded={menuOpen}><Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-[#F8E7E7] text-xs font-semibold text-[#724060]">{initial}</AvatarFallback></Avatar>{!sidebarCollapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-[#FDF3F3]">{name}</span><span className="block truncate text-[11px] text-[#F8E7E7]">{user?.email}</span></span><ChevronDown className="h-3.5 w-3.5 text-[#F8E7E7]" /></>}</button>{menuOpen && <div className={`mt-2 rounded-xl bg-[#F8E7E7] p-1 ${sidebarCollapsed ? "absolute bottom-0 left-[76px] w-36" : ""}`}><button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#724060] hover:bg-[#FDF3F3]"><LogOut className="h-3.5 w-3.5" /> Sign out</button></div>}</div>
      </aside>
      <main className={`min-h-screen pb-24 transition-[margin] duration-200 lg:pb-0 ${sidebarCollapsed ? "lg:ml-[88px]" : "lg:ml-[280px]"}`}>{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-center justify-around border-t border-[#A070A1] bg-[#724060] px-2 text-[#FDF3F3] backdrop-blur lg:hidden" aria-label="Mobile navigation"><Link href="/" className={`flex flex-col items-center gap-1 text-[10px] font-medium ${location === "/" ? "text-[#FDF3F3]" : "text-[#F8E7E7]"}`} aria-label="StudentGPT home"><span className="grid h-[19px] w-[19px] place-items-center overflow-hidden rounded-md bg-[#F8E7E7]"><img src="/manus-storage/studentgpt-logo-option-1_b720cde2.png" alt="" className="h-[17px] w-[17px] object-contain" /></span>Home</Link>{navigation.slice(1, 5).map(item => { const active = location === item.href; return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 text-[10px] font-medium ${active ? "text-[#FDF3F3]" : "text-[#F8E7E7]"}`}><item.icon className="h-[19px] w-[19px]" />{item.label}</Link>; })}<button onClick={handleSignOut} className="flex flex-col items-center gap-1 text-[10px] font-medium text-[#F8E7E7]"><LogOut className="h-[19px] w-[19px]" />Account</button></nav>
    </div>
  );
}

export function AppLoading() { return <div className="grid min-h-screen place-items-center bg-[#F8E7E7]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A070A1] border-t-[#A070A1]" aria-label="Loading StudentGPT" /></div>; }

export function AuthError({ message }: { message: string }) { return <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center"><div><X className="mx-auto mb-4 h-8 w-8 text-[#A070A1]" /><h1 className="text-xl font-semibold">Authentication unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></div>; }
