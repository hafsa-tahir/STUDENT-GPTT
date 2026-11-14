import { DashboardSessionSummary } from "@/components/DashboardSessionSummary";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
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
  Zap,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const SAMPLE_CARDS = [
  {
    q: "Active Recall & Spaced Repetition",
    a: "Rate cards Again / Good / Easy to schedule optimal review intervals.",
  },
  {
    q: "Scoped AI Assessment Quizzes",
    a: "Generate Easy, Medium, or Hard MCQs from any uploaded lecture PDF.",
  },
  {
    q: "Formula & Definition Mastery",
    a: "Synthesize high-yield revision sheets with LaTeX math and exam traps.",
  },
];

export default function Dashboard() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const dashboard = trpc.workspace.dashboard.useQuery(undefined, {
    enabled: Boolean(user),
    retry: 1,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const flashcardsQuery = trpc.flashcards.list.useQuery(undefined, {
    enabled: Boolean(user),
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

  const completedCount = data.todayItems.filter(item => item.completedAt).length;
  const completion = data.todayItems.length
    ? Math.round((completedCount / data.todayItems.length) * 100)
    : data.sessionMinutesToday > 0
    ? Math.min(100, Math.round((data.sessionMinutesToday / 30) * 100))
    : 0;

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

  // Live Flashcard deck for Bencho 3D Card Stack
  const realCards = (flashcardsQuery.data ?? []).slice(0, 6).map(c => ({
    q: c.front,
    a: c.back,
  }));
  const deck = realCards.length > 0 ? realCards : SAMPLE_CARDS;
  const activeCard = deck[cardIndex % deck.length];

  function cycleFlashcard() {
    setCardFlipped(false);
    setCardIndex(prev => (prev + 1) % deck.length);
  }

  // Direct PDF Upload handler for the 3D Uiverse Dropzone card
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
              <p className="mt-0.5 text-[14px] text-[#724060]/80">
                Pick a study tool below or drop a lecture PDF to synthesize notes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocation("/chat")}
                className="inline-flex items-center gap-2 rounded-full border border-[#724060]/15 bg-white px-4 py-2 text-[13px] font-semibold text-[#2D1826] shadow-2xs transition hover:bg-[#F8E7E7]"
              >
                <MessageCircle className="h-4 w-4 text-[#724060]" />
                Ask AI Tutor
              </button>
              <button
                type="button"
                onClick={() => setLocation("/subjects?create=1")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#724060] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(114,64,96,0.22)] transition hover:bg-[#5a334c]"
              >
                <Plus className="h-4 w-4" />
                New Subject
              </button>
            </div>
          </section>

          {/* TOP HERO BENTO ROW: MicroKit Progress Ring Card (8 cols) + Uiverse 3D Folder Dropzone (4 cols) */}
          <section className="grid grid-cols-12 gap-4">
            {/* Hero Left: Glassmorphic Plum Resume Card + MicroKit Animated Progress Ring */}
            <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] p-6 sm:p-7 text-white shadow-[0_20px_45px_rgba(114,64,96,0.24)] flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Decorative soft glass glow */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
              <div className="pointer-events-none absolute right-24 -bottom-16 h-44 w-44 rounded-full bg-[#A070A1]/25 blur-xl" />

              {/* Left: Animated SVG Progress Ring */}
              <div className="flex items-center gap-5 sm:gap-6 z-10 w-full sm:w-auto">
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
                    <span className="text-[22px] font-bold leading-none">
                      {completion}%
                    </span>
                    <span className="mt-1 text-[10px] font-medium text-[#F8E7E7]/80">
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

                  {/* MicroKit Glow-Arrow Button */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLocation(resumeHref)}
                      className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-[#2D1826] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all hover:bg-[#FDF3F3] hover:pr-6"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4 text-[#724060] transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                    {daysToExam !== null && nextExamPlan && (
                      <button
                        type="button"
                        onClick={() => setLocation("/planner")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-xs hover:bg-white/20 transition"
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-[#F8E7E7]" />
                        <span>
                          {nextExamPlan.title}: {daysToExam}d left
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Right: Uiverse 3D Animated Folder PDF Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDraggingPdf(true);
              }}
              onDragLeave={() => setIsDraggingPdf(false)}
              onDrop={onDropPdf}
              onClick={() => fileInputRef.current?.click()}
              className={`group col-span-12 lg:col-span-4 relative cursor-pointer overflow-hidden rounded-[28px] border-2 border-dashed p-6 transition-all duration-300 flex flex-col items-center justify-center text-center shadow-[0_12px_30px_rgba(114,64,96,0.07)] ${
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

              {/* Custom 3D CSS Folder Illustration */}
              <div className="relative mb-3 flex h-24 w-28 items-center justify-center">
                {/* Back folder tab + body */}
                <div className="relative h-16 w-24 rounded-2xl bg-gradient-to-br from-[#522943] to-[#724060] shadow-md">
                  <div className="absolute -top-2.5 left-3 h-4 w-10 rounded-t-lg bg-[#522943]" />
                  {/* Floating PDF pages inside folder */}
                  <div className="absolute -top-4 left-3.5 h-14 w-11 -rotate-6 rounded-lg border border-[#724060]/20 bg-[#FDF3F3] p-1.5 shadow-sm transition-transform duration-300 group-hover:-translate-y-3 group-hover:-rotate-12">
                    <span className="block rounded bg-[#724060] px-1 py-0.5 text-[7px] font-bold text-white">
                      PDF
                    </span>
                    <div className="mt-1 space-y-1">
                      <div className="h-0.5 w-full rounded bg-[#A070A1]/50" />
                      <div className="h-0.5 w-4/5 rounded bg-[#A070A1]/50" />
                    </div>
                  </div>
                  <div className="absolute -top-5 right-3.5 h-14 w-11 rotate-6 rounded-lg border border-[#724060]/20 bg-white p-1.5 shadow-md transition-transform duration-300 group-hover:-translate-y-4 group-hover:rotate-12">
                    <span className="block rounded bg-[#A070A1] px-1 py-0.5 text-[7px] font-bold text-white">
                      PDF
                    </span>
                    <div className="mt-1 space-y-1">
                      <div className="h-0.5 w-full rounded bg-[#724060]/40" />
                      <div className="h-0.5 w-3/4 rounded bg-[#724060]/40" />
                    </div>
                  </div>
                  {/* Front Folder Flap */}
                  <div className="absolute inset-x-0 bottom-0 h-11 origin-bottom rounded-2xl bg-gradient-to-br from-[#8C5378] to-[#724060] shadow-inner transition-transform duration-300 group-hover:scale-y-90 flex items-center justify-center">
                    <div className="h-3.5 w-3.5 rounded-full bg-[#F8E7E7]/80 shadow-xs" />
                  </div>
                </div>
              </div>

              <h3 className="text-[17px] font-bold text-[#2D1826] flex items-center gap-1.5">
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
              <p className="mt-1 text-[12px] text-[#724060]/75">
                {uploadNotice || "Click or drag a course PDF to generate notes & quizzes"}
              </p>
            </div>
          </section>

          {/* MIDDLE ROW: 4 Interactive MicroKit Hover-Glide Feature Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* CARD 1: AI Note Maker (Mini LaTeX Formula + Sticky Note Preview) */}
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
                  <h3 className="text-[17px] font-bold text-[#2D1826]">
                    AI Note Maker
                  </h3>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <NotebookPen className="h-4 w-4" />
                  </span>
                </div>

                {/* Live Mini Visual Preview: LaTeX Equation Card + Sticky Note */}
                <div className="relative mt-4 rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]/80 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A070A1]">
                    Synthesized Formula & Proof
                  </p>
                  <div className="mt-2 rounded-xl bg-white px-3 py-2.5 font-serif text-[13px] text-[#2D1826] shadow-2xs">
                    <div>{"∮ E · dA = Q_enc / ε₀"}</div>
                    <div className="mt-1 text-[11px] font-sans text-[#724060]/80">
                      {"U = -p · E  (Dipole Energy)"}
                    </div>
                  </div>
                  {/* Floating Sticky Note Badge */}
                  <div className="absolute -bottom-2 right-3 rotate-3 rounded-lg bg-[#8C5378] px-2.5 py-1 text-[10px] font-semibold text-white shadow-md transition-transform group-hover:rotate-6">
                    Sticky note
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-[13px] font-semibold text-[#724060]">
                <span>
                  {notesQuery.data?.length
                    ? `${notesQuery.data.length} saved notes`
                    : "Synthesize PDF or topic"}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* CARD 2: Bencho 3D Flashcard Stack & Quiz Studio */}
            <div
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group relative rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,0.13)] flex flex-col justify-between"
            >
              {hoveredCard === 1 && (
                <motion.div
                  layoutId="dashboard-hover-glide"
                  className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
                />
              )}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-bold text-[#2D1826]">
                    3D Flashcard Stack
                  </h3>
                  <button
                    type="button"
                    onClick={() => setLocation("/practice")}
                    className="text-[12px] font-semibold text-[#724060] hover:underline"
                  >
                    Open Practice →
                  </button>
                </div>

                {/* Interactive Stacked Cards */}
                <div
                  onClick={() => setCardFlipped(prev => !prev)}
                  className="relative mt-4 h-28 cursor-pointer select-none"
                  title="Click card to flip answer"
                >
                  <div className="absolute inset-x-5 -bottom-2 h-24 rounded-2xl border border-[#724060]/15 bg-[#522943] opacity-85 transition-transform group-hover:translate-y-0.5" />
                  <div className="absolute inset-x-2.5 -bottom-1 h-24 rounded-2xl border border-[#724060]/15 bg-[#A070A1] opacity-90" />
                  <motion.div
                    key={`${cardIndex}-${cardFlipped}`}
                    initial={{ scale: 0.95, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="relative flex h-24 w-full flex-col justify-between rounded-2xl border border-[#724060]/20 bg-[#FDF3F3] p-3.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#A070A1]">
                      <span>{cardFlipped ? "ANSWER" : "QUESTION"}</span>
                      <span>
                        {(cardIndex % deck.length) + 1}/{deck.length} · Tap to flip
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[13px] font-semibold text-[#2D1826]">
                      {cardFlipped ? activeCard.a : activeCard.q}
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Rating Pills */}
              <div className="mt-5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cycleFlashcard}
                  className="flex-1 rounded-full bg-[#2D1826] py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#724060]"
                >
                  Easy
                </button>
                <button
                  type="button"
                  onClick={cycleFlashcard}
                  className="flex-1 rounded-full border border-[#724060]/20 bg-[#FDF3F3] py-1.5 text-[12px] font-semibold text-[#2D1826] transition hover:bg-[#F8E7E7]"
                >
                  Good
                </button>
                <button
                  type="button"
                  onClick={cycleFlashcard}
                  className="flex-1 rounded-full border border-[#724060]/20 bg-white py-1.5 text-[12px] font-semibold text-[#724060] transition hover:bg-[#FDF3F3]"
                >
                  Again
                </button>
              </div>
            </div>

            {/* CARD 3: Research Studio + MicroKit Aurora Export Button */}
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
                  <h3 className="text-[17px] font-bold text-[#2D1826]">
                    Research Studio
                  </h3>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <Compass className="h-4 w-4" />
                  </span>
                </div>

                {/* Mini Scholarly Paper Preview */}
                <div className="mt-4 rounded-2xl border border-[#724060]/12 bg-[#FDF3F3]/80 p-3">
                  <div className="rounded-xl bg-white p-2.5 shadow-2xs">
                    <p className="truncate text-[12px] font-bold text-[#2D1826]">
                      {latestResearch
                        ? latestResearch.title
                        : "Publication-Grade Research Paper"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-[#724060]/75">
                      Formal definitions, literature synthesis, verified YouTube lectures & citations.
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#2D1826] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      Research Paper
                    </span>
                    <span className="rounded-full border border-[#724060]/20 bg-white px-2 py-0.5 text-[10px] font-medium text-[#724060]">
                      Citations
                    </span>
                    <span className="rounded-full border border-[#724060]/20 bg-white px-2 py-0.5 text-[10px] font-medium text-[#724060]">
                      Videos
                    </span>
                  </div>
                </div>
              </div>

              {/* MicroKit Aurora Button */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLocation("/research");
                }}
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[#2D1826] via-[#724060] to-[#4A263D] py-2 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgba(114,64,96,0.3)] transition hover:opacity-95"
              >
                {latestResearch ? "Open & Export Paper" : "Start Research Paper"}
              </button>
            </div>

            {/* CARD 4: Today's Tasks (MicroKit Bounce Checkboxes) */}
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
                  <h3 className="text-[17px] font-bold text-[#2D1826]">
                    Today’s Tasks
                  </h3>
                  <button
                    type="button"
                    onClick={() => setLocation("/planner")}
                    className="text-[12px] font-semibold text-[#724060] hover:underline"
                  >
                    Planner →
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {data.todayItems.length > 0 ? (
                    data.todayItems.slice(0, 4).map(item => {
                      const done = Boolean(item.completedAt);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            completeItemMutation.mutate({
                              id: item.id,
                              completed: !done,
                            })
                          }
                          className="flex w-full items-center gap-2.5 rounded-xl bg-[#FDF3F3]/80 px-3 py-2 text-left transition hover:bg-[#F8E7E7]"
                        >
                          <motion.span
                            whileTap={{ scale: 1.25 }}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                              done
                                ? "border-[#724060] bg-[#724060] text-white"
                                : "border-[#724060]/40 bg-white"
                            }`}
                          >
                            {done && <Check className="h-3.5 w-3.5" />}
                          </motion.span>
                          <span
                            className={`truncate text-[13px] font-medium ${
                              done
                                ? "text-[#724060]/60 line-through"
                                : "text-[#2D1826]"
                            }`}
                          >
                            {item.title}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl bg-[#FDF3F3] p-3.5 text-[12px] text-[#724060]/80">
                      <p className="font-semibold text-[#2D1826]">
                        No tasks scheduled today
                      </p>
                      <p className="mt-0.5">
                        Add an exam date or study task in Planner to track daily progress.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLocation("/planner")}
                className="mt-4 w-full rounded-full border border-[#724060]/20 bg-[#FDF3F3] py-1.5 text-[12px] font-semibold text-[#724060] transition hover:bg-[#F8E7E7]"
              >
                + Add or manage tasks
              </button>
            </div>
          </section>

          {/* BOTTOM COMPACT SPLIT: Subject Folders (Left) + 7-Day Focus Rhythm (Right) */}
          <section className="grid grid-cols-12 gap-4">
            {/* Subject Folders */}
            <div className="col-span-12 lg:col-span-6 rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[#2D1826]">
                    Subject Folders
                  </h2>
                  <p className="text-[12px] text-[#724060]/75">
                    Jump into a course workspace
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/subjects")}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FDF3F3] px-3 py-1.5 text-[12px] font-semibold text-[#724060] hover:bg-[#F8E7E7]"
                >
                  <span>All subjects ({data.subjects.length})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {data.subjects.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {data.subjects.slice(0, 6).map(subject => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setLocation(`/subjects?subjectId=${subject.id}`)}
                      className="group relative overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] p-3.5 text-left transition hover:-translate-y-0.5 hover:bg-[#F8E7E7]"
                    >
                      <span
                        className="mb-2 block h-2 w-8 rounded-full"
                        style={{ backgroundColor: subject.color || "#724060" }}
                      />
                      <p className="truncate text-[13px] font-bold text-[#2D1826]">
                        {subject.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#724060]/70">
                        Open folder →
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#FDF3F3] p-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-[#724060]" />
                    <span className="text-[13px] font-medium text-[#2D1826]">
                      Create your first subject folder to organize notes & PDFs.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/subjects?create=1")}
                    className="shrink-0 rounded-full bg-[#724060] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                  >
                    Create
                  </button>
                </div>
              )}
            </div>

            {/* Compact 7-Day Focus Bar */}
            <div className="col-span-12 lg:col-span-6 rounded-[26px] border border-[#724060]/12 bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,0.06)] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[#2D1826]">
                    Weekly Study Rhythm
                  </h2>
                  <p className="text-[12px] text-[#724060]/75">
                    {data.sessionMinutesToday}m focused today · auto-tracked while you study
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF3F3] px-3 py-1 text-[11px] font-semibold text-[#724060]">
                  <Flame className="h-3.5 w-3.5 text-[#724060]" />
                  Live
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 items-end gap-2 pt-2">
                {weekTrend.map(point => {
                  const h = Math.max(
                    12,
                    Math.round((point.minutes / maxWeekMinutes) * 100)
                  );
                  return (
                    <div
                      key={point.dayName}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="text-[10px] font-semibold text-[#724060]">
                        {point.minutes > 0 ? `${point.minutes}m` : "0m"}
                      </span>
                      <div className="flex h-20 w-full max-w-10 items-end rounded-xl bg-[#FDF3F3] p-1">
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
                        className={`text-[11px] font-semibold ${
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
