import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { HoldToDeleteButton } from "@/components/HoldToDeleteButton";
import { SubjectActivityModal } from "@/components/SubjectActivityModal";
import { SubjectOrganizationPanel } from "@/components/SubjectOrganizationPanel";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Layers3, Pencil, Plus, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

type SubjectForm = {
  id?: number;
  name: string;
  description: string;
  color: string;
};

const defaultForm: SubjectForm = {
  name: "",
  description: "",
  color: "#724060",
};

export default function Subjects() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const subjectsQuery = trpc.academic.listSubjects.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [organizingId, setOrganizingId] = useState<number | null>(null);
  const [activeHubSubjectId, setActiveHubSubjectId] = useState<number | null>(null);
  const [hoveredSubjectId, setHoveredSubjectId] = useState<number | null>(null);
  const [form, setForm] = useState<SubjectForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);

  const createSubject = trpc.academic.createSubject.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.academic.listSubjects.invalidate(),
        utils.workspace.dashboard.invalidate(),
      ]);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: caught => setError(caught.message),
  });

  const updateSubject = trpc.academic.updateSubject.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.academic.listSubjects.invalidate(),
        utils.workspace.dashboard.invalidate(),
      ]);
      setEditing(null);
      setForm(defaultForm);
    },
    onError: caught => setError(caught.message),
  });

  const deleteSubject = trpc.academic.deleteSubject.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.academic.listSubjects.invalidate(),
        utils.workspace.dashboard.invalidate(),
      ]);
    },
    onError: caught => setError(caught.message),
  });

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("create") === "1") {
      setEditing("new");
      setForm(defaultForm);
    }
    const subId = params.get("subjectId");
    if (subId && !isNaN(Number(subId))) {
      setActiveHubSubjectId(Number(subId));
    }
  }, [search]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  function openNew() {
    setError(null);
    setForm(defaultForm);
    setEditing("new");
  }

  function openEdit(subject: NonNullable<typeof subjectsQuery.data>[number]) {
    setError(null);
    setForm({
      id: subject.id,
      name: subject.name,
      description: subject.description ?? "",
      color: subject.color,
    });
    setEditing(subject.id);
  }

  function saveSubject(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color,
    };
    if (editing === "new") {
      createSubject.mutate(payload);
    } else if (typeof editing === "number") {
      updateSubject.mutate({ id: editing, data: payload });
    }
  }

  const organizingSubject = subjectsQuery.data?.find(s => s.id === organizingId) ?? null;
  const activeHubSubject =
    subjectsQuery.data?.find(s => s.id === activeHubSubjectId) ?? null;

  const subjectCards = subjectsQuery.data?.length ? (
    <>
      <div className="mt-6 sm:mt-7 grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {subjectsQuery.data.map(subject => (
          <article
            key={subject.id}
            onMouseEnter={() => setHoveredSubjectId(subject.id)}
            onMouseLeave={() => setHoveredSubjectId(null)}
            className="group relative min-w-0 max-w-full overflow-hidden flex flex-col justify-between rounded-[24px] sm:rounded-[26px] border border-[#724060]/12 bg-white p-5 sm:p-6 shadow-[0_12px_28px_rgba(114,64,96,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(114,64,96,.13)]"
          >
            {hoveredSubjectId === subject.id && (
              <motion.div
                layoutId="subjects-hover-glide"
                className="pointer-events-none absolute inset-0 rounded-[26px] ring-2 ring-[#724060]/35"
              />
            )}
            <div>
              {/* Top Row: Folder Color Tab + Edit & MicroKit Hold-to-Delete */}
              <div className="flex items-start justify-between gap-4">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xs"
                  style={{ backgroundColor: subject.color || "#724060" }}
                >
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(subject)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-[#724060]/15 bg-[#FDF3F3] text-[#724060] hover:bg-[#F8E7E7] transition"
                    aria-label={`Edit ${subject.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <HoldToDeleteButton
                    compact
                    label="Hold"
                    title={`Hold to delete ${subject.name}`}
                    onConfirm={() => deleteSubject.mutate({ id: subject.id })}
                  />
                </div>
              </div>

              {/* Subject Title & Description — Clicking opens Activity Hub */}
              <div
                onClick={() => setActiveHubSubjectId(subject.id)}
                className="mt-4 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] font-bold tracking-tight text-[#2D1826] group-hover:text-[#724060] transition">
                    {subject.name}
                  </h2>
                  <ArrowRight className="h-4 w-4 text-[#724060] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="mt-1.5 min-h-10 text-[13px] leading-relaxed text-[#724060]/75 line-clamp-2">
                  {subject.description ||
                    "Open to view notes, quizzes, research papers, and study history."}
                </p>
              </div>
            </div>

            {/* Quick Actions & Links */}
            <div className="mt-5 border-t border-[#F8E7E7] pt-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveHubSubjectId(subject.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#724060] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-2xs hover:bg-[#5a334c] transition"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Open Folder Hub</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOrganizingId(organizingId === subject.id ? null : subject.id)
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-[#FDF3F3] px-3 py-1.5 text-[12px] font-semibold text-[#724060] hover:bg-[#F8E7E7] transition"
                >
                  <Layers3 className="h-3.5 w-3.5 text-[#A070A1]" />
                  <span>{organizingId === subject.id ? "Close" : "Curriculum"}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Subject Learning Hub & Activities Modal */}
      {activeHubSubject && (
        <SubjectActivityModal
          subject={activeHubSubject}
          onClose={() => setActiveHubSubjectId(null)}
          onOpenOrganizer={() => {
            setOrganizingId(activeHubSubject.id);
            setActiveHubSubjectId(null);
          }}
        />
      )}

      {/* Curriculum Organizer Drawer */}
      {organizingSubject && (
        <SubjectOrganizationPanel
          subject={organizingSubject}
          onClose={() => setOrganizingId(null)}
        />
      )}
    </>
  ) : (
    <div className="mt-8 rounded-[28px] border-2 border-dashed border-[#724060]/25 bg-white px-6 py-16 text-center shadow-xs">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FDF3F3] text-[#724060]">
        <BookOpen className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-[18px] font-bold text-[#2D1826]">
        Your academic workspace starts here
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-[#724060]/75">
        Create a subject folder to give your notes, quizzes, research papers, and study time a unified home.
      </p>
      <button
        onClick={openNew}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#724060] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-[#5a334c] transition"
      >
        <Plus className="h-4 w-4" /> Create your first subject
      </button>
    </div>
  );

  return (
    <StudentAppShell>
      <div className="mx-auto w-full max-w-[1280px] overflow-x-hidden p-3.5 sm:p-7 lg:p-9">
        {/* Hero Header */}
        <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-5 py-6 text-white shadow-[0_18px_40px_rgba(114,64,96,0.22)] sm:px-9 sm:py-7">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#F8E7E7]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> Curriculum & Subject Organizer
              </div>
              <h1 className="mt-2.5 text-[24px] font-bold tracking-tight sm:text-[36px]">
                Subjects & Learning Spaces
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] sm:text-[13.5px] text-[#F8E7E7]/85">
                Click any subject folder to open its complete study hub: notes, quizzes, research papers, and recorded hours.
              </p>
            </div>
            <button
              onClick={openNew}
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#2D1826] shadow-md transition hover:bg-[#FDF3F3] hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4 text-[#724060]" /> New Subject
            </button>
          </div>
        </header>

        {subjectsQuery.isLoading ? (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-[26px] bg-white border border-[#F8E7E7]"
              />
            ))}
          </div>
        ) : (
          subjectCards
        )}

        {/* Create / Edit Subject Dialog */}
        {editing !== null && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-[#2D1826]/35 p-4 backdrop-blur-xs"
          >
            <form
              onSubmit={saveSubject}
              className="w-full max-w-[460px] rounded-[24px] bg-white p-6 shadow-[0_24px_70px_rgba(114,64,96,.25)] border border-[#F8E7E7]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#2D1826]">
                    {editing === "new" ? "Create subject" : "Edit subject"}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#A070A1]">
                    Keep it recognisable and easy to return to.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#724060] hover:bg-[#FDF3F3]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800"
                >
                  {error}
                </p>
              )}

              <div className="mt-5 space-y-4">
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Subject name
                  <input
                    value={form.name}
                    onChange={event => setForm({ ...form, name: event.target.value })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#2D1826] outline-none focus:border-[#724060]"
                    maxLength={120}
                    placeholder="e.g. Physics, Neurobiology, Data Structures"
                    required
                    autoFocus
                  />
                </label>
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Description <span className="font-normal text-[#A070A1]">optional</span>
                  <textarea
                    value={form.description}
                    onChange={event =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Course objectives, semester topics, or exam goals"
                    className="mt-1.5 min-h-24 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] p-3 text-sm text-[#2D1826] outline-none focus:border-[#724060]"
                    maxLength={2000}
                  />
                </label>
                <label className="flex items-center gap-3 text-[13px] font-semibold text-[#724060]">
                  Colour
                  <input
                    type="color"
                    value={form.color}
                    onChange={event => setForm({ ...form, color: event.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] p-1"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-full px-4 text-[13px] font-semibold text-[#724060] hover:bg-[#FDF3F3]"
                >
                  Cancel
                </button>
                <button
                  disabled={createSubject.isPending || updateSubject.isPending}
                  className="h-10 rounded-full bg-[#724060] px-5 text-[13px] font-bold text-white hover:bg-[#5a334c] disabled:opacity-60"
                >
                  {createSubject.isPending || updateSubject.isPending
                    ? "Saving…"
                    : "Save subject"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </StudentAppShell>
  );
}
