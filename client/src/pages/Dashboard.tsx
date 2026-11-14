import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { SpotlightCard } from "@/components/MicroInteractions";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Compass,
  Layers3,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const DEMO_TASKS = [
  { id: -1, title: "Review lecture PDF" },
  { id: -2, title: "Practice 15 MCQs" },
  { id: -3, title: "Formula cheat sheet" },
  { id: -4, title: "Export research brief" },
];

export default function Dashboard() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [demoTaskState, setDemoTaskState] = useState<Record<number, boolean>>({
    [-1]: true,
    [-2]: true,
    [-3]: true,
    [-4]: false,
  });
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

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

  const data = dashboard.data || {
    subjects: [],
    todayItems: [],
    upcomingPlans: [],
    sessionMinutesToday: 0,
  };

  const demoDoneCount = Object.values(demoTaskState).filter(Boolean).length;
  const completedCount = data.todayItems.filter(item => item.completedAt).length;
  const completion = data.todayItems.length
    ? Math.round((completedCount / data.todayItems.length) * 100)
    : data.sessionMinutesToday > 0
    ? Math.min(100, Math.round((data.sessionMinutesToday / 30) * 100))
    : Math.round((demoDoneCount / DEMO_TASKS.length) * 100);

  const latestNote = notesQuery.data?.[0];
  const latestResearch = researchQuery.data?.[0];
  const todayFocus = data.todayItems.find(item => !item.completedAt) || data.todayItems[0];

  const resumeTitle = latestNote
    ? latestNote.title
    : todayFocus
    ? todayFocus.title
    : latestResearch
    ? latestResearch.title
    : "Electrostatics & Formula Notes";

  const resumeHref = latestNote
    ? "/notes"
    : todayFocus
    ? "/planner"
    : latestResearch
    ? "/research"
    : "/documents";

  async function handlePdfUpload(file: File | undefined) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;
    setUploadingPdf(true);
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
      if (res.ok) {
        await utils.documents.list.invalidate();
        await utils.workspace.dashboard.invalidate();
      }
      setLocation("/documents");
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

  // SVG Ring geometry (r = 44 -> circumference = 276.46)
  const ringCircumference = 276.46;
  const ringOffset = ringCircumference * (1 - Math.min(100, completion) / 100);

  return (
    <StudentAppShell>
      <div className="min-h-[calc(100vh-88px)] bg-[#FDF3F3] px-5 py-7 sm:px-9 sm:py-10 lg:px-12">
        <div className="mx-auto max-w-[1360px] space-y-8">
          {/* ROW 1: Hero Resume Card (8 cols) + 3D PDF Folder Dropzone (4 cols) */}
          <section className="grid grid-cols-12 gap-6">
            {/* Hero Left: Glassmorphic Plum Resume Card */}
            <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#4A253D] via-[#683857] to-[#7D4669] px-7 py-8 sm:px-10 sm:py-10 text-white shadow-[0_22px_50px_rgba(82,41,67,0.24)] flex flex-col sm:flex-row items-center gap-7 sm:gap-9">
              <div className="pointer-events-none absolute -right-14 -top-14 h-60 w-60 rounded-full bg-[#F8E7E7]/10 blur-3xl" />

              {/* Animated SVG Progress Ring */}
              <div className="relative flex h-34 w-34 shrink-0 items-center justify-center">
                <svg className="h-34 w-34 -rotate-90" viewBox="0 0 104 104">
                  <circle
                    cx="52"
                    cy="52"
                    r="44"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="8.5"
                    fill="none"
                  />
                  <circle
                    cx="52"
                    cy="52"
                    r="44"
                    stroke="#F8E7E7"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-700 ease-out drop-shadow-[0_0_10px_rgba(248,231,231,0.65)]"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="mb-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#F8E7E7] text-[#522943] shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <span className="text-[26px] font-extrabold leading-none tracking-tight">
                    {completion}%
                  </span>
                </div>
              </div>

              {/* Clean Minimal Resume Text + Glow Button */}
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[13px] font-medium text-[#F8E7E7]/80">
                  Current study session
                </p>
                <h1 className="mt-1.5 truncate text-[26px] sm:text-[32px] font-extrabold tracking-tight text-white">
                  Resume: {resumeTitle}
                </h1>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setLocation(resumeHref)}
                    className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#FDF3F3] to-[#EAD2D9] px-6 py-3 text-[14px] font-bold text-[#2D1826] shadow-[0_8px_28px_rgba(248,231,231,0.3)] transition-all hover:pr-7 cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4 text-[#522943] transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Hero Right: 3D Folder Dropzone Card */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDraggingPdf(true);
              }}
              onDragLeave={() => setIsDraggingPdf(false)}
              onDrop={onDropPdf}
              onClick={() => fileInputRef.current?.click()}
              className={`group col-span-12 lg:col-span-4 cursor-pointer rounded-[32px] border p-6 transition-all duration-300 flex flex-col items-center justify-center text-center shadow-[0_14px_34px_rgba(114,64,96,0.07)] ${
                isDraggingPdf
                  ? "border-[#724060] bg-[#F8E7E7]"
                  : "border-[#724060]/12 bg-white hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(114,64,96,0.12)]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={onFileInputChange}
                className="hidden"
              />

              <img
                src="/illustrations/pdf-folder-3d.svg"
                alt="Drop Lecture PDF"
                className="h-38 w-60 object-contain"
              />

              <h2 className="mt-2 text-[20px] font-extrabold text-[#2D1826] flex items-center gap-2">
                {uploadingPdf ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-[#724060]" />
                    <span>Uploading PDF…</span>
                  </>
                ) : (
                  <span>Drop Lecture PDF</span>
                )}
              </h2>
            </div>
          </section>

          {/* ROW 2: 4 Clean Visual Feature Cards with Generous Breathing Room */}
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {/* CARD 1: AI Note Maker */}
            <SpotlightCard
              onClick={() => setLocation("/notes")}
              className="group cursor-pointer rounded-[30px] border border-[#724060]/12 bg-white p-6 shadow-[0_14px_34px_rgba(114,64,96,0.06)]"
            >
              <div
                onMouseEnter={() => setHoveredCard(0)}
                onMouseLeave={() => setHoveredCard(null)}
                className="flex h-full flex-col justify-between"
              >
                {hoveredCard === 0 && (
                  <motion.div
                    layoutId="dashboard-hover-glide"
                    className="pointer-events-none absolute inset-0 rounded-[30px] ring-2 ring-[#724060]/35"
                  />
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[19px] font-extrabold text-[#2D1826]">
                      AI Note Maker
                    </h3>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                      <NotebookPen className="h-4.5 w-4.5" />
                    </span>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#724060]/10 bg-[#FDF3F3]">
                    <img
                      src="/illustrations/ai-notes-diagram.svg"
                      alt="AI Note Maker Formula and Sticky Note"
                      className="h-44 w-full object-cover"
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-[14px] font-bold text-[#2D1826]">
                  <span>Open Studio</span>
                  <ArrowRight className="h-4 w-4 text-[#724060] transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </SpotlightCard>

            {/* CARD 2: 3D Flashcard Stack */}
            <SpotlightCard
              onClick={() => setLocation("/practice")}
              className="group cursor-pointer rounded-[30px] border border-[#724060]/12 bg-white p-6 shadow-[0_14px_34px_rgba(114,64,96,0.06)]"
            >
              <div
                onMouseEnter={() => setHoveredCard(1)}
                onMouseLeave={() => setHoveredCard(null)}
                className="flex h-full flex-col justify-between"
              >
                {hoveredCard === 1 && (
                  <motion.div
                    layoutId="dashboard-hover-glide"
                    className="pointer-events-none absolute inset-0 rounded-[30px] ring-2 ring-[#724060]/35"
                  />
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[19px] font-extrabold text-[#2D1826]">
                      3D Flashcard Stack
                    </h3>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                      <Layers3 className="h-4.5 w-4.5" />
                    </span>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#724060]/10 bg-[#FDF3F3]">
                    <img
                      src="/illustrations/flashcards-quiz-3d.svg"
                      alt="3D Flashcard Stack"
                      className="h-44 w-full object-cover"
                    />
                  </div>
                </div>

                <div
                  className="mt-5 flex items-center gap-2"
                  onClick={e => {
                    e.stopPropagation();
                    setLocation("/practice");
                  }}
                >
                  <button
                    type="button"
                    className="flex-1 rounded-full bg-[#2D1826] py-2 text-[12.5px] font-bold text-white transition hover:bg-[#724060] cursor-pointer"
                  >
                    Easy
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#724060]/20 bg-[#FDF3F3] py-2 text-[12.5px] font-bold text-[#2D1826] transition hover:bg-[#F8E7E7] cursor-pointer"
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-[#724060]/20 bg-white py-2 text-[12.5px] font-bold text-[#724060] transition hover:bg-[#FDF3F3] cursor-pointer"
                  >
                    Again
                  </button>
                </div>
              </div>
            </SpotlightCard>

            {/* CARD 3: Research Studio */}
            <SpotlightCard
              onClick={() => setLocation("/research")}
              className="group cursor-pointer rounded-[30px] border border-[#724060]/12 bg-white p-6 shadow-[0_14px_34px_rgba(114,64,96,0.06)]"
            >
              <div
                onMouseEnter={() => setHoveredCard(2)}
                onMouseLeave={() => setHoveredCard(null)}
                className="flex h-full flex-col justify-between"
              >
                {hoveredCard === 2 && (
                  <motion.div
                    layoutId="dashboard-hover-glide"
                    className="pointer-events-none absolute inset-0 rounded-[30px] ring-2 ring-[#724060]/35"
                  />
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[19px] font-extrabold text-[#2D1826]">
                      Research Studio
                    </h3>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                      <Compass className="h-4.5 w-4.5" />
                    </span>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#724060]/10 bg-[#FDF3F3]">
                    <img
                      src="/illustrations/research-canvas-diagram.svg"
                      alt="Research Studio Paper"
                      className="h-44 w-full object-cover"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setLocation("/research");
                  }}
                  className="mt-5 w-full rounded-full bg-gradient-to-r from-[#2D1826] via-[#724060] to-[#4A263D] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_22px_rgba(114,64,96,0.32)] transition hover:opacity-95 cursor-pointer"
                >
                  Export Paper
                </button>
              </div>
            </SpotlightCard>

            {/* CARD 4: Today's Tasks (Clean Interactive Bounce Checkboxes) */}
            <SpotlightCard className="rounded-[30px] border border-[#724060]/12 bg-white p-6 shadow-[0_14px_34px_rgba(114,64,96,0.06)]">
              <div
                onMouseEnter={() => setHoveredCard(3)}
                onMouseLeave={() => setHoveredCard(null)}
                className="flex h-full flex-col justify-between"
              >
                {hoveredCard === 3 && (
                  <motion.div
                    layoutId="dashboard-hover-glide"
                    className="pointer-events-none absolute inset-0 rounded-[30px] ring-2 ring-[#724060]/35"
                  />
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[19px] font-extrabold text-[#2D1826]">
                      Today’s Tasks
                    </h3>
                    <button
                      type="button"
                      onClick={() => setLocation("/planner")}
                      className="text-[12.5px] font-bold text-[#724060] hover:underline cursor-pointer"
                    >
                      Planner →
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {(data.todayItems.length > 0
                      ? data.todayItems.slice(0, 4).map(item => ({
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
                        className="flex w-full items-center gap-3 rounded-2xl bg-[#FDF3F3] px-3.5 py-2.5 text-left transition hover:bg-[#F8E7E7] cursor-pointer"
                      >
                        <motion.span
                          whileTap={{ scale: 1.3 }}
                          className={`grid h-5.5 w-5.5 shrink-0 place-items-center rounded-lg border transition-colors ${
                            task.done
                              ? "border-[#724060] bg-[#724060] text-white"
                              : "border-[#724060]/35 bg-white"
                          }`}
                        >
                          {task.done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </motion.span>
                        <span
                          className={`truncate text-[13.5px] font-semibold ${
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

                <button
                  type="button"
                  onClick={() => setLocation("/planner")}
                  className="mt-5 w-full rounded-full bg-[#F8E7E7] py-2 text-[12.5px] font-bold text-[#724060] transition hover:bg-[#ead2d9] cursor-pointer"
                >
                  Manage Schedule
                </button>
              </div>
            </SpotlightCard>
          </section>

          {/* Minimal Bottom Quick-Launch Strip (Zero Clutter) */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-[#724060]/10 bg-white/80 px-6 py-4 backdrop-blur-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2D1826]">
                <Sparkles className="h-4 w-4 text-[#724060]" />
                Quick Launch:
              </span>
              <button
                type="button"
                onClick={() => setLocation("/chat")}
                className="rounded-full bg-[#FDF3F3] px-4 py-1.5 text-[12.5px] font-bold text-[#724060] transition hover:bg-[#F8E7E7] cursor-pointer"
              >
                AI Study Tutor
              </button>
              <button
                type="button"
                onClick={() => setLocation("/subjects")}
                className="rounded-full bg-[#FDF3F3] px-4 py-1.5 text-[12.5px] font-bold text-[#724060] transition hover:bg-[#F8E7E7] cursor-pointer"
              >
                Subjects ({data.subjects.length})
              </button>
              <button
                type="button"
                onClick={() => setLocation("/documents")}
                className="rounded-full bg-[#FDF3F3] px-4 py-1.5 text-[12.5px] font-bold text-[#724060] transition hover:bg-[#F8E7E7] cursor-pointer"
              >
                Documents Vault
              </button>
            </div>

            <span className="text-[12.5px] font-semibold text-[#724060]/75">
              {data.sessionMinutesToday}m studied today
            </span>
          </section>
        </div>
      </div>
    </StudentAppShell>
  );
}
