import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { PracticeHistory } from "@/components/PracticeHistory";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { BrainCircuit, ChevronLeft, ChevronRight, Eye, Layers3 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MathRenderer } from "@/components/MathRenderer";

export default function Practice() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<"quiz" | "flashcards">("quiz");
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [scopeType, setScopeType] = useState<"topic" | "chapter" | "section" | "range" | "document">("topic");
  const [scopeLabel, setScopeLabel] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [quiz, setQuiz] = useState<Awaited<ReturnType<typeof generatePlaceholder>> | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; totalQuestions: number } | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = trpc.flashcards.list.useQuery(undefined, { enabled: Boolean(user) });
  const subjects = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const documents = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });

  const subjectMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>();
    subjects.data?.forEach(s => map.set(s.id, { name: s.name, color: s.color }));
    return map;
  }, [subjects.data]);

  const generateQuiz = trpc.quizzes.generate.useMutation({
    onError: (caught) => setError(caught.message)
  });
  const submitQuiz = trpc.quizzes.submit.useMutation({
    onSuccess: (data) => setResult({ score: data.score, totalQuestions: data.totalQuestions }),
    onError: (caught) => setError(caught.message)
  });
  const generateCards = trpc.flashcards.generate.useMutation({
    onSuccess: () => {
      utils.flashcards.list.invalidate();
      setCardIndex(0);
      setRevealed(false);
    },
    onError: (caught) => setError(caught.message)
  });
  const review = trpc.flashcards.review.useMutation({
    onSuccess: () => {
      setCardIndex((index) => Math.min(index + 1, Math.max(0, (cards.data?.length ?? 1) - 1)));
      setRevealed(false);
    }
  });

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) {
      setSubjectId(sub);
    }
  }, [search]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  async function createQuiz(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const scope = scopeLabel.trim() || topic.trim();
    try {
      const generated = await generateQuiz.mutateAsync({
        title: `${scope} practice`,
        topic,
        subjectId: subjectId ? Number(subjectId) : null,
        documentId: documentId ? Number(documentId) : null,
        scopeType,
        scopeLabel: scope,
        questionCount: Math.max(3, Math.min(15, Number(questionCount) || 5)),
        difficulty
      });
      setQuiz(generated as unknown as Awaited<ReturnType<typeof generatePlaceholder>>);
      setAnswers({});
    } catch {}
  }

  async function createCards(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const scope = scopeLabel.trim() || topic.trim();
    try {
      await generateCards.mutateAsync({
        topic,
        subjectId: subjectId ? Number(subjectId) : null,
        documentId: documentId ? Number(documentId) : null,
        scopeType,
        scopeLabel: scope
      });
    } catch {}
  }

  function submitAnswers() {
    if (!quiz) return;
    submitQuiz.mutate({
      quizId: quiz.quiz.id,
      answers: Object.entries(answers).map(([questionId, answer]) => ({
        questionId: Number(questionId),
        answer
      }))
    });
  }

  const activeCard = cards.data?.[cardIndex];

  return (
    <StudentAppShell>
      <div className="mx-auto max-w-[1100px] p-5 sm:p-8 lg:p-10">
        <header>
          <p className="text-[13px] font-medium text-[#724060]">Academic workspace</p>
          <h1 className="mt-1 text-[30px] font-semibold tracking-[-.045em] text-[#724060]">Practice studio</h1>
          <p className="mt-2 text-sm text-[#724060]">Generate active-recall exercises from a topic you are actually studying.</p>
        </header>

        <div className="mt-7 flex gap-2 border-b border-black/[.08]">
          <button
            onClick={() => setTab("quiz")}
            className={`border-b-2 px-3 py-3 text-[13px] font-medium transition ${
              tab === "quiz" ? "border-[#A070A1] text-[#A070A1]" : "border-transparent text-[#724060]"
            }`}
          >
            Quiz & Self-Assessment
          </button>
          <button
            onClick={() => setTab("flashcards")}
            className={`border-b-2 px-3 py-3 text-[13px] font-medium transition ${
              tab === "flashcards" ? "border-[#A070A1] text-[#A070A1]" : "border-transparent text-[#724060]"
            }`}
          >
            Spaced Flashcards
          </button>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl bg-[#F8E7E7] p-3 text-[13px] text-[#A070A1]">{error}</p>}
        <PracticeHistory />

        <section className="mt-6 rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-5 sm:p-6 shadow-xs">
          <form onSubmit={tab === "quiz" ? createQuiz : createCards}>
            <div className="grid gap-3 lg:grid-cols-[1.2fr_.85fr_.9fr_.7fr_.85fr]">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Topic or subject you want to practise"
                className="h-11 min-w-0 rounded-xl border border-black/[.11] bg-white px-3 text-sm outline-none focus:border-[#A070A1]"
                required
              />
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="h-11 rounded-xl border border-black/[.11] bg-white px-3 text-[12px] text-[#724060]"
              >
                <option value="">No subject selected</option>
                {subjects.data?.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                value={documentId}
                onChange={(event) => {
                  const docId = event.target.value;
                  setDocumentId(docId);
                  const found = documents.data?.find(d => String(d.id) === docId);
                  if (found?.subjectId) {
                    setSubjectId(String(found.subjectId));
                  }
                }}
                className="h-11 rounded-xl border border-black/[.11] bg-white px-3 text-[12px] text-[#724060]"
              >
                <option value="">Topic only</option>
                {documents.data?.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.subjectId && subjectMap.get(document.subjectId)
                      ? `[${subjectMap.get(document.subjectId)!.name}] `
                      : ""}
                    {document.originalName}
                  </option>
                ))}
              </select>
              <select
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value as typeof scopeType)}
                className="h-11 rounded-xl border border-black/[.11] bg-white px-3 text-[12px] text-[#724060]"
              >
                <option value="topic">Topic</option>
                <option value="chapter">Chapter</option>
                <option value="section">Section</option>
                <option value="range">Range</option>
                <option value="document">Complete book</option>
              </select>
              <input
                value={scopeLabel}
                onChange={(event) => setScopeLabel(event.target.value)}
                placeholder={scopeType === "chapter" ? "e.g. Chapter 6" : scopeType === "document" ? "Whole book" : "Exact scope"}
                className="h-11 min-w-0 rounded-xl border border-black/[.11] bg-white px-3 text-sm outline-none focus:border-[#A070A1]"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {tab === "quiz" && (
                <>
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-black/[.08] bg-white px-3 text-[12px] text-[#724060]">
                    MCQs
                    <input
                      type="number"
                      min="3"
                      max="15"
                      value={questionCount}
                      onChange={(event) => setQuestionCount(event.target.value)}
                      className="w-12 bg-transparent text-center outline-none"
                    />
                  </label>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
                    className="h-10 rounded-xl border border-black/[.11] bg-white px-3 text-[12px] text-[#724060]"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </>
              )}
              <button
                disabled={generateQuiz.isPending || generateCards.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-semibold text-[#FDF3F3] shadow-xs transition hover:bg-[#5b324c] disabled:opacity-50"
              >
                {tab === "quiz" ? <BrainCircuit className="h-4 w-4" /> : <Layers3 className="h-4 w-4" />}
                {generateQuiz.isPending || generateCards.isPending
                  ? "Generating Questions & Formulas…"
                  : tab === "quiz"
                    ? "Generate Scoped Quiz"
                    : "Generate Scoped Cards"}
              </button>
            </div>
          </form>
        </section>

        {tab === "quiz" && (
          <section className="mt-5">
            {quiz ? (
              <div className="rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-5 sm:p-7 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#724060]">{quiz.quiz.title}</h2>
                    <p className="mt-1 text-[12px] text-[#724060]">
                      {quiz.questions.length} questions · {quiz.quiz.difficulty} difficulty
                    </p>
                  </div>
                  {result && (
                    <span className="rounded-xl bg-[#F8E7E7] px-3.5 py-2 text-[14px] font-bold text-[#A070A1] shadow-xs">
                      Score: {result.score} / {result.totalQuestions}
                    </span>
                  )}
                </div>

                <div className="mt-7 space-y-7">
                  {quiz.questions.map((question, index) => (
                    <div key={question.id} className="rounded-2xl border border-[#F8E7E7] bg-white p-5 shadow-xs">
                      <div className="text-[14px] font-semibold text-[#724060] flex items-start gap-2">
                        <span className="shrink-0 text-[#A070A1]">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <MathRenderer content={question.prompt} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2.5">
                        {(question.options as string[]).map((option) => (
                          <label
                            key={option}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-[13px] transition ${
                              answers[question.id] === option
                                ? "border-[#A070A1] bg-[#F8E7E7] font-medium text-[#724060]"
                                : "border-black/[.08] bg-[#FDF3F3]/50 hover:bg-[#F8E7E7]/60 text-[#724060]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              checked={answers[question.id] === option}
                              onChange={() => setAnswers({ ...answers, [question.id]: option })}
                              className="accent-[#724060]"
                            />
                            <div className="flex-1 min-w-0">
                              <MathRenderer content={option} inline={true} />
                            </div>
                          </label>
                        ))}
                      </div>

                      {result && (
                        <div className="mt-4 rounded-xl border border-[#A070A1]/20 bg-[#FDF3F3] p-4 text-[13px] leading-6 text-[#724060]">
                          <p className="flex items-center gap-1.5 font-bold text-[#A070A1]">
                            Correct Answer: <MathRenderer content={question.correctAnswer} inline={true} />
                          </p>
                          <div className="mt-2 text-[12.5px] leading-5 text-[#724060]">
                            <span className="font-semibold">Explanation: </span>
                            <MathRenderer content={question.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={submitAnswers}
                  disabled={submitQuiz.isPending || Object.keys(answers).length !== quiz.questions.length}
                  className="mt-7 h-11 rounded-xl bg-[#724060] px-6 text-[13px] font-semibold text-[#FDF3F3] shadow-sm transition hover:bg-[#5b324c] disabled:opacity-50"
                >
                  {submitQuiz.isPending ? "Scoring Assessment…" : "Submit & Score Quiz"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#A070A1] bg-[#FDF3F3] px-6 py-16 text-center">
                <BrainCircuit className="mx-auto h-8 w-8 text-[#A070A1]" />
                <h2 className="mt-4 text-[17px] font-semibold text-[#724060]">Active Recall & Formula Self-Assessment</h2>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#724060]">
                  Enter a topic or pick an uploaded document. StudentGPT will generate scored questions with rendered equations and thorough explanations.
                </p>
              </div>
            )}
          </section>
        )}

        {tab === "flashcards" && (
          <section className="mt-5">
            {cards.isLoading ? (
              <div className="rounded-2xl bg-[#FDF3F3] p-8 text-sm text-[#724060]">Loading flashcards…</div>
            ) : activeCard ? (
              <div className="rounded-2xl border border-[#A070A1] bg-[#FDF3F3] p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between text-[12px] text-[#724060]">
                  <span className="font-semibold">
                    Card {cardIndex + 1} of {cards.data?.length}
                  </span>
                  <span className="rounded-full bg-[#F8E7E7] px-2.5 py-0.5 font-medium text-[#A070A1]">
                    Active Spaced Repetition
                  </span>
                </div>

                <button
                  onClick={() => setRevealed(!revealed)}
                  className="mt-5 flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-[#F8E7E7] bg-white p-8 text-center shadow-xs transition hover:bg-[#FDF3F3]"
                >
                  <div className="max-w-xl text-[18px] sm:text-[20px] font-medium leading-relaxed text-[#724060]">
                    <MathRenderer content={revealed ? activeCard.back : activeCard.front} />
                  </div>
                  <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#F8E7E7] px-3 py-1 text-[12px] font-semibold text-[#A070A1]">
                    <Eye className="h-3.5 w-3.5" />
                    {revealed ? "Hide Answer" : "Reveal Answer & Derivation"}
                  </span>
                </button>

                {revealed && (
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {(["again", "hard", "good", "easy"] as const).map((outcome) => (
                      <button
                        key={outcome}
                        onClick={() => review.mutate({ flashcardId: activeCard.id, outcome })}
                        className="h-10 rounded-xl border border-black/[.08] bg-white text-[12px] font-semibold capitalize text-[#724060] shadow-2xs hover:bg-[#F8E7E7]"
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => {
                      setCardIndex(Math.max(0, cardIndex - 1));
                      setRevealed(false);
                    }}
                    disabled={cardIndex === 0}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#724060] hover:bg-[#F8E7E7] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    onClick={() => {
                      setCardIndex(Math.min((cards.data?.length ?? 1) - 1, cardIndex + 1));
                      setRevealed(false);
                    }}
                    disabled={cardIndex >= (cards.data?.length ?? 1) - 1}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#724060] px-4 py-1.5 text-[12.5px] font-semibold text-[#FDF3F3] shadow-xs hover:bg-[#5b324c] disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#A070A1] bg-[#FDF3F3] px-6 py-16 text-center">
                <Layers3 className="mx-auto h-8 w-8 text-[#A070A1]" />
                <h2 className="mt-4 text-[17px] font-semibold text-[#724060]">Build a Focused Review Set</h2>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#724060]">
                  Generate flashcards from your topics or notes, complete with formulas, definitions, and active recall outcomes.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </StudentAppShell>
  );
}

async function generatePlaceholder() {
  return {
    quiz: { id: 0, title: "", difficulty: "medium" },
    questions: [] as Array<{
      id: number;
      prompt: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>
  };
}
