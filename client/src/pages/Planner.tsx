import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { HoldToDeleteButton } from "@/components/HoldToDeleteButton";
import { FloatingHeroIllustration, SpotlightCard } from "@/components/MicroInteractions";
import { PlannerNotesSummary } from "@/components/PlannerNotesSummary";
import { PlannerSessionSummary } from "@/components/PlannerSessionSummary";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { CalendarDays, Check, Clock3, Pencil, Plus, Sparkles, Timer } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

type Task = { id: number; title: string; notes: string | null; scheduledFor: Date | string | null; estimatedMinutes: number; completedAt: Date | string | null };
type Session = { id: number; startedAt: Date | string; endedAt: Date | string | null; minutesStudied: number; planItemId: number | null };
type Plan = { id: number; title: string; examDate: Date | string | null; items: Task[]; sessions: Session[] };
const toDateInput = (date: Date | string | null) => date ? new Date(date).toISOString().slice(0, 10) : "";

function Modal({ children }: { children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#2D1826]/35 p-4 backdrop-blur-xs">
      <div className="max-h-[90dvh] w-full max-w-[470px] overflow-y-auto rounded-[24px] border border-[#F8E7E7] bg-white p-5 sm:p-6 shadow-[0_24px_70px_rgba(114,64,96,.25)]">
        {children}
      </div>
    </div>
  );
}

