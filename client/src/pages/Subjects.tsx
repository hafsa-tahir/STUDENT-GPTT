import { SubjectActivityModal } from "@/components/SubjectActivityModal";
import { SubjectOrganizationPanel } from "@/components/SubjectOrganizationPanel";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Layers3,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  X,
  Zap
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

type SubjectForm = { name: string; description: string; color: string };
const emptySubject: SubjectForm = { name: "", description: "", color: "#724060" };

export default function Subjects() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const subjectsQuery = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const createSubject = trpc.academic.createSubject.useMutation({
    onSuccess: () => utils.academic.listSubjects.invalidate()
  });
  const updateSubject = trpc.academic.updateSubject.useMutation({
    onSuccess: () => utils.academic.listSubjects.invalidate()
  });
  const deleteSubject = trpc.academic.deleteSubject.useMutation({
    onSuccess: () => utils.academic.listSubjects.invalidate()
  });

  const [editing, setEditing] = useState<number | "new" | null>(search.includes("create=1") ? "new" : null);
  const [form, setForm] = useState<SubjectForm>(emptySubject);
  const [organizingId, setOrganizingId] = useState<number | null>(null);
  const [activeHubSubjectId, setActiveHubSubjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const organizingSubject = useMemo(
    () => subjectsQuery.data?.find(subject => subject.id === organizingId) ?? null,
    [organizingId, subjectsQuery.data]
  );

  const activeHubSubject = useMemo(
    () => subjectsQuery.data?.find(subject => subject.id === activeHubSubjectId) ?? null,
    [activeHubSubjectId, subjectsQuery.data]
  );

  // Check URL params for create or subjectId
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("create") === "1") {
      setEditing("new");
    }
    const sub = params.get("subjectId");
    if (sub) {
      setActiveHubSubjectId(Number(sub));
    }
  }, [search]);

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  function openNew() {
    setForm(emptySubject);
    setError(null);
    setEditing("new");
  }

  function openEdit(subject: NonNullable<typeof subjectsQuery.data>[number]) {
    setForm({ name: subject.name, description: subject.description ?? "", color: subject.color });
    setError(null);
    setEditing(subject.id);
  }

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editing === "new") await createSubject.mutateAsync(form);
      if (typeof editing === "number") await updateSubject.mutateAsync({ id: editing, data: form });
      setEditing(null);
      setLocation("/subjects");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save this subject.");
    }
  }

  const subjectCards = subjectsQuery.data?.length ? (
    <>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {subjectsQuery.data.map(subject => (
          <article
            key={subject.id}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(114,64,96,0.12)] ${
              activeHubSubjectId === subject.id || organizingId === subject.id
                ? "border-[#724060] ring-2 ring-[#724060]/20"
                : "border-[#F8E7E7]"
            }`}
          >
            {/* Top Color Accent Strip */}
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: subject.color || "#724060" }}
            />

            <div>
              {/* Header with icon and action buttons */}
              <div className="flex items-start justify-between">
                <span
                  className="grid h-11 w-11 place-items-center rounded-2xl shadow-xs"
                  style={{
                    backgroundColor: `${subject.color}18`,
                    color: subject.color || "#724060"
                  }}
                >
                  <BookOpen className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      openEdit(subject);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl text-[#724060] hover:bg-[#FDF3F3] transition"
                    aria-label={`Edit ${subject.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Delete ${subject.name}? This will also remove its associated records.`
                        )
                      ) {
                        deleteSubject.mutate({ id: subject.id });
                      }
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl text-[#A070A1] hover:bg-[#F8E7E7] hover:text-[#724060] transition"
                    aria-label={`Delete ${subject.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Subject Title & Description — Clicking opens Activity Hub */}
              <div
                onClick={() => setActiveHubSubjectId(subject.id)}
                className="mt-5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] font-bold tracking-tight text-[#724060] group-hover:text-[#5a334c] transition">
                    {subject.name}
                  </h2>
                  <ArrowRight className="h-4 w-4 text-[#A070A1] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="mt-2 min-h-11 text-[13px] leading-relaxed text-[#724060]/75 line-clamp-2">
                  {subject.description || "Open to view notes, quizzes, research papers, and study history."}
                </p>
              </div>
            </div>

            {/* Quick Actions & Links */}
            <div className="mt-6 border-t border-[#F8E7E7] pt-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveHubSubjectId(subject.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FDF3F3] px-3 py-1.5 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#A070A1]" />
                  <span>Activity Hub</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrganizingId(organizingId === subject.id ? null : subject.id)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#A070A1] hover:text-[#724060] transition"
                >
                  <Layers3 className="h-3.5 w-3.5" />
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
    <div className="mt-8 rounded-2xl border border-dashed border-[#A070A1]/40 bg-white px-6 py-16 text-center shadow-xs">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F8E7E7] text-[#724060]">
        <BookOpen className="h-5 w-5" />
      </span>
      <h2 className="mt-5 text-[18px] font-bold text-[#724060]">
        Your academic workspace starts here
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#724060]/75">
        Create a subject to give your notes, quizzes, research papers, and study time a unified home.
      </p>
      <button
        onClick={openNew}
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#5a334c] transition"
      >
        <Plus className="h-4 w-4" /> Create your first subject
      </button>
    </div>
  );

  return (
    <StudentAppShell>
      <div className="mx-auto max-w-[1280px] p-5 sm:p-8 lg:p-10">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
              Academic workspace
            </p>
            <h1 className="mt-1 text-[32px] font-bold tracking-tight text-[#724060]">
              Subjects & Learning Spaces
            </h1>
            <p className="mt-2 text-sm text-[#724060]/80">
              Click any subject to open its complete study hub: notes, quizzes, research papers, and recorded hours.
            </p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-4 text-[13px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition"
          >
            <Plus className="h-4 w-4" /> New subject
          </button>
        </header>

        {subjectsQuery.isLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-[24px] bg-white border border-[#F8E7E7]" />
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
            className="fixed inset-0 z-50 grid place-items-center bg-[#724060]/25 p-4 backdrop-blur-sm"
          >
            <form
              onSubmit={saveSubject}
              className="w-full max-w-[460px] rounded-[24px] bg-white p-6 shadow-[0_20px_60px_rgba(20,23,32,.22)] border border-[#F8E7E7]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#724060]">
                    {editing === "new" ? "Create subject" : "Edit subject"}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#A070A1]">
                    Keep it recognisable and easy to return to.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#724060] hover:bg-[#FDF3F3]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-[#F8E7E7] px-3 py-2 text-[13px] text-[#724060]">
                  {error}
                </p>
              )}

              <div className="mt-5 space-y-4">
                <label className="block text-[13px] font-semibold text-[#724060]">
                  Subject name
                  <input
                    value={form.name}
                    onChange={event => setForm({ ...form, name: event.target.value })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm text-[#724060] outline-none focus:border-[#A070A1]"
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
                    onChange={event => setForm({ ...form, description: event.target.value })}
                    placeholder="Course objectives, semester topics, or exam goals"
                    className="mt-1.5 min-h-24 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] p-3 text-sm text-[#724060] outline-none focus:border-[#A070A1]"
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
                  className="h-10 rounded-xl px-4 text-[13px] font-semibold text-[#724060] hover:bg-[#FDF3F3]"
                >
                  Cancel
                </button>
                <button
                  disabled={createSubject.isPending || updateSubject.isPending}
                  className="h-10 rounded-xl bg-[#724060] px-4 text-[13px] font-semibold text-white hover:bg-[#5a334c] disabled:opacity-60"
                >
                  {createSubject.isPending || updateSubject.isPending ? "Saving…" : "Save subject"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </StudentAppShell>
  );
}
