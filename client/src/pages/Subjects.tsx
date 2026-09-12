import { SubjectOrganizationPanel } from "@/components/SubjectOrganizationPanel";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { BookOpen, Pencil, Plus, Trash2, X } from "lucide-react";
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
  const createSubject = trpc.academic.createSubject.useMutation({ onSuccess: () => utils.academic.listSubjects.invalidate() });
  const updateSubject = trpc.academic.updateSubject.useMutation({ onSuccess: () => utils.academic.listSubjects.invalidate() });
  const deleteSubject = trpc.academic.deleteSubject.useMutation({ onSuccess: () => utils.academic.listSubjects.invalidate() });
  const [editing, setEditing] = useState<number | "new" | null>(search.includes("create=1") ? "new" : null);
  const [form, setForm] = useState<SubjectForm>(emptySubject);
  const [organizingId, setOrganizingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const organizingSubject = useMemo(() => subjectsQuery.data?.find(subject => subject.id === organizingId) ?? null, [organizingId, subjectsQuery.data]);

  useEffect(() => { if (search.includes("create=1")) setEditing("new"); }, [search]);
  useEffect(() => { if (!loading && !authError && !user) setLocation("/login"); }, [authError, loading, setLocation, user]);
  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  function openNew() { setForm(emptySubject); setError(null); setEditing("new"); }
  function openEdit(subject: NonNullable<typeof subjectsQuery.data>[number]) {
    setForm({ name: subject.name, description: subject.description ?? "", color: subject.color });
    setError(null); setEditing(subject.id);
  }
  async function saveSubject(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      if (editing === "new") await createSubject.mutateAsync(form);
      if (typeof editing === "number") await updateSubject.mutateAsync({ id: editing, data: form });
      setEditing(null); setLocation("/subjects");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not save this subject."); }
  }

  const subjectCards = subjectsQuery.data?.length ? (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjectsQuery.data.map(subject => (
          <article key={subject.id} className={`rounded-2xl border bg-[#FDF3F3] p-5 ${organizingId === subject.id ? "border-[#A070A1] ring-2 ring-[#A070A1]/20" : "border-[#A070A1]"}`}>
            <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${subject.color}16`, color: subject.color }}><BookOpen className="h-4 w-4" /></span><div className="flex gap-1"><button onClick={() => openEdit(subject)} className="grid h-8 w-8 place-items-center rounded-lg text-[#724060] hover:bg-[#F8E7E7]" aria-label={`Edit ${subject.name}`}><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => { if (window.confirm(`Delete ${subject.name}? This also removes its courses, topics, and related records.`)) deleteSubject.mutate({ id: subject.id }); }} className="grid h-8 w-8 place-items-center rounded-lg text-[#A070A1] hover:bg-[#F8E7E7]" aria-label={`Delete ${subject.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div></div>
            <h2 className="mt-5 text-[16px] font-semibold tracking-[-.02em]">{subject.name}</h2><p className="mt-2 min-h-10 text-[13px] leading-5 text-[#724060]">{subject.description || "No description yet."}</p>
            <button onClick={() => setOrganizingId(organizingId === subject.id ? null : subject.id)} className="mt-5 text-[12px] font-medium text-[#A070A1]">{organizingId === subject.id ? "Close organization" : "Manage courses & topics"}</button>
          </article>
        ))}
      </div>
      {organizingSubject && <SubjectOrganizationPanel subject={organizingSubject} onClose={() => setOrganizingId(null)} />}
    </>
  ) : <div className="mt-8 rounded-2xl border border-dashed border-[#A070A1] bg-[#FDF3F3] px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F8E7E7] text-[#A070A1]"><BookOpen className="h-5 w-5" /></span><h2 className="mt-5 text-[17px] font-semibold">Your academic workspace starts here</h2><p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#724060]">Create a subject to give your courses, topics, notes, and future study work a coherent home.</p><button onClick={openNew} className="mt-5 text-[13px] font-medium text-[#A070A1]">Create your first subject</button></div>;

  return <StudentAppShell><div className="mx-auto max-w-[1200px] p-5 sm:p-8 lg:p-10"><header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[13px] font-medium text-[#724060]">Academic workspace</p><h1 className="mt-1 text-[30px] font-semibold tracking-[-.045em]">Subjects</h1><p className="mt-2 text-sm text-[#724060]">Build a clear structure for the work you are actually studying.</p></div><button onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-4 text-[13px] font-medium text-[#FDF3F3] hover:bg-[#724060]"><Plus className="h-4 w-4" />New subject</button></header>{subjectsQuery.isLoading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-[#FDF3F3]" />)}</div> : subjectCards}
    {editing !== null && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#724060]/25 p-4 backdrop-blur-[2px]"><form onSubmit={saveSubject} className="w-full max-w-[460px] rounded-2xl bg-[#FDF3F3] p-6 shadow-[0_20px_60px_rgba(20,23,32,.22)]"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold tracking-[-.03em]">{editing === "new" ? "Create subject" : "Edit subject"}</h2><p className="mt-1 text-[13px] text-[#724060]">Keep it recognisable and easy to return to.</p></div><button type="button" onClick={() => setEditing(null)} className="grid h-8 w-8 place-items-center rounded-lg text-[#724060] hover:bg-[#F8E7E7]" aria-label="Close"><X className="h-4 w-4" /></button></div>{error && <p role="alert" className="mt-4 rounded-xl bg-[#F8E7E7] px-3 py-2 text-[13px] text-[#A070A1]">{error}</p>}<div className="mt-5 space-y-4"><label className="block text-[13px] font-medium">Subject name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-xl border border-black/[.11] px-3 text-sm outline-none focus:border-[#A070A1] focus:ring-2 focus:ring-[#A070A1]/15" maxLength={120} required autoFocus /></label><label className="block text-[13px] font-medium">Description <span className="font-normal text-[#724060]">optional</span><textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1.5 min-h-24 w-full rounded-xl border border-black/[.11] p-3 text-sm outline-none focus:border-[#A070A1] focus:ring-2 focus:ring-[#A070A1]/15" maxLength={2000} /></label><label className="flex items-center gap-3 text-[13px] font-medium">Colour<input type="color" value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border border-black/[.11] bg-[#FDF3F3] p-1" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="h-10 rounded-xl px-4 text-[13px] font-medium text-[#724060] hover:bg-[#F8E7E7]">Cancel</button><button disabled={createSubject.isPending || updateSubject.isPending} className="h-10 rounded-xl bg-[#A070A1] px-4 text-[13px] font-medium text-[#FDF3F3] hover:bg-[#A070A1]">{createSubject.isPending || updateSubject.isPending ? "Saving…" : "Save subject"}</button></div></form></div>}
  </div></StudentAppShell>;
}