export default function Planner() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const plans = trpc.planner.list.useQuery(undefined, { enabled: Boolean(user) });
  const subjects = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const invalidate = async () => {
    await Promise.all([utils.planner.list.invalidate(), utils.workspace.dashboard.invalidate()]);
  };
  const createPlan = trpc.planner.createPlan.useMutation();
  const updatePlan = trpc.planner.updatePlan.useMutation();
  const deletePlan = trpc.planner.deletePlan.useMutation();
  const createItem = trpc.planner.createItem.useMutation();
  const updateItem = trpc.planner.updateItem.useMutation();
  const completeItem = trpc.planner.setItemCompletion.useMutation();
  const logSession = trpc.planner.logSession.useMutation();
  const updateSession = trpc.planner.updateSession.useMutation();

  const [planDialog, setPlanDialog] = useState<{ mode: "create" | "edit"; id?: number } | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ mode: "create" | "edit"; planId: number; taskId?: number } | null>(null);
  const [sessionTask, setSessionTask] = useState<Task | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [taskNotes, setTaskNotes] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState("30");
  const [sessionDate, setSessionDate] = useState("");

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);
  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  const storedPlans = (plans.data ?? []) as Plan[];

  function openNewPlan() {
    setPlanTitle("");
    setSubjectId("");
    setExamDate("");
    setPlanDialog({ mode: "create" });
  }
  function openEditPlan(plan: Plan) {
    setPlanTitle(plan.title);
    setExamDate(toDateInput(plan.examDate));
    setPlanDialog({ mode: "edit", id: plan.id });
  }
  function openNewTask(planId: number) {
    setTaskTitle("");
    setTaskDate("");
    setMinutes("30");
    setTaskNotes("");
    setTaskDialog({ mode: "create", planId });
  }
  function openEditTask(planId: number, task: Task) {
    setTaskTitle(task.title);
    setTaskDate(toDateInput(task.scheduledFor));
    setMinutes(String(task.estimatedMinutes));
    setTaskNotes(task.notes ?? "");
    setTaskDialog({ mode: "edit", planId, taskId: task.id });
  }
  async function submitPlan(event: FormEvent) {
    event.preventDefault();
    if (!planDialog) return;
    setError(null);
    try {
      const data = { title: planTitle.trim(), examDate: examDate ? new Date(`${examDate}T12:00:00`) : null };
      if (planDialog.mode === "create") await createPlan.mutateAsync({ ...data, subjectId: subjectId ? Number(subjectId) : null });
      else await updatePlan.mutateAsync({ id: planDialog.id!, data });
      await invalidate();
      setPlanDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the study plan.");
    }
  }
  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!taskDialog) return;
    setError(null);
    const data = {
      title: taskTitle.trim(),
      scheduledFor: taskDate ? new Date(`${taskDate}T12:00:00`) : null,
      estimatedMinutes: Math.max(5, Math.min(720, Number(minutes) || 30)),
      notes: taskNotes.trim() || null,
    };
    try {
      if (taskDialog.mode === "create") await createItem.mutateAsync({ planId: taskDialog.planId, ...data });
      else await updateItem.mutateAsync({ id: taskDialog.taskId!, data });
      await invalidate();
      setTaskDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the study task.");
    }
  }
  function openEditSession(session: Session) {
    setSessionMinutes(String(session.minutesStudied));
    setSessionDate(toDateInput(session.startedAt));
    setEditingSession(session);
  }
  async function submitSession(event: FormEvent) {
    event.preventDefault();
    if (!sessionTask && !editingSession) return;
    setError(null);
    const logged = Math.max(1, Math.min(1440, Number(sessionMinutes) || 0));
    if (!logged) {
      setError("Enter a valid number of study minutes.");
      return;
    }
    const startedAt = editingSession ? new Date(`${sessionDate || toDateInput(editingSession.startedAt)}T12:00:00`) : new Date(Date.now() - logged * 60_000);
    const endedAt = new Date(startedAt.getTime() + logged * 60_000);
    try {
      if (editingSession) await updateSession.mutateAsync({ id: editingSession.id, data: { startedAt, endedAt, minutesStudied: logged } });
      else await logSession.mutateAsync({ planItemId: sessionTask!.id, startedAt, endedAt, minutesStudied: logged });
      await invalidate();
      setSessionTask(null);
      setEditingSession(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this study session.");
    }
  }

  return (
    <StudentAppShell>
      <div className="mx-auto w-full max-w-[1280px] overflow-x-hidden p-3.5 sm:p-8 lg:p-10">
        {/* Hero Header */}
        <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-5 py-6 text-white shadow-[0_18px_40px_rgba(114,64,96,0.22)] sm:px-9 sm:py-7">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#F8E7E7]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> Exam & Session Planner
              </div>
              <h1 className="mt-2.5 text-[24px] font-bold tracking-tight sm:text-[36px]">
                Study Planner & Deadlines
              </h1>
              <p className="mt-1.5 text-[13px] sm:text-[13.5px] text-[#F8E7E7]/85">
                Turn exam dates into checkable study tasks, track progress rings, and log focused study minutes.
              </p>
              <button
                onClick={openNewPlan}
                className="mt-4 inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#2D1826] shadow-md transition hover:bg-[#FDF3F3] hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="h-4 w-4 text-[#724060]" /> New Study Plan
              </button>
            </div>
            <div className="hidden lg:block">
              <FloatingHeroIllustration
                src="/illustrations/planner-roadmap-3d.svg"
                alt="Study Planner Roadmap"
                caption="Exam Countdown & Tasks"
              />
            </div>
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-medium text-rose-800">
            {error}
          </p>
        )}

        {plans.isLoading ? (
          <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {[1, 2].map(key => (
              <div key={key} className="h-52 animate-pulse rounded-[26px] bg-white border border-[#F8E7E7]" />
            ))}
          </div>
        ) : storedPlans.length ? (
          <div className="mt-6 sm:mt-7 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            {storedPlans.map(plan => {
              const completed = plan.items.filter(item => item.completedAt).length;
              const pct = plan.items.length ? Math.round((completed / plan.items.length) * 100) : 0;
              const loggedMinutes = plan.sessions.reduce((total, session) => total + session.minutesStudied, 0);
              const circumference = 113.1;
              const offset = circumference * (1 - pct / 100);

              return (
                <section
                  key={plan.id}
                  className="min-w-0 max-w-full overflow-hidden rounded-[24px] sm:rounded-[26px] border border-[#724060]/12 bg-white shadow-[0_12px_30px_rgba(114,64,96,0.06)] transition hover:shadow-[0_16px_38px_rgba(114,64,96,0.11)] flex flex-col justify-between"
                >
                  <div>
                    {/* Plan Top Bar with MicroKit Progress Ring */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F8E7E7] bg-[#FDF3F3]/60 p-5">
                      <div className="flex items-center gap-3.5">
                        {/* Mini SVG Progress Ring */}
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                            <circle cx="22" cy="22" r="18" stroke="#F8E7E7" strokeWidth="4" fill="none" />
                            <circle
                              cx="22"
                              cy="22"
                              r="18"
                              stroke="#724060"
                              strokeWidth="4"
                              strokeLinecap="round"
                              fill="none"
                              strokeDasharray={circumference}
                              strokeDashoffset={offset}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <span className="absolute text-[10px] font-bold text-[#2D1826]">{pct}%</span>
                        </div>
                        <div>
                          <h2 className="text-[17px] font-bold text-[#2D1826]">{plan.title}</h2>
                          <p className="mt-0.5 text-[12px] text-[#724060]/75">
                            {plan.examDate
                              ? `Exam ${new Date(plan.examDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                              : "Flexible schedule"}{" "}
                            · {completed}/{plan.items.length} tasks · {loggedMinutes}m logged
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openNewTask(plan.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-[#724060] px-3 text-[11.5px] font-semibold text-white hover:bg-[#5a334c] transition"
                        >
                          <Plus className="h-3.5 w-3.5" /> Task
                        </button>
                        <button
                          onClick={() => openEditPlan(plan)}
                          className="grid h-8 w-8 place-items-center rounded-full border border-[#724060]/15 bg-white text-[#724060] hover:bg-[#F8E7E7]"
                          aria-label={`Edit ${plan.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <HoldToDeleteButton
                          compact
                          label="Hold"
                          title={`Hold to delete ${plan.title}`}
                          onConfirm={() =>
                            deletePlan.mutate({ id: plan.id }, { onSuccess: invalidate, onError: caught => setError(caught.message) })
                          }
                        />
                      </div>
                    </div>

                    {/* Task Checklist with MicroKit Bounce Checkbox */}
                    <div className="p-4 space-y-2">
                      {plan.items.length ? (
                        plan.items.map(item => {
                          const done = Boolean(item.completedAt);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3]/60 px-3.5 py-2.5 transition hover:bg-[#F8E7E7]/60"
                            >
                              <motion.button
                                whileTap={{ scale: 1.28 }}
                                onClick={() =>
                                  completeItem.mutate(
                                    { id: item.id, completed: !done },
                                    { onSuccess: invalidate, onError: caught => setError(caught.message) }
                                  )
                                }
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                                  done ? "border-[#724060] bg-[#724060] text-white" : "border-[#724060]/50 bg-white hover:border-[#724060]"
                                }`}
                                aria-label={done ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
                              >
                                {done && <Check className="h-3.5 w-3.5" />}
                              </motion.button>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13.5px] font-semibold ${done ? "text-[#724060]/60 line-through" : "text-[#2D1826]"}`}>
                                  {item.title}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#724060]/75">
                                  {item.scheduledFor
                                    ? new Date(item.scheduledFor).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                                    : "Anytime"}{" "}
                                  · {item.estimatedMinutes} min
                                </p>
                                {item.notes && <p className="mt-1 line-clamp-2 text-[11.5px] text-[#724060]/80">{item.notes}</p>}
                              </div>
                              <button
                                onClick={() => {
                                  setSessionMinutes(String(item.estimatedMinutes));
                                  setSessionTask(item);
                                }}
                                title="Log study time"
                                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#724060] shadow-2xs hover:bg-[#F8E7E7]"
                              >
                                <Timer className="h-3.5 w-3.5 text-[#A070A1]" /> Log
                              </button>
                              <button
                                onClick={() => openEditTask(plan.id, item)}
                                className="grid h-7 w-7 place-items-center rounded-full text-[#724060] hover:bg-white"
                                aria-label={`Edit ${item.title}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl bg-[#FDF3F3]/60 px-4 py-8 text-center text-[13px] text-[#724060]/75">
                          No tasks in this plan yet. Click <strong>+ Task</strong> above to add your first study session.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[28px] border-2 border-dashed border-[#724060]/25 bg-white px-6 py-12 text-center shadow-xs">
            <div className="mx-auto w-60 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
              <img
                src="/illustrations/planner-roadmap-3d.svg"
                alt="Study Planner Roadmap"
                className="h-36 w-full object-cover"
              />
            </div>
            <h2 className="mt-4 text-[18px] font-bold text-[#2D1826]">Start with an exam date or study goal</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-[#724060]/75">
              Create a study plan, check off tasks with spring checkboxes, and watch your daily progress ring fill up.
            </p>
            <button
              onClick={openNewPlan}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#724060] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-[#5a334c] cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create a study plan
            </button>
          </div>
        )}

        {planDialog && (
          <Modal>
            <form onSubmit={submitPlan}>
              <h2 className="text-lg font-bold text-[#2D1826]">{planDialog.mode === "create" ? "Create study plan" : "Edit study plan"}</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Plan title
                  <input
                    required
                    value={planTitle}
                    onChange={event => setPlanTitle(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826] outline-none focus:border-[#724060]"
                    autoFocus
                  />
                </label>
                {planDialog.mode === "create" && (
                  <label className="block text-[13px] font-semibold text-[#724060]">
                    Subject <span className="font-normal text-[#A070A1]">optional</span>
                    <select
                      value={subjectId}
                      onChange={event => setSubjectId(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                    >
                      <option value="">No subject selected</option>
                      {subjects.data?.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Exam date <span className="font-normal text-[#A070A1]">optional</span>
                  <input
                    type="date"
                    value={examDate}
                    onChange={event => setExamDate(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                  />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPlanDialog(null)}
                  className="h-10 rounded-full px-4 text-[13px] font-semibold text-[#724060] hover:bg-[#FDF3F3]"
                >
                  Cancel
                </button>
                <button
                  disabled={createPlan.isPending || updatePlan.isPending}
                  className="h-10 rounded-full bg-[#724060] px-5 text-[13px] font-bold text-white hover:bg-[#5a334c]"
                >
                  {createPlan.isPending || updatePlan.isPending ? "Saving…" : "Save plan"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {taskDialog && (
          <Modal>
            <form onSubmit={submitTask}>
              <h2 className="text-lg font-bold text-[#2D1826]">{taskDialog.mode === "create" ? "Add study task" : "Edit study task"}</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Task title
                  <input
                    required
                    value={taskTitle}
                    onChange={event => setTaskTitle(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                    autoFocus
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[13px] font-semibold text-[#724060]">
                    Schedule
                    <input
                      type="date"
                      value={taskDate}
                      onChange={event => setTaskDate(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                    />
                  </label>
                  <label className="block text-[13px] font-semibold text-[#724060]">
                    Minutes
                    <input
                      type="number"
                      min="5"
                      max="720"
                      value={minutes}
                      onChange={event => setMinutes(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                    />
                  </label>
                </div>
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Study notes <span className="font-normal text-[#A070A1]">optional</span>
                  <textarea
                    value={taskNotes}
                    onChange={event => setTaskNotes(event.target.value)}
                    className="mt-1.5 min-h-24 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] p-3 text-sm text-[#2D1826]"
                    placeholder="What should you focus on in this session?"
                  />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTaskDialog(null)}
                  className="h-10 rounded-full px-4 text-[13px] font-semibold text-[#724060] hover:bg-[#FDF3F3]"
                >
                  Cancel
                </button>
                <button
                  disabled={createItem.isPending || updateItem.isPending}
                  className="h-10 rounded-full bg-[#724060] px-5 text-[13px] font-bold text-white hover:bg-[#5a334c]"
                >
                  {createItem.isPending || updateItem.isPending ? "Saving…" : "Save task"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {(sessionTask || editingSession) && (
          <Modal>
            <form onSubmit={submitSession}>
              <h2 className="text-lg font-bold text-[#2D1826]">{editingSession ? "Edit study session" : "Log study session"}</h2>
              <p className="mt-2 text-[13px] text-[#724060]">
                {editingSession ? (
                  "Correct the date or focused time for this stored session."
                ) : (
                  <>
                    Record focused time for <strong>{sessionTask?.title}</strong>.
                  </>
                )}
              </p>
              {editingSession && (
                <label className="mt-5 block text-[13px] font-semibold text-[#724060]">
                  Session date
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={event => setSessionDate(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                  />
                </label>
              )}
              <label className="mt-5 block text-[13px] font-semibold text-[#724060]">
                Minutes studied
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={sessionMinutes}
                  onChange={event => setSessionMinutes(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826]"
                  autoFocus
                />
              </label>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSessionTask(null);
                    setEditingSession(null);
                  }}
                  className="h-10 rounded-full px-4 text-[13px] font-semibold text-[#724060] hover:bg-[#FDF3F3]"
                >
                  Cancel
                </button>
                <button
                  disabled={logSession.isPending || updateSession.isPending}
                  className="h-10 rounded-full bg-[#724060] px-5 text-[13px] font-bold text-white hover:bg-[#5a334c]"
                >
                  {logSession.isPending || updateSession.isPending ? "Saving…" : editingSession ? "Save session" : "Log session"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
      <PlannerSessionSummary plans={plans.data ?? []} onEdit={openEditSession} />
      <PlannerNotesSummary plans={plans.data ?? []} />
    </StudentAppShell>
  );
}
