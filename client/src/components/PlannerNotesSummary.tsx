type Plan = { id: number; title: string; items: Array<{ id: number; title: string; notes: string | null }> };

export function PlannerNotesSummary({ plans }: { plans: Plan[] }) {
  const notes = plans.flatMap(plan => plan.items.filter(item => item.notes).map(item => ({ ...item, planTitle: plan.title }))).slice(0, 6);
  if (!notes.length) return null;
  return <section className="mx-auto mt-5 max-w-[1200px] px-5 pb-8 sm:px-8 lg:px-10"><div className="rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-5 sm:p-6"><h2 className="text-[16px] font-semibold tracking-[-.02em]">Task notes</h2><p className="mt-1 text-[13px] text-[#724060]">Notes saved with your planned study tasks.</p><div className="mt-5 space-y-3">{notes.map(note => <div key={note.id} className="rounded-xl bg-[#F8E7E7] p-4"><p className="text-[12px] font-semibold text-[#724060]">{note.planTitle} · {note.title}</p><p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-[#724060]">{note.notes}</p></div>)}</div></div></section>;
}
