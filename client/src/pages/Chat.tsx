import { AIChatBox } from "@/components/AIChatBox";
import { MorphCopyButton } from "@/components/MicroInteractions";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { BotMessageSquare, FileText, Plus, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

const learningModes = [
  ["teach", "Teach me"],
  ["explain", "Explain"],
  ["simplify", "Simplify"],
  ["examples", "Examples"],
  ["step_by_step", "Step-by-step"],
  ["practice", "Practice"],
  ["quiz_me", "Quiz me"],
  ["exam_prep", "Exam prep"],
] as const;

export default function Chat() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const conversations = trpc.chat.list.useQuery(undefined, { enabled: Boolean(user) });
  const documents = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mode, setMode] = useState<(typeof learningModes)[number][0]>("teach");
  const [documentId, setDocumentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = trpc.chat.get.useQuery({ conversationId: activeId ?? 0 }, { enabled: Boolean(activeId) });
  const create = trpc.chat.create.useMutation({
    onSuccess: conversation => {
      utils.chat.list.invalidate();
      setActiveId(conversation.id);
    },
  });
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setPending(null);
      utils.chat.get.invalidate({ conversationId: activeId ?? 0 });
      utils.chat.list.invalidate();
    },
    onError: caught => {
      setPending(null);
      setError(caught.message);
    },
  });
  const regenerate = trpc.chat.regenerate.useMutation({
    onSuccess: () => {
      utils.chat.get.invalidate({ conversationId: activeId ?? 0 });
    },
    onError: caught => setError(caught.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) setSubjectId(sub);
  }, [search]);

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);
  useEffect(() => {
    if (!activeId && conversations.data?.[0]) setActiveId(conversations.data[0].id);
  }, [activeId, conversations.data]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  const displayMessages = [
    ...(active.data?.messages ?? []),
    ...(pending ? [{ role: "user" as const, content: pending }] : []),
  ];

  async function startConversation() {
    setError(null);
    try {
      const conversation = await create.mutateAsync({
        learningMode: mode,
        subjectId: subjectId ? Number(subjectId) : null,
      });
      setActiveId(conversation.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a conversation.");
    }
  }

  async function sendMessage(content: string) {
    setError(null);
    let conversationId = activeId;
    try {
      if (!conversationId) {
        const conversation = await create.mutateAsync({
          learningMode: mode,
          subjectId: subjectId ? Number(subjectId) : null,
        });
        conversationId = conversation.id;
        setActiveId(conversationId);
      }
      setPending(content);
      await send.mutateAsync({
        conversationId,
        content,
        documentId: documentId ? Number(documentId) : undefined,
      });
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "Could not send your message.");
    }
  }

  return (
    <StudentAppShell>
      <div className="mx-auto flex min-h-screen w-full max-w-[1380px] overflow-x-hidden flex-col p-3.5 sm:p-7 lg:p-9">
        {/* Hero Header with MicroKit Sliding Mode Selector */}
        <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-5 py-6 text-white shadow-[0_18px_40px_rgba(114,64,96,0.22)] sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#F8E7E7]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> Grounded AI Study Tutor
              </div>
              <h1 className="mt-2 text-[23px] font-bold tracking-tight sm:text-[32px]">
                Study Chat Assistant
              </h1>
              <p className="mt-1 text-[12.5px] sm:text-[13px] text-[#F8E7E7]/85">
                Pick a pedagogical mode or attach a lecture PDF for grounded explanations.
              </p>
            </div>

            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
              {/* Document Grounding Selector */}
              <div className="inline-flex min-w-0 flex-1 sm:flex-initial items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white backdrop-blur-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#F8E7E7]" />
                <select
                  value={documentId}
                  onChange={event => setDocumentId(event.target.value)}
                  className="w-full min-w-0 max-w-[190px] truncate bg-transparent text-[12px] font-semibold text-white outline-none [&>option]:text-[#2D1826]"
                >
                  <option value="">No PDF attached</option>
                  {documents.data?.map(document => (
                    <option key={document.id} value={document.id}>
                      {document.originalName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={startConversation}
                disabled={create.isPending}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-bold text-[#2D1826] shadow-md transition hover:bg-[#FDF3F3] hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4 text-[#724060]" /> New Chat
              </button>
            </div>
          </div>

          {/* MicroKit Sliding Learning Mode Pills */}
          <div className="relative mt-4 sm:mt-5 flex items-center gap-1 overflow-x-auto rounded-full bg-black/20 p-1 backdrop-blur-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {learningModes.map(([value, label]) => {
              const activeMode = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`relative rounded-full px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    activeMode ? "text-[#2D1826]" : "text-[#F8E7E7]/80 hover:text-white"
                  }`}
                >
                  {activeMode && (
                    <motion.span
                      layoutId="chat-mode-glide"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-white shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] font-medium text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 grid min-h-[520px] flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left Sidebar: Saved Conversations (Horizontal Strip on Mobile, Vertical Sidebar on Desktop) */}
          <aside className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[#724060]/12 bg-white p-3.5 shadow-[0_12px_28px_rgba(114,64,96,0.06)]">
            <div className="flex items-center justify-between border-b border-[#F8E7E7] px-2 pb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#A070A1]">
                Saved Threads
              </p>
              <span className="rounded-full bg-[#FDF3F3] px-2 py-0.5 text-[10.5px] font-bold text-[#724060]">
                {conversations.data?.length ?? 0}
              </span>
            </div>

            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[540px] lg:space-y-1.5 lg:overflow-y-auto lg:pr-1">
              {conversations.isLoading ? (
                <p className="px-2 py-3 text-[13px] text-[#724060]">Loading…</p>
              ) : conversations.data?.length ? (
                conversations.data.map(conversation => {
                  const isSelected = activeId === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setPending(null);
                        setActiveId(conversation.id);
                      }}
                      className={`min-w-[200px] shrink-0 lg:min-w-0 lg:w-full rounded-2xl px-3.5 py-2.5 lg:py-3 text-left transition ${
                        isSelected
                          ? "border border-[#724060]/25 bg-[#F8E7E7] shadow-2xs"
                          : "bg-[#FDF3F3]/60 hover:bg-[#FDF3F3]"
                      }`}
                    >
                      <p className="truncate text-[13px] font-bold text-[#2D1826]">
                        {conversation.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#724060]/75">
                        {learningModes.find(([v]) => v === conversation.learningMode)?.[1] ??
                          conversation.learningMode}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="w-full px-3 py-3 lg:py-8 text-center">
                  <div className="hidden lg:block mx-auto w-44 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-2xs">
                    <img
                      src="/illustrations/ai-tutor-socratic.svg"
                      alt="AI Study Tutor"
                      className="h-28 w-full object-cover"
                    />
                  </div>
                  <p className="lg:mt-3 text-[12px] leading-5 text-[#724060]/80">
                    Ask a question below to start a saved study thread.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Right Main Chat Area */}
          <section className="min-w-0 flex flex-col rounded-[24px] border border-[#724060]/12 bg-white p-3.5 sm:p-4 shadow-[0_12px_28px_rgba(114,64,96,0.06)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#F8E7E7] pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[#2D1826]">
                    {active.data?.conversation.title ?? "New study conversation"}
                  </p>
                  <p className="text-[11.5px] text-[#724060]/75">
                    Mode: {learningModes.find(([v]) => v === mode)?.[1]} · Saved to your account
                  </p>
                </div>
              </div>
              {active.data?.messages.some(message => message.role === "assistant") && (
                <div className="flex flex-wrap items-center gap-2">
                  <MorphCopyButton
                    text={
                      [...(active.data?.messages ?? [])]
                        .reverse()
                        .find(m => m.role === "assistant")?.content || ""
                    }
                    label="Copy Last Reply"
                  />
                  <button
                    onClick={() => activeId && regenerate.mutate({ conversationId: activeId })}
                    disabled={regenerate.isPending || send.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FDF3F3] px-3 text-[12px] font-semibold text-[#724060] hover:bg-[#F8E7E7] cursor-pointer"
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${regenerate.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              )}
            </div>

            <AIChatBox
              messages={displayMessages}
              onSendMessage={sendMessage}
              isLoading={send.isPending || regenerate.isPending}
              height="calc(100dvh - 320px)"
              placeholder="Ask about a concept, formula derivation, or practice question…"
              emptyStateMessage="Begin a focused study conversation"
              className="rounded-2xl border-[#F8E7E7] shadow-none"
            />
          </section>
        </div>
      </div>
    </StudentAppShell>
  );
}
