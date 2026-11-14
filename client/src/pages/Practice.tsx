import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { MathRenderer } from "@/components/MathRenderer";
import { AiSynthesisLoader } from "@/components/MicroInteractions";
import { PracticeHistory } from "@/components/PracticeHistory";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  Sparkles,
  Trophy,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

export default function Practice() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<"quiz" | "flashcards">("quiz");
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [scopeType, setScopeType] = useState<
    "topic" | "chapter" | "section" | "range" | "document"
  >("topic");
  const [scopeLabel, setScopeLabel] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [quiz, setQuiz] = useState<Awaited<ReturnType<typeof generatePlaceholder>> | null>(
    null
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; totalQuestions: number } | null>(
    null
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = trpc.flashcards.list.useQuery(undefined, { enabled: Boolean(user) });
  const subjects = trpc.academic.listSubjects.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const documents = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });

  const subjectMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>();
    subjects.data?.forEach(s => map.set(s.id, { name: s.name, color: s.color }));
    return map;
  }, [subjects.data]);

  const generateQuiz = trpc.quizzes.generate.useMutation({
    onError: caught => setError(caught.message),
  });
  const submitQuiz = trpc.quizzes.submit.useMutation({
    onSuccess: data =>
      setResult({ score: data.score, totalQuestions: data.totalQuestions }),
    onError: caught => setError(caught.message),
  });
  const generateCards = trpc.flashcards.generate.useMutation({
    onSuccess: () => {
      utils.flashcards.list.invalidate();
      setCardIndex(0);
      setRevealed(false);
    },
    onError: caught => setError(caught.message),
  });
  const review = trpc.flashcards.review.useMutation({
    onSuccess: () => {
      setCardIndex(index =>
        Math.min(index + 1, Math.max(0, (cards.data?.length ?? 1) - 1))
      );
      setRevealed(false);
    },
  });

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) setSubjectId(sub);
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
        difficulty,
      });
      setQuiz(generated as unknown as Awaited<ReturnType<typeof generatePlaceholder>>);
      setAnswers({});
    } catch { }
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
        scopeLabel: scope,
      });
    } catch { }
  }

  function submitAnswers() {
    if (!quiz) return;
    submitQuiz.mutate({
      quizId: quiz.quiz.id,
      answers: Object.entries(answers).map(([questionId, answer]) => ({
        questionId: Number(questionId),
        answer,
      })),
    });
  }

  const activeCard = cards.data?.[cardIndex];

  return (
    <StudentAppShell>
      <div className="mx-auto max-w-[1280px] p-4 sm:p-7 lg:p-9">
        {/* Hero Header with MicroKit Sliding Content Tabs */}
        <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-6 py-7 text-white shadow-[0_18px_40px_rgba(114,64,96,0.22)] sm:px-9">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#F8E7E7]">
                <Sparkles className="h-3.5 w-3.5" /> Active Recall & Spaced Repetition
              </div>
              <h1 className="mt-2.5 text-[28px] font-bold tracking-tight sm:text-[36px]">
                Practice Studio
              </h1>
              <p className="mt-1.5 max-w-xl text-[13.5px] text-[#F8E7E7]/85">
                Generate scoped multiple-choice quizzes or review 3D stacked flashcards with LaTeX math and step-by-step rationales.
              </p>
            </div>

            {/* MicroKit Sliding Tab Switcher */}
            <div className="inline-flex rounded-full bg-black/25 p-1 backdrop-blur-xs">
              {(
                [
                  ["quiz", "Quiz & Assessment", BrainCircuit],
                  ["flashcards", `3D Flashcards (${cards.data?.length ?? 0})`, Layers3],
                ] as const
              ).map(([key, label, Icon]) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors ${isActive ? "text-[#2D1826]" : "text-[#F8E7E7]/85 hover:text-white"
                      }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="practice-tab-glide"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-white shadow-sm"
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" />
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-medium text-rose-800">
            {error}
          </p>
        )}

        <PracticeHistory />

        {/* Generator Control Bar */}
        <section className="mt-5 min-w-0 max-w-full overflow-hidden rounded-[24px] sm:rounded-[26px] border border-[#724060]/12 bg-white p-4 sm:p-6 shadow-[0_12px_30px_rgba(114,64,96,0.06)]">
          <form onSubmit={tab === "quiz" ? createQuiz : createCards}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_.85fr_.9fr_.7fr_.85fr]">
              <input
                value={topic}
                onChange={event => setTopic(event.target.value)}
                placeholder="Topic or concept you want to practice…"
                className="h-11 w-full min-w-0 max-w-full sm:col-span-2 lg:col-span-1 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 text-sm text-[#2D1826] outline-none focus:border-[#724060]"
                required
              />
              <select
                value={subjectId}
                onChange={event => setSubjectId(event.target.value)}
                className="h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[12.5px] font-medium text-[#724060]"
              >
                <option value="">No subject selected</option>
                {subjects.data?.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                value={documentId}
                onChange={event => {
                  const docId = event.target.value;
                  setDocumentId(docId);
                  const found = documents.data?.find(d => String(d.id) === docId);
                  if (found?.subjectId) setSubjectId(String(found.subjectId));
                }}
                className="h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[12.5px] font-medium text-[#724060]"
              >
                <option value="">Topic only (No PDF)</option>
                {documents.data?.map(document => (
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
                onChange={event => setScopeType(event.target.value as typeof scopeType)}
                className="h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[12.5px] font-medium text-[#724060]"
              >
                <option value="topic">Topic</option>
                <option value="chapter">Chapter</option>
                <option value="section">Section</option>
                <option value="range">Range</option>
                <option value="document">Complete PDF</option>
              </select>
              <input
                value={scopeLabel}
                onChange={event => setScopeLabel(event.target.value)}
                placeholder={
                  scopeType === "chapter"
                    ? "e.g. Chapter 6"
                    : scopeType === "document"
                      ? "Whole PDF"
                      : "Exact scope"
                }
                className="h-11 w-full min-w-0 max-w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 text-sm text-[#2D1826] outline-none focus:border-[#724060]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F8E7E7] pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {tab === "quiz" && (
                  <>
                    <label className="flex h-10 items-center gap-2 rounded-full border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 text-[12px] font-semibold text-[#724060]">
                      Questions
                      <input
                        type="number"
                        min="3"
                        max="15"
                        value={questionCount}
                        onChange={event => setQuestionCount(event.target.value)}
                        className="w-10 bg-transparent text-center font-bold text-[#2D1826] outline-none"
                      />
                    </label>
                    <div className="inline-flex rounded-full bg-[#FDF3F3] p-1">
                      {(["easy", "medium", "hard"] as const).map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`rounded-full px-3 py-1 text-[11.5px] font-bold capitalize transition ${difficulty === level
                            ? "bg-[#724060] text-white shadow-2xs"
                            : "text-[#724060]/75 hover:text-[#2D1826]"
                            }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                disabled={generateQuiz.isPending || generateCards.isPending}
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2D1826] via-[#724060] to-[#4A263D] px-6 text-[13px] font-bold text-white shadow-[0_6px_20px_rgba(114,64,96,0.25)] transition hover:scale-[1.01] disabled:opacity-50"
              >
                {tab === "quiz" ? (
                  <BrainCircuit className="h-4 w-4" />
                ) : (
                  <Layers3 className="h-4 w-4" />
                )}
                {generateQuiz.isPending || generateCards.isPending
                  ? "Synthesizing Questions & Formulas…"
                  : tab === "quiz"
                    ? "Generate Scoped Quiz"
                    : "Generate 3D Flashcards"}
              </button>
            </div>
          </form>
        </section>

        {(generateQuiz.isPending || generateCards.isPending) && (
          <div className="mt-5">
            <AiSynthesisLoader
              title={
                tab === "quiz"
                  ? "Synthesizing Scoped Assessment Quiz…"
                  : "Building 3D Spaced Repetition Flashcard Deck…"
              }
            />
          </div>
        )}

        {/* QUIZ TAB */}
        {tab === "quiz" && (
          <section className="mt-5">
            {quiz ? (
              <div className="rounded-[26px] border border-[#724060]/12 bg-white p-5 sm:p-7 shadow-[0_12px_30px_rgba(114,64,96,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F8E7E7] pb-5">
                  <div>
                    <h2 className="text-[20px] font-bold text-[#2D1826]">
                      {quiz.quiz.title}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-[#724060]/75">
                      {quiz.questions.length} questions ·{" "}
                      <span className="capitalize">{quiz.quiz.difficulty}</span> difficulty
                    </p>
                  </div>
                  {result && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#724060] px-4 py-2 text-[14px] font-bold text-white shadow-sm">
                      <Trophy className="h-4 w-4 text-amber-300" />
                      <span>
                        Score: {result.score} / {result.totalQuestions} (
                        {Math.round((result.score / result.totalQuestions) * 100)}%)
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-6">
                  {quiz.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3]/50 p-5"
                    >
                      <div className="flex items-start gap-2.5 text-[14.5px] font-bold text-[#2D1826]">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#724060] text-[11px] font-bold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <MathRenderer content={question.prompt} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2.5">
                        {(question.options as string[]).map(option => {
                          const selected = answers[question.id] === option;
                          return (
                            <label
                              key={option}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-[13px] transition ${selected
                                ? "border-[#724060] bg-[#F8E7E7] font-semibold text-[#2D1826] shadow-2xs"
                                : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3] text-[#724060]"
                                }`}
                            >
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                checked={selected}
                                onChange={() =>
                                  setAnswers({ ...answers, [question.id]: option })
                                }
                                className="accent-[#724060]"
                              />
                              <div className="min-w-0 flex-1">
                                <MathRenderer content={option} inline={true} />
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {result && (
                        <div className="mt-4 rounded-xl border border-[#724060]/20 bg-white p-4 text-[13px] leading-6 text-[#724060]">
                          <p className="flex items-center gap-1.5 font-bold text-[#2D1826]">
                            Correct Answer:{" "}
                            <MathRenderer content={question.correctAnswer} inline={true} />
                          </p>
                          <div className="mt-2 text-[12.5px] leading-5 text-[#724060]">
                            <span className="font-semibold text-[#2D1826]">
                              Explanation:{" "}
                            </span>
                            <MathRenderer content={question.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={submitAnswers}
                  disabled={
                    submitQuiz.isPending ||
                    Object.keys(answers).length !== quiz.questions.length
                  }
                  className="mt-7 h-11 rounded-full bg-[#724060] px-7 text-[13px] font-bold text-white shadow-md transition hover:bg-[#5b324c] disabled:opacity-50"
                >
                  {submitQuiz.isPending ? "Scoring Assessment…" : "Submit & Score Quiz"}
                </button>
              </div>
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-[#724060]/25 bg-white px-6 py-12 text-center shadow-xs">
                <div className="mx-auto w-60 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
                  <img
                    src="/illustrations/flashcards-quiz-3d.jpg"
                    alt="3D Quiz and Flashcards"
                    className="h-36 w-full object-cover"
                  />
                </div>
                <h2 className="mt-4 text-[18px] font-bold text-[#2D1826]">
                  Active Recall & Formula Self-Assessment
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-[#724060]/75">
                  Enter a topic or pick an uploaded PDF above. StudentGPT will generate scored multiple-choice questions with rendered LaTeX equations and step-by-step rationales.
                </p>
              </div>
            )}
          </section>
        )}

        {/* FLASHCARDS TAB — Bencho 3D Card Stack */}
        {tab === "flashcards" && (
          <section className="mt-5">
            {cards.isLoading ? (
              <div className="rounded-[26px] bg-white p-8 text-sm text-[#724060]">
                Loading flashcards…
              </div>
            ) : activeCard ? (
              <div className="rounded-[28px] border border-[#724060]/12 bg-white p-4 sm:p-8 shadow-[0_14px_34px_rgba(114,64,96,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[#724060]">
                  <span className="font-bold text-[#2D1826]">
                    Card {cardIndex + 1} of {cards.data?.length}
                  </span>
                  <span className="rounded-full bg-[#FDF3F3] px-3 py-1 text-[11px] sm:text-[11.5px] font-bold text-[#724060]">
                    Bencho 3D Spaced Repetition Stack
                  </span>
                </div>

                {/* Bencho 3D Layered Card Stack */}
                <div className="relative mx-auto mt-5 sm:mt-6 max-w-2xl pb-6">
                  <div className="pointer-events-none absolute inset-x-6 sm:inset-x-10 -bottom-1 h-44 sm:h-48 rounded-[26px] bg-[#522943] opacity-75 shadow-md" />
                  <div className="pointer-events-none absolute inset-x-3 sm:inset-x-5 bottom-1.5 h-44 sm:h-48 rounded-[26px] bg-[#A070A1] opacity-85 shadow-md" />

                  <motion.button
                    key={`${activeCard.id}-${revealed}`}
                    initial={{ y: 8, scale: 0.98, opacity: 0.8 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    onClick={() => setRevealed(!revealed)}
                    className="relative flex min-h-[220px] sm:min-h-[260px] w-full flex-col items-center justify-center rounded-[26px] border-2 border-[#724060]/20 bg-[#FDF3F3] p-5 sm:p-8 text-center shadow-[0_14px_35px_rgba(114,64,96,0.12)] transition hover:bg-white cursor-pointer"
                  >
                    <span className="mb-3 rounded-full bg-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A070A1] shadow-2xs">
                      {revealed ? "Answer & Explanation" : "Question Prompt"}
                    </span>
                    <div className="max-w-xl text-[16px] sm:text-[21px] font-bold leading-relaxed text-[#2D1826]">
                      <MathRenderer
                        content={revealed ? activeCard.back : activeCard.front}
                      />
                    </div>
                    <span className="mt-5 sm:mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#724060] px-4 py-1.5 text-[12px] font-semibold text-white shadow-xs">
                      <Eye className="h-3.5 w-3.5" />
                      {revealed ? "Flip Back to Question" : "Tap Card to Reveal Answer"}
                    </span>
                  </motion.button>
                </div>

                {/* Spaced Repetition Outcome Buttons */}
                <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      ["again", "Again", "bg-rose-50 text-rose-700 border-rose-200"],
                      ["hard", "Hard", "bg-[#FDF3F3] text-[#724060] border-[#F8E7E7]"],
                      ["good", "Good", "bg-[#F8E7E7] text-[#2D1826] border-[#724060]/20"],
                      ["easy", "Easy ✓", "bg-[#724060] text-white border-[#724060]"],
                    ] as const
                  ).map(([outcome, label, tone]) => (
                    <button
                      key={outcome}
                      onClick={() =>
                        review.mutate({ flashcardId: activeCard.id, outcome })
                      }
                      className={`h-10 rounded-full border text-[12.5px] font-bold transition hover:scale-[1.02] ${tone}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex justify-between border-t border-[#F8E7E7] pt-4">
                  <button
                    onClick={() => {
                      setCardIndex(Math.max(0, cardIndex - 1));
                      setRevealed(false);
                    }}
                    disabled={cardIndex === 0}
                    className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12.5px] font-semibold text-[#724060] hover:bg-[#FDF3F3] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    onClick={() => {
                      setCardIndex(
                        Math.min((cards.data?.length ?? 1) - 1, cardIndex + 1)
                      );
                      setRevealed(false);
                    }}
                    disabled={cardIndex >= (cards.data?.length ?? 1) - 1}
                    className="inline-flex items-center gap-1 rounded-full bg-[#2D1826] px-5 py-1.5 text-[12.5px] font-semibold text-white shadow-xs hover:bg-[#724060] disabled:opacity-40"
                  >
                    Next Card <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-[#724060]/25 bg-white px-6 py-12 text-center shadow-xs">
                <div className="mx-auto w-60 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
                  <img
                    src="/illustrations/flashcards-quiz-3d.jpg"
                    alt="3D Flashcards Stack"
                    className="h-36 w-full object-cover"
                  />
                </div>
                <h2 className="mt-4 text-[18px] font-bold text-[#2D1826]">
                  Build a 3D Spaced Repetition Deck
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-[#724060]/75">
                  Generate flashcards from your topics or uploaded PDFs, complete with formulas, definitions, and active-recall scheduling.
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
    }>,
  };
}
