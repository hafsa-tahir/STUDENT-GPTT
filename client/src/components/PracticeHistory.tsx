import { trpc } from "@/lib/trpc";

export function PracticeHistory() {
  const attempts = trpc.quizzes.attempts.useQuery();
  const reviews = trpc.flashcards.reviews.useQuery();
  if (attempts.isLoading || reviews.isLoading) return <section className="mt-5 rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-4 text-[12px] text-[#724060]">Loading your study history…</section>;
  if (attempts.error || reviews.error) return <section role="alert" className="mt-5 rounded-2xl bg-[#F8E7E7] p-4 text-[12px] text-[#A070A1]">Your study history could not be loaded. Please refresh and try again.</section>;
  if (!attempts.data?.length && !reviews.data?.length) return <section className="mt-5 rounded-2xl border border-dashed border-[#A070A1] bg-[#FDF3F3] p-4 text-[12px] text-[#724060]">Your scored quiz attempts and flashcard review outcomes will appear here after your first practice session.</section>;
  return <section className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-4"><p className="text-[12px] font-semibold">Recent quiz attempts</p>{attempts.data?.length ? <div className="mt-3 space-y-2">{attempts.data.slice(-3).reverse().map(attempt => <p key={attempt.id} className="text-[12px] text-[#724060]">Score {attempt.score}/{attempt.totalQuestions} · {new Date(attempt.completedAt).toLocaleDateString()}</p>)}</div> : <p className="mt-3 text-[12px] text-[#724060]">No scored attempts yet.</p>}</div><div className="rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-4"><p className="text-[12px] font-semibold">Recent card reviews</p>{reviews.data?.length ? <div className="mt-3 space-y-2">{reviews.data.slice(-3).reverse().map(review => <p key={review.id} className="text-[12px] text-[#724060]"><span className="capitalize">{review.outcome}</span> · {new Date(review.reviewedAt).toLocaleDateString()}</p>)}</div> : <p className="mt-3 text-[12px] text-[#724060]">No card reviews yet.</p>}</div></section>;
}
