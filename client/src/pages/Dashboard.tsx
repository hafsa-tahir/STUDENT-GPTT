import { DashboardSessionSummary } from "@/components/DashboardSessionSummary";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Compass,
  FileText,
  Flame,
  Loader2,
  MessageCircle,
  NotebookPen,
  Plus,
  Sparkles,
  UploadCloud,
  Volume2,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const DEMO_TASKS = [
  { id: -1, title: "Upload & synthesize lecture PDF", done: true },
  { id: -2, title: "Review 3D flashcards & take quiz", done: false },
];

export default function Dashboard() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [demoTaskState, setDemoTaskState] = useState<Record<number, boolean>>({
    [-1]: true,
    [-2]: false,
  });
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const dashboard = trpc.workspace.dashboard.useQuery(undefined, {
    enabled: Boolean(user),
    retry: 1,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const notesQuery = trpc.notes.list.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const researchQuery = trpc.research.list.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const completeItemMutation = trpc.planner.setItemCompletion.useMutation({
    onSuccess: () => {
      utils.workspace.dashboard.invalidate();
      utils.planner.list.invalidate();
    },
  });

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  const userDisplayName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Student";

  const data = dashboard.data || {
    profile: {
      id: 1,
      userId: 1,
      preferredName: userDisplayName,
      studyLevel: "University",
      primaryExamGoal: null,
      timezone: "UTC",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    subjects: [],
    todayItems: [],
    upcomingPlans: [],
    activity: [],
    recentSessions: [],
    sessionMinutesToday: 0,
  };

  const name =
    data.profile?.preferredName ||
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    "Student";

  const demoDoneCount = Object.values(demoTaskState).filter(Boolean).length;
  const completedCount = data.todayItems.filter(item => item.completedAt).length;
  const completion = data.todayItems.length
    ? Math.round((completedCount / data.todayItems.length) * 100)
    : data.sessionMinutesToday > 0
    ? Math.min(100, Math.round((data.sessionMinutesToday / 30) * 100))
    : Math.round((demoDoneCount / DEMO_TASKS.length) * 100);

  // Determine primary resume item
  const latestNote = notesQuery.data?.[0];
  const latestResearch = researchQuery.data?.[0];
  const todayFocus = data.todayItems.find(item => !item.completedAt) || data.todayItems[0];
  const nextExamPlan = data.upcomingPlans.find(p => p.examDate);
  const daysToExam = nextExamPlan?.examDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(nextExamPlan.examDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const resumeTitle = latestNote
    ? latestNote.title
    : todayFocus
    ? todayFocus.title
    : latestResearch
    ? latestResearch.title
    : "Start your first AI study session";

  const resumeSubtitle = latestNote
    ? `Study Notes · ${daysToExam !== null ? `Exam in ${daysToExam} days` : "Ready to review"}`
    : todayFocus
    ? `${todayFocus.planTitle} · ${todayFocus.estimatedMinutes}m planned`
    : `${data.subjects.length} subjects · ${data.sessionMinutesToday}m studied today`;

  const resumeHref = latestNote
    ? "/notes"
    : todayFocus
    ? "/planner"
    : latestResearch
    ? "/research"
    : "/documents";

  // Direct PDF Upload handler for the 3D Dropzone card
  async function handlePdfUpload(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadNotice("Please select a valid PDF file.");
      return;
    }
    setUploadingPdf(true);
    setUploadNotice(null);
    try {
      const token = getSupabaseAccessToken();
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "x-file-name": encodeURIComponent(file.name),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      await utils.documents.list.invalidate();
      await utils.workspace.dashboard.invalidate();
      setUploadNotice(`Uploaded "${file.name}"! Opening Documents…`);
      setTimeout(() => setLocation("/documents"), 900);
    } catch (e) {
      setUploadNotice(
        e instanceof Error ? e.message : "Could not upload PDF. Opening Documents…"
      );
    } finally {
      setUploadingPdf(false);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handlePdfUpload(file);
  }

  function onDropPdf(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingPdf(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file);
  }

  // Compute 7-day trend for compact weekly bar
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekTrend = daysOfWeek.map((dayName, index) => {
    const dayStart = new Date(mondayDate);
    dayStart.setDate(mondayDate.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const isToday =
      today.getFullYear() === dayStart.getFullYear() &&
      today.getMonth() === dayStart.getMonth() &&
      today.getDate() === dayStart.getDate();

    let minutes = (data.recentSessions || [])
      .filter(s => {
        const d = new Date(s.startedAt);
        return d >= dayStart && d < dayEnd;
      })
      .reduce((sum, s) => sum + (s.minutesStudied || 0), 0);

    if (isToday && data.sessionMinutesToday > minutes) {
      minutes = data.sessionMinutesToday;
    }
    return { dayName, minutes, isToday };
  });
  const maxWeekMinutes = Math.max(...weekTrend.map(d => d.minutes), 30);

  // SVG Ring geometry (r = 42 -> circumference = 263.89)
  const ringCircumference = 263.89;
  const ringOffset = ringCircumference * (1 - Math.min(100, completion) / 100);

  return (
    <StudentAppShell>
      <div className="min-h-screen bg-[#FDF3F3] px-4 py-4 sm:px-7 sm:py-6 lg:px-9">
        <div className="mx-auto max-w-[1380px] space-y-5">
          {/* Compact Greeting + Quick Action Pills */}
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[#2D1826] sm:text-[34px]">
                Welcome back, {name}
              </h1>
              <p className="mt-0.5 text-[13.5px] text-[#724060]/80">
                Pick any study studio below or drop a lecture PDF to synthesize notes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocation("/chat")}
                className="inline-flex items-center gap-2 rounded-full border border-[#724060]/15 bg-white px-4 py-2 text-[13px] font-semibold text-[#2D1826] shadow-2xs transition hover:bg-[#F8E7E7] cursor-pointer"
              >
                <MessageCircle className="h-4 w-4 text-[#724060]" />
                Ask AI Tutor
              </button>
              <button
                type="button"
                onClick={() => setLocation("/subjects?create=1")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#724060] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(114,64,96,0.22)] transition hover:bg-[#5a334c] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Subject
              </button>
            </div>
          </section>

          {/* TOP HERO BENTO ROW: MicroKit Progress Ring Card (8 cols) + 3D PDF Folder Dropzone (4 cols) */}
          <section className="grid grid-cols-12 gap-4">
            {/* Hero Left: Glassmorphic Plum Resume Card + MicroKit Animated Progress Ring */}
            <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] p-6 sm:p-7 text-white shadow-[0_20px_45px_rgba(114,64,96,0.24)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
              <div className="pointer-events-none absolute right-24 -bottom-16 h-44 w-44 rounded-full bg-[#A070A1]/25 blur-xl" />

              {/* Left: Animated SVG Progress Ring with Checkmark Badge */}
              <div className="flex items-center gap-5 sm:gap-6 z-10 w-full sm:w-auto flex-1 min-w-0">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="rgba(255,255,255,0.16)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#F8E7E7"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_rgba(248,231,231,0.55)]"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="mb-0.5 grid h-5 w-5 place-items-center rounded-full bg-[#F8E7E7] text-[#724060] shadow-xs">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                    <span className="text-[21px] font-bold leading-none">
                      {completion}%
                    </span>
                    <span className="mt-0.5 text-[9.5px] font-medium text-[#F8E7E7]/80">
                      Daily Goal
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-[#F8E7E7] backdrop-blur-xs">
                    <Sparkles className="h-3 w-3" />
                    <span>Continue where you left off</span>
                  </div>
                  <h2 className="mt-2.5 truncate text-[22px] sm:text-[26px] font-bold tracking-tight text-white">
                    {resumeTitle}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#F8E7E7]/85">
                    {resumeSubtitle}
                  </p>

                  {/* MicroKit Glow-Arrow Button + Audio Lecture Pill */}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setLocation(resumeHref)}
                      className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-[#2D1826] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all hover:bg-[#FDF3F3] hover:pr-6 cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4 text-[#724060] transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/notes")}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3.5 py-2 text-[12px] font-semibold text-[#FDF3F3] backdrop-blur-md transition hover:bg-white/20 cursor-pointer"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-[#F8E7E7]" />
                      <span>Play Audio Lecture</span>
                      <span className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 h-2 bg-[#F8E7E7] rounded-full animate-pulse" />
                        <span className="w-0.5 h-3 bg-[#F8E7E7] rounded-full animate-pulse" />
                        <span className="w-0.5 h-1.5 bg-[#F8E7E7] rounded-full animate-pulse" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Right: 3D Folder Illustration Image PDF Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDraggingPdf(true);
              }}
              onDragLeave={() => setIsDraggingPdf(false)}
              onDrop={onDropPdf}
              onClick={() => fileInputRef.current?.click()}
              className={`group col-span-12 lg:col-span-4 relative cursor-pointer overflow-hidden rounded-[28px] border-2 border-dashed p-4 transition-all duration-300 flex flex-col items-center justify-center text-center shadow-[0_12px_30px_rgba(114,64,96,0.07)] ${
                isDraggingPdf
                  ? "border-[#724060] bg-[#F8E7E7] scale-[1.01]"
                  : "border-[#724060]/25 bg-white hover:border-[#724060] hover:bg-[#FDF3F3]/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={onFileInputChange}
                className="hidden"
              />

              <div className="overflow-hidden rounded-2xl bg-[#FDF3F3] mb-2.5">
                <img
                  src="/illustrations/pdf-folder-3d.jpg"
                  alt="Drop Lecture PDF 3D Folder"
                  className="h-28 w-48 object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <h3 className="text-[16px] font-bold text-[#2D1826] flex items-center gap-1.5">
                {uploadingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#724060]" />
                    <span>Uploading PDF…</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4 text-[#724060]" />
                    <span>Drop Lecture PDF</span>
                  </>
                )}
              </h3>
              <p className="mt-0.5 text-[11.5px] text-[#724060]/75">
                {uploadNotice || "Click or drag a course PDF to generate notes & quizzes"}
              </p>
            </div>
          </section>

          {/* FEATURE SHOWCASE ROW 1: 4 Real 3D Visual Feature Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* FEATURE 1: AI Note Maker (3D Diagram Image: Lecture PDF -> Formula Study Note + Sticky Note) */}
            <div
              onMouseEnter={() => setHoveredCard(0)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => setLocation("/notes")}
              className="group relative cursor-pointer rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              {hoveredCard === 0 && (
                <motion.div
                  layoutId="dashboard-hover-glide"
                  className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-bold text-[#2D1826]">
                      AI Note Maker
                    </h3>
                    <p className="text-[11.5px] text-[#724060]/70">
                      PDF → Formulas, Sticky Notes & Audio
                    </p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <NotebookPen className="h-4 w-4" />
                  </span>
                </div>

                {/* 3D Visual Illustration Image */}
                <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]">
                  <img
                    src="/illustrations/ai-notes-diagram.jpg"
                    alt="AI Note Maker: Lecture PDF to Formula Study Notes"
                    className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[12.5px] font-bold text-[#724060]">
                <span>
                  {notesQuery.data?.length
                    ? `${notesQuery.data.length} saved notes · Open Studio`
                    : "Synthesize PDF or Topic"}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* FEATURE 2: 3D Flashcards & Quiz Studio (3D Fanned Card Deck + Quiz Image) */}
            <div
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => setLocation("/practice")}
              className="group relative cursor-pointer rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              {hoveredCard === 1 && (
                <motion.div
                  layoutId="dashboard-hover-glide"
                  className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-bold text-[#2D1826]">
                      3D Flashcard Stack
                    </h3>
                    <p className="text-[11.5px] text-[#724060]/70">
                      Active Recall Deck & A/B/C Quizzes
                    </p>
                  </div>
                  <span className="rounded-full bg-[#2D1826] px-2.5 py-1 text-[10.5px] font-bold text-white">
                    Practice →
                  </span>
                </div>

                {/* 3D Visual Illustration Image */}
                <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]">
                  <img
                    src="/illustrations/flashcards-quiz-3d.jpg"
                    alt="3D Flashcard Stack and Multiple Choice Quiz"
                    className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Spaced Repetition Rating Pills */}
              <div
                className="mt-4 flex items-center gap-1.5"
                onClick={e => {
                  e.stopPropagation();
                  setLocation("/practice");
                }}
              >
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[#2D1826] py-1.5 text-[11.5px] font-bold text-white transition hover:bg-[#724060] cursor-pointer"
                >
                  Easy
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-[#724060]/20 bg-[#FDF3F3] py-1.5 text-[11.5px] font-bold text-[#2D1826] transition hover:bg-[#F8E7E7] cursor-pointer"
                >
                  Good
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-[#724060]/20 bg-white py-1.5 text-[11.5px] font-bold text-[#724060] transition hover:bg-[#FDF3F3] cursor-pointer"
                >
                  Again
                </button>
              </div>
            </div>

            {/* FEATURE 3: Research Studio (3D Mind-Map Paper, Citation & Videos Image) */}
            <div
              onMouseEnter={() => setHoveredCard(2)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => setLocation("/research")}
              className="group relative cursor-pointer rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              {hoveredCard === 2 && (
                <motion.div
                  layoutId="dashboard-hover-glide"
                  className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-bold text-[#2D1826]">
                      Research Studio
                    </h3>
                    <p className="text-[11.5px] text-[#724060]/70">
                      Topic → Paper, Citations & Videos
                    </p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <Compass className="h-4 w-4" />
                  </span>
                </div>

                {/* 3D Visual Illustration Image */}
                <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]">
                  <img
                    src="/illustrations/research-canvas-diagram.jpg"
                    alt="Research Studio Paper, Citation and Videos Mind-Map"
                    className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              {/* MicroKit Aurora Glow Button */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLocation("/research");
                }}
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[#2D1826] via-[#724060] to-[#4A263D] py-2 text-[12.5px] font-bold text-white shadow-[0_6px_20px_rgba(114,64,96,0.32)] transition hover:opacity-95 cursor-pointer"
              >
                {latestResearch ? "Export Research Paper" : "Build Research Paper"}
              </button>
            </div>

            {/* FEATURE 4: Today's Tasks & Exam Planner (3D Planner Roadmap Image + Interactive Checkboxes) */}
            <div
              onMouseEnter={() => setHoveredCard(3)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group relative rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              {hoveredCard === 3 && (
                <motion.div
                  layoutId="dashboard-hover-glide"
                  className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-bold text-[#2D1826]">
                      Today’s Tasks
                    </h3>
                    <p className="text-[11.5px] text-[#724060]/70">
                      Exam Countdown & Daily Roadmap
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/planner")}
                    className="rounded-full bg-[#2D1826] px-2.5 py-1 text-[10px] font-bold text-white cursor-pointer"
                  >
                    {daysToExam !== null ? `${daysToExam}d Left` : "Planner →"}
                  </button>
                </div>

                {/* 3D Planner Visual Illustration */}
                <div
                  onClick={() => setLocation("/planner")}
                  className="mt-3.5 cursor-pointer overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]"
                >
                  <img
                    src="/illustrations/planner-roadmap-3d.jpg"
                    alt="Exam Countdown and Daily Task Planner"
                    className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Interactive MicroKit Bounce Checkboxes */}
                <div className="mt-2.5 space-y-1.5">
                  {(data.todayItems.length > 0
                    ? data.todayItems.slice(0, 2).map(item => ({
                        id: item.id,
                        title: item.title,
                        done: Boolean(item.completedAt),
                        isReal: true,
                      }))
                    : DEMO_TASKS.map(t => ({
                        id: t.id,
                        title: t.title,
                        done: Boolean(demoTaskState[t.id]),
                        isReal: false,
                      }))
                  ).map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        if (task.isReal) {
                          completeItemMutation.mutate({
                            id: task.id,
                            completed: !task.done,
                          });
                        } else {
                          setDemoTaskState(prev => ({
                            ...prev,
                            [task.id]: !prev[task.id],
                          }));
                        }
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl bg-[#FDF3F3]/90 px-3 py-1.5 text-left transition hover:bg-[#F8E7E7] cursor-pointer"
                    >
                      <motion.span
                        whileTap={{ scale: 1.3 }}
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-md border transition-colors ${
                          task.done
                            ? "border-[#724060] bg-[#724060] text-white"
                            : "border-[#724060]/40 bg-white"
                        }`}
                      >
                        {task.done && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </motion.span>
                      <span
                        className={`truncate text-[11.5px] font-semibold ${
                          task.done
                            ? "text-[#724060]/55 line-through"
                            : "text-[#2D1826]"
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* FEATURE SHOWCASE ROW 2: AI Socratic Tutor 3D Image (4 cols) + Subject Folders Hub (4 cols) + Weekly Study Rhythm (4 cols) */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* FEATURE 5: AI Study Tutor (3D Step-by-Step Socratic Illustration Image) */}
            <div
              onClick={() => setLocation("/chat")}
              className="lg:col-span-4 group cursor-pointer rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[17px] font-bold text-[#2D1826]">
                      AI Study Tutor (8 Modes)
                    </h2>
                    <p className="text-[11.5px] text-[#724060]/75">
                      Socratic step-by-step math & PDF grounding
                    </p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                </div>

                {/* 3D AI Tutor Illustration Image */}
                <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]">
                  <img
                    src="/illustrations/ai-tutor-socratic.jpg"
                    alt="AI Study Tutor Step-by-Step Socratic Solver"
                    className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between text-[12.5px] font-bold text-[#724060]">
                <span>Open Socratic AI Tutor</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* FEATURE 6: Subject Folders Hub (Visual Colored Folder Cards) */}
            <div className="lg:col-span-4 rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[17px] font-bold text-[#2D1826]">
                      Subject Folders
                    </h2>
                    <p className="text-[11.5px] text-[#724060]/75">
                      Organize PDFs, notes & flashcards by course
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/subjects")}
                    className="inline-flex items-center gap-1 rounded-full bg-[#FDF3F3] px-3 py-1 text-[11.5px] font-bold text-[#724060] hover:bg-[#F8E7E7] cursor-pointer"
                  >
                    <span>All ({data.subjects.length})</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                  {(data.subjects.length > 0
                    ? data.subjects.slice(0, 3)
                    : [
                        { id: -1, name: "Physics 201", color: "#724060" },
                        { id: -2, name: "Calculus II", color: "#A070A1" },
                        { id: -3, name: "Computer Science", color: "#522943" },
                      ]
                  ).map(subject => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() =>
                        setLocation(
                          subject.id > 0
                            ? `/subjects?subjectId=${subject.id}`
                            : "/subjects?create=1"
                        )
                      }
                      className="group relative overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] p-3 text-left transition hover:-translate-y-0.5 hover:bg-[#F8E7E7] cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="h-2.5 w-8 rounded-full"
                          style={{ backgroundColor: subject.color || "#724060" }}
                        />
                        <FileText className="h-3.5 w-3.5 text-[#A070A1]" />
                      </div>
                      <p className="mt-2 truncate text-[12.5px] font-bold text-[#2D1826]">
                        {subject.name}
                      </p>
                      <p className="mt-0.5 text-[10.5px] font-semibold text-[#724060]/70">
                        {subject.id > 0 ? "Open folder →" : "Sample folder →"}
                      </p>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setLocation("/subjects?create=1")}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#724060]/25 bg-[#FDF3F3]/50 p-3 text-center text-[#724060] transition hover:border-[#724060] hover:bg-[#F8E7E7] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="mt-1 text-[11.5px] font-bold">New Subject</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLocation("/documents")}
                className="mt-4 w-full rounded-full border border-[#724060]/20 bg-[#FDF3F3] py-1.5 text-[12px] font-bold text-[#724060] transition hover:bg-[#F8E7E7] cursor-pointer"
              >
                Open Document Vault →
              </button>
            </div>

            {/* FEATURE 7: Compact 7-Day Focus Bar */}
            <div className="lg:col-span-4 rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[#2D1826]">
                    Weekly Study Rhythm
                  </h2>
                  <p className="text-[11.5px] text-[#724060]/75">
                    {data.sessionMinutesToday}m focused today · auto-tracked live
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF3F3] px-2.5 py-1 text-[10.5px] font-bold text-[#724060]">
                  <Flame className="h-3.5 w-3.5 text-[#724060]" />
                  Live
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 items-end gap-1.5 pt-2">
                {weekTrend.map(point => {
                  const h = Math.max(
                    14,
                    Math.round((point.minutes / maxWeekMinutes) * 100)
                  );
                  return (
                    <div
                      key={point.dayName}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-[9.5px] font-bold text-[#724060]">
                        {point.minutes > 0 ? `${point.minutes}m` : "0m"}
                      </span>
                      <div className="flex h-20 w-full max-w-9 items-end rounded-xl bg-[#FDF3F3] p-1">
                        <div
                          className={`w-full rounded-lg transition-all duration-500 ${
                            point.isToday
                              ? "bg-gradient-to-t from-[#724060] to-[#A070A1]"
                              : point.minutes > 0
                              ? "bg-[#A070A1]"
                              : "bg-[#F8E7E7]"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <span
                        className={`text-[10.5px] font-semibold ${
                          point.isToday ? "text-[#2D1826] font-bold" : "text-[#724060]/75"
                        }`}
                      >
                        {point.dayName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <DashboardSessionSummary
          minutesToday={data.sessionMinutesToday}
          sessions={data.recentSessions}
        />
      </div>
    </StudentAppShell>
  );
}
