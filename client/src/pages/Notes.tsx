import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  BookMarked,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileQuestion,
  FileText,
  Lightbulb,
  MessageSquare,
  NotebookPen,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  StickyNote,
  AlertTriangle,
  Eye,
  EyeOff
} from "lucide-react";
import { FormEvent, useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MathRenderer } from "@/components/MathRenderer";
import { VoiceReader } from "@/components/VoiceReader";
import { generateNotesLecture, generateRevisionLecture } from "@/lib/lectureGenerator";

type NoteContent = {
  overview?: string;
  sections?: Array<{ heading?: string; explanation?: string; bullets?: string[] }>;
  revisionReminders?: string[];
};

type RevisionQuestion = {
  question: string;
  answer?: string;
  examTrap?: string;
};

type RevisionBlock = {
  title?: string;
  focus?: string;
  coreSummary?: string;
  keyFormula?: string;
  keyTakeaways?: string[];
  questions?: Array<string | RevisionQuestion>;
  commonMistakes?: string[];
};

type RevisionContent = {
  overview?: string;
  blocks?: RevisionBlock[];
  selfCheck?: string[];
};

type QAItem = {
  id: string;
  question: string;
  answer: string;
  documentName: string;
  snippets?: Array<{ chunkIndex: number; preview: string; page?: number | null }>;
  timestamp: string;
};

const scopeOptions = ["document", "chapter", "section", "range", "topic"] as const;

function noteContent(value: unknown): NoteContent {
  return (value && typeof value === "object" ? value : {}) as NoteContent;
}

function revisionContent(value: unknown): RevisionContent {
  return (value && typeof value === "object" ? value : {}) as RevisionContent;
}

export default function Notes() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const notes = trpc.notes.list.useQuery(undefined, { enabled: Boolean(user) });
  const documents = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });
  const subjects = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const revisions = trpc.revision.list.useQuery(undefined, { enabled: Boolean(user) });

  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const detail = trpc.notes.get.useQuery(
    { noteId: selectedNote ?? 0 },
    { enabled: Boolean(selectedNote) }
  );

  const [mode, setMode] = useState<"notes" | "revision">("notes");
  const [documentId, setDocumentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [scopeType, setScopeType] = useState<(typeof scopeOptions)[number]>("document");
  const [scopeLabel, setScopeLabel] = useState("");
  const [sticky, setSticky] = useState("");
  const [stickyColor, setStickyColor] = useState("yellow");
  const [error, setError] = useState<string | null>(null);
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});

  const toggleQuestionReveal = (questionKey: string) => {
    setRevealedQuestions(prev => ({ ...prev, [questionKey]: !prev[questionKey] }));
  };

  // Grounded Document Q&A State
  const [qaInput, setQaInput] = useState("");
  const [qaHistory, setQaHistory] = useState<QAItem[]>([]);
  const askDocMutation = trpc.notes.askDocument.useMutation();

  const generateNotes = trpc.notes.generate.useMutation({
    onSuccess: data => {
      utils.notes.list.invalidate();
      setSelectedNote(data.note.id);
      setError(null);
    },
    onError: caught => setError(caught.message)
  });

  const generateRevision = trpc.revision.generate.useMutation({
    onSuccess: () => {
      utils.revision.list.invalidate();
      setError(null);
    },
    onError: caught => setError(caught.message)
  });

  const addSticky = trpc.notes.addSticky.useMutation({
    onSuccess: () => {
      if (selectedNote) utils.notes.get.invalidate({ noteId: selectedNote });
      setSticky("");
    }
  });

  // Select first ready document if none selected
  useEffect(() => {
    if (!documentId && documents.data?.length) {
      const readyDoc = documents.data.find(doc => doc.status === "ready") || documents.data[0];
      if (readyDoc) setDocumentId(String(readyDoc.id));
    }
  }, [documents.data, documentId]);

  // Sync selected note to the latest one when notes list loads
  useEffect(() => {
    if (notes.data?.length && selectedNote === null) {
      setSelectedNote(notes.data[0].id);
    }
  }, [notes.data, selectedNote]);

  const active = detail.data?.note;
  const content = noteContent(active?.content);
  const latestRevision = revisions.data?.[0];
  const revision = revisionContent(latestRevision?.content);

  const noteSpeechText = useMemo(() => {
    if (!active) return "";
    const parts: string[] = [];

    parts.push(`${active.title}.`);
    if (active.scopeType && active.scopeLabel) {
      parts.push(`Study scope: ${active.scopeType}, ${active.scopeLabel}.`);
    }

    if (content.overview) {
      parts.push(`Comprehensive Academic Overview: ${content.overview}.`);
    }

    if (content.sections?.length) {
      content.sections.forEach((sec, idx) => {
        parts.push(`Section ${idx + 1}: ${sec.heading || ""}.`);
        if (sec.explanation) {
          parts.push(`${sec.explanation}.`);
        }
        if (sec.bullets?.length) {
          parts.push(`Key points: ${sec.bullets.join(". ")}.`);
        }
      });
    }

    if (content.revisionReminders?.length) {
      parts.push(`Key Revision Reminders: ${content.revisionReminders.join(". ")}.`);
    }

    if (detail.data?.stickyNotes?.length) {
      const stickyTexts = detail.data.stickyNotes.map(s => s.content).filter(Boolean);
      if (stickyTexts.length) {
        parts.push(`Personal Notes: ${stickyTexts.join(". ")}.`);
      }
    }

    return parts.filter(Boolean).join(" ");
  }, [
    active?.id,
    active?.title,
    active?.scopeType,
    active?.scopeLabel,
    content.overview,
    content.sections,
    content.revisionReminders,
    detail.data?.stickyNotes
  ]);

  const revisionSpeechText = useMemo(() => {
    if (!latestRevision) return "";
    const parts: string[] = [];

    parts.push(`Revision Guide: ${latestRevision.title}.`);
    if (latestRevision.scopeLabel) {
      parts.push(`Scope: ${latestRevision.scopeLabel}.`);
    }

    if (revision.overview) {
      parts.push(`Overview: ${revision.overview}.`);
    }

    if (revision.blocks?.length) {
      revision.blocks.forEach((b, idx) => {
        parts.push(`Revision Block ${idx + 1}: ${b.title || ""}.`);
        if (b.focus) {
          parts.push(`Focus: ${b.focus}.`);
        }
        if (b.coreSummary) {
          parts.push(`Conceptual breakdown: ${b.coreSummary}.`);
        }
        if (b.keyFormula) {
          parts.push(`Governing formula: ${b.keyFormula}.`);
        }
        if (b.keyTakeaways?.length) {
          parts.push(`Key takeaways: ${b.keyTakeaways.join(". ")}.`);
        }
        if (b.questions?.length) {
          b.questions.forEach((rawQ, qIdx) => {
            const qObj = typeof rawQ === "string" ? { question: rawQ, answer: "", examTrap: "" } : rawQ;
            parts.push(`Practice Question ${qIdx + 1}: ${qObj.question}.`);
            if (qObj.answer) {
              parts.push(`Model Answer: ${qObj.answer}.`);
            }
            if (qObj.examTrap) {
              parts.push(`Exam trap: ${qObj.examTrap}.`);
            }
          });
        }
        if (b.commonMistakes?.length) {
          parts.push(`Common pitfalls to avoid: ${b.commonMistakes.join(". ")}.`);
        }
      });
    }

    if (revision.selfCheck?.length) {
      parts.push(`End of session self-check: ${revision.selfCheck.join(". ")}.`);
    }

    return parts.filter(Boolean).join(" ");
  }, [
    latestRevision?.id,
    latestRevision?.title,
    latestRevision?.scopeLabel,
    revision.overview,
    revision.blocks,
    revision.selfCheck
  ]);

  const noteLectureText = useMemo(() => {
    if (!active) return "";
    return generateNotesLecture(
      { title: active.title, scopeType: active.scopeType, scopeLabel: active.scopeLabel },
      content,
      detail.data?.stickyNotes
    );
  }, [
    active?.id,
    active?.title,
    active?.scopeType,
    active?.scopeLabel,
    content,
    detail.data?.stickyNotes
  ]);

  const revisionLectureText = useMemo(() => {
    if (!latestRevision) return "";
    return generateRevisionLecture(
      { title: latestRevision.title, scopeLabel: latestRevision.scopeLabel },
      revision
    );
  }, [
    latestRevision?.id,
    latestRevision?.title,
    latestRevision?.scopeLabel,
    revision
  ]);

  // Identify active document for grounded Q&A
  const currentDocId = active?.documentId || (documentId ? Number(documentId) : null);
  const currentDoc = documents.data?.find(d => d.id === currentDocId);

  // Formatting payloads
  const selectedDocObj = documents.data?.find(d => String(d.id) === documentId);
  const cleanDocTitle = selectedDocObj
    ? selectedDocObj.originalName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ")
    : "Academic Study Material";

  const isWhole =
    scopeType === "document" ||
    !scopeLabel.trim() ||
    scopeLabel.trim().toLowerCase() === "whole" ||
    scopeLabel.trim().toLowerCase().includes("complete");

  const effectiveScopeLabel = isWhole ? "Complete Document" : scopeLabel.trim();

  const payloadTitle = selectedDocObj
    ? `${cleanDocTitle} — ${isWhole ? (mode === "notes" ? "Comprehensive Study Notes" : "Revision Guide") : effectiveScopeLabel}`
    : `${mode === "notes" ? "Notes" : "Revision"}: ${effectiveScopeLabel}`;

  const payload = {
    title: payloadTitle,
    topic: documentId ? null : effectiveScopeLabel,
    subjectId: subjectId ? Number(subjectId) : null,
    documentId: documentId ? Number(documentId) : null,
    scopeType,
    scopeLabel: effectiveScopeLabel
  };

  async function generate() {
    setError(null);
    try {
      if (mode === "notes") {
        await generateNotes.mutateAsync(payload);
      } else {
        await generateRevision.mutateAsync(payload);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate the study material.");
    }
  }

  async function saveSticky(event: FormEvent) {
    event.preventDefault();
    if (!selectedNote || !sticky.trim()) return;
    try {
      await addSticky.mutateAsync({
        studyNoteId: selectedNote,
        content: sticky,
        color: stickyColor as "yellow" | "mint" | "lavender" | "peach"
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the sticky note.");
    }
  }

  async function handleAskDocument(questionText?: string) {
    const q = (questionText || qaInput).trim();
    if (!q) return;
    if (!currentDocId) {
      setError("Please select an uploaded document first to ask questions.");
      return;
    }

    try {
      const res = await askDocMutation.mutateAsync({
        documentId: currentDocId,
        question: q,
        studyNoteId: selectedNote || undefined
      });

      const newQA: QAItem = {
        id: String(Date.now()),
        question: q,
        answer: res.answer,
        documentName: res.documentName,
        snippets: res.relevantSnippets,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setQaHistory(prev => [newQA, ...prev]);
      setQaInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to query the document.");
    }
  }

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;

  return (
    <StudentAppShell>
      <div className="min-h-screen bg-[#FDF3F3] px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          {/* Header Banner */}
          <header className="rounded-[28px] bg-[#724060] px-6 py-8 text-[#FDF3F3] shadow-[0_16px_40px_rgba(114,64,96,0.2)] sm:px-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#A070A1]/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F8E7E7]">
                  <Sparkles className="h-3 w-3" /> Notes & Revision Studio
                </div>
                <h1 className="mt-3 text-[32px] font-bold tracking-tight sm:text-[42px]">
                  Turn any document into structured, exhaustive notes.
                </h1>
                <p className="mt-2.5 max-w-2xl text-[13.5px] leading-6 text-[#F8E7E7]">
                  Ingests every heading, concept, and formula from your uploaded source without missing a detail. Includes a strictly grounded Q&A box at the bottom.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="inline-flex rounded-2xl bg-[#A070A1]/60 p-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode("notes")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold transition ${
                    mode === "notes"
                      ? "bg-[#F8E7E7] text-[#724060] shadow-sm"
                      : "text-[#FDF3F3] hover:text-white"
                  }`}
                >
                  <BookMarked className="h-4 w-4" />
                  Notes Maker
                </button>
                <button
                  type="button"
                  onClick={() => setMode("revision")}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold transition ${
                    mode === "revision"
                      ? "bg-[#F8E7E7] text-[#724060] shadow-sm"
                      : "text-[#FDF3F3] hover:text-white"
                  }`}
                >
                  <RefreshCw className="h-4 w-4" />
                  Revision Bot
                </button>
              </div>
            </div>
          </header>

          {error && (
            <div role="alert" className="mt-5 flex items-center gap-3 rounded-2xl bg-[#F8E7E7] p-4 text-[13px] text-[#724060] shadow-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#A070A1]" />
              <span>{error}</span>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            {/* Left Sidebar: Saved Notes Library */}
            <aside className="rounded-[24px] border border-[#F8E7E7] bg-white p-4 shadow-sm">
              <div className="border-b border-[#F8E7E7] pb-3 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                  Saved Notes Library
                </p>
                <p className="mt-0.5 text-[12px] text-[#724060]/70">
                  {notes.data?.length || 0} notes created
                </p>
              </div>

              <div className="mt-3 max-h-[700px] space-y-2 overflow-y-auto pr-1">
                {notes.data?.length ? (
                  notes.data.map(item => {
                    const isSelected = item.id === selectedNote;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedNote(item.id);
                          setMode("notes");
                        }}
                        className={`w-full rounded-2xl p-3 text-left transition ${
                          isSelected
                            ? "border border-[#A070A1] bg-[#F8E7E7] shadow-sm"
                            : "border border-transparent bg-[#FDF3F3]/60 hover:bg-[#FDF3F3]"
                        }`}
                      >
                        <p className="line-clamp-2 text-[13px] font-semibold text-[#724060]">
                          {item.title}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#A070A1]">
                          <span className="capitalize">{item.scopeType}</span>
                          <span className="truncate max-w-[140px]">{item.scopeLabel}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-12 text-center">
                    <NotebookPen className="mx-auto h-8 w-8 text-[#A070A1]/60" />
                    <p className="mt-3 text-[13px] font-semibold text-[#724060]">No saved notes yet</p>
                    <p className="mt-1 text-[11.5px] text-[#A070A1]">
                      Select a document below to generate comprehensive notes.
                    </p>
                  </div>
                )}
              </div>
            </aside>

            {/* Right Column: Generation Controls & Note Display */}
            <section className="space-y-6">
              {/* Scope & Document Configuration Card */}
              <div className="rounded-[24px] border border-[#F8E7E7] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F8E7E7] text-[#724060]">
                    {mode === "notes" ? <BookMarked className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#724060]">
                      {mode === "notes" ? "Generate Exhaustive Document Notes" : "Build Active-Recall Revision Guide"}
                    </h2>
                    <p className="text-[12px] text-[#A070A1]">
                      Select an uploaded document. StudentGPT analyzes the entire text to build thorough, structured notes.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-[12px] font-semibold text-[#724060]">
                    Uploaded Document
                    <select
                      value={documentId}
                      onChange={e => setDocumentId(e.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="">No document selected — use general topic</option>
                      {documents.data
                        ?.filter(doc => doc.status === "ready")
                        .map(doc => (
                          <option key={doc.id} value={doc.id}>
                            {doc.originalName} ({doc.pageCount || 1} pages)
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="text-[12px] font-semibold text-[#724060]">
                    Connect Subject <span className="font-normal text-[#A070A1]">(optional)</span>
                    <select
                      value={subjectId}
                      onChange={e => setSubjectId(e.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="">No subject linked</option>
                      {subjects.data?.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[12px] font-semibold text-[#724060]">
                    Study Scope
                    <select
                      value={scopeType}
                      onChange={e => setScopeType(e.target.value as typeof scopeType)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="document">Complete Document (All Sections)</option>
                      <option value="chapter">Specific Chapter</option>
                      <option value="section">Specific Section / Part</option>
                      <option value="range">Page / Concept Range</option>
                      <option value="topic">Custom Topic</option>
                    </select>
                  </label>

                  <label className="text-[12px] font-semibold text-[#724060]">
                    Scope Details / Focus
                    <input
                      value={scopeLabel}
                      onChange={e => setScopeLabel(e.target.value)}
                      placeholder={
                        scopeType === "document"
                          ? "e.g. Complete Document (All Sections)"
                          : scopeType === "chapter"
                            ? "e.g. Chapter 4: Electric Dipoles"
                            : scopeType === "section"
                              ? "e.g. PART 2 · Field Calculations"
                              : "Enter exact focus or section"
                      }
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F8E7E7] pt-4">
                  <p className="text-[12px] text-[#A070A1]">
                    Target title: <b>{payloadTitle}</b>
                  </p>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generateNotes.isPending || generateRevision.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-semibold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {generateNotes.isPending || generateRevision.isPending
                      ? "Analyzing Document & Generating…"
                      : mode === "notes"
                        ? "Generate Structured Notes"
                        : "Build Revision Guide"}
                  </button>
                </div>
              </div>

              {/* Note / Revision Content View */}
              {mode === "notes" ? (
                active ? (
                  <div className="space-y-6">
                    {/* Note Content Card */}
                    <div className="rounded-[28px] border border-[#F8E7E7] bg-white p-6 shadow-sm sm:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-[#F8E7E7] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                          {active.scopeType} · {active.scopeLabel}
                        </span>
                        {active.documentId && (
                          <span className="text-[12px] text-[#A070A1]">
                            Source Document #{active.documentId}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-[28px] font-bold tracking-tight text-[#724060] sm:text-[34px]">
                        {active.title}
                      </h2>

                      {/* Audio Study Reader */}
                      <div className="mt-5">
                        <VoiceReader
                          title={`Listen to "${active.title}"`}
                          text={noteSpeechText}
                          lectureText={noteLectureText}
                        />
                      </div>

                      {/* Overview Box */}
                      <div className="mt-6 rounded-2xl border-l-4 border-[#724060] bg-[#FDF3F3] p-5 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                          Comprehensive Academic Overview
                        </p>
                        <MathRenderer
                          content={content.overview || ""}
                          className="mt-2.5 text-[14.5px] leading-7 text-[#724060]"
                        />
                      </div>

                      {/* Sections List */}
                      <div className="mt-8 space-y-6">
                        {content.sections?.map((section, index) => (
                          <section
                            key={`${section.heading}-${index}`}
                            className="rounded-2xl border border-[#F8E7E7] bg-white p-5 shadow-sm transition hover:border-[#A070A1]/40 sm:p-6"
                          >
                            <h3 className="text-[19px] font-bold tracking-tight text-[#724060]">
                              <MathRenderer content={section.heading || ""} inline />
                            </h3>
                            <MathRenderer
                              content={section.explanation || ""}
                              className="mt-2 text-[13.5px] leading-6 text-[#724060]/90"
                            />

                            <div className="mt-4 border-t border-[#F8E7E7] pt-3">
                              <ul className="space-y-2.5">
                                {section.bullets?.map((bullet, bulletIndex) => (
                                  <li
                                    key={`${bullet}-${bulletIndex}`}
                                    className="flex items-start gap-2.5 text-[13px] leading-6 text-[#724060]"
                                  >
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A070A1]" />
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer content={bullet} />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </section>
                        ))}
                      </div>

                      {/* Revision Reminders */}
                      {content.revisionReminders && content.revisionReminders.length > 0 && (
                        <div className="mt-8 rounded-2xl bg-[#FDF3F3] p-5">
                          <div className="flex items-center gap-2 text-[#724060]">
                            <Lightbulb className="h-5 w-5 text-[#A070A1]" />
                            <h3 className="text-[14.5px] font-bold">Key Revision Reminders & Active Recall</h3>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {content.revisionReminders.map((reminder, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[13px] leading-5 text-[#724060]">
                                <span className="text-[#A070A1]">•</span>
                                <div className="flex-1 min-w-0">
                                  <MathRenderer content={reminder} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sticky Notes */}
                      <div className="mt-8 rounded-2xl border border-dashed border-[#F8E7E7] p-5">
                        <div className="flex items-center gap-2 text-[#724060]">
                          <StickyNote className="h-4 w-4 text-[#A070A1]" />
                          <h3 className="text-[14px] font-bold">Personal Sticky Notes</h3>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {detail.data?.stickyNotes.map(item => (
                            <div
                              key={item.id}
                              className={`min-h-20 rounded-xl p-3 text-[12.5px] leading-5 shadow-sm ${
                                item.color === "mint"
                                  ? "bg-emerald-50 text-emerald-950 border border-emerald-100"
                                  : item.color === "lavender"
                                    ? "bg-purple-50 text-purple-950 border border-purple-100"
                                    : item.color === "peach"
                                      ? "bg-orange-50 text-orange-950 border border-orange-100"
                                      : "bg-amber-50 text-amber-950 border border-amber-100"
                              }`}
                            >
                              {item.content}
                            </div>
                          ))}
                        </div>

                        <form onSubmit={saveSticky} className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={sticky}
                            onChange={e => setSticky(e.target.value)}
                            placeholder="Add your personal formula reminder or mnemonic..."
                            className="h-10 min-w-0 flex-1 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none"
                          />
                          <select
                            value={stickyColor}
                            onChange={e => setStickyColor(e.target.value)}
                            className="h-10 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[12px] text-[#724060] outline-none"
                          >
                            <option value="yellow">Yellow</option>
                            <option value="mint">Mint</option>
                            <option value="lavender">Lavender</option>
                            <option value="peach">Peach</option>
                          </select>
                          <button
                            type="submit"
                            disabled={addSticky.isPending}
                            className="h-10 rounded-xl bg-[#F8E7E7] px-4 text-[12.5px] font-semibold text-[#724060] hover:bg-[#F8E7E7]/80"
                          >
                            Save Sticky
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyWorkspace mode="notes" />
                )
              ) : latestRevision ? (
                /* Revision Mode Card */
                <div className="rounded-[28px] border border-[#F8E7E7] bg-white p-6 shadow-sm sm:p-8">
                  <span className="rounded-full bg-[#F8E7E7] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                    Revision Guide · {latestRevision.scopeLabel}
                  </span>
                  <h2 className="mt-3 text-[28px] font-bold tracking-tight text-[#724060]">
                    {latestRevision.title}
                  </h2>
                  <MathRenderer
                    content={revision.overview || ""}
                    className="mt-5 rounded-2xl bg-[#FDF3F3] p-5 text-[14px] leading-7 text-[#724060]"
                  />

                  {/* Revision Voice Mode */}
                  <div className="mt-5">
                    <VoiceReader
                      title={`Listen to Revision Guide`}
                      text={revisionSpeechText}
                      lectureText={revisionLectureText}
                    />
                  </div>

                  <div className="mt-7 space-y-6">
                    {revision.blocks?.map((block, index) => {
                      const blockId = `block-${index}`;
                      return (
                        <section
                          key={`${block.title}-${index}`}
                          className="rounded-2xl border border-[#F8E7E7] bg-white p-6 shadow-sm transition hover:border-[#A070A1]/30 sm:p-7"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F8E7E7] pb-3">
                            <span className="rounded-full bg-[#F8E7E7] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#724060]">
                              Revision Block {index + 1}
                            </span>
                            <span className="text-[12px] font-semibold text-[#A070A1]">
                              <MathRenderer content={block.focus || ""} inline={true} />
                            </span>
                          </div>

                          <h3 className="mt-4 text-[20px] font-bold text-[#724060]">
                            <MathRenderer content={block.title || ""} inline />
                          </h3>

                          {/* 1. High-Yield Concept Summary */}
                          {block.coreSummary && (
                            <div className="mt-3 rounded-xl border-l-4 border-[#724060] bg-[#FDF3F3] p-4">
                              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#A070A1]">
                                High-Yield Conceptual Breakdown & Mechanics
                              </p>
                              <div className="mt-1.5 text-[13.5px] leading-6 text-[#724060]">
                                <MathRenderer content={block.coreSummary} />
                              </div>
                            </div>
                          )}

                          {/* 2. Key Governing Formula / Law */}
                          {block.keyFormula && (
                            <div className="mt-3 rounded-xl border border-[#A070A1]/20 bg-gradient-to-r from-[#FDF3F3] via-white to-[#F8E7E7] p-3 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A070A1]">
                                Governing Formula / Primary Law
                              </span>
                              <div className="mt-1">
                                <MathRenderer content={block.keyFormula} />
                              </div>
                            </div>
                          )}

                          {/* 3. Key Takeaways */}
                          {block.keyTakeaways && block.keyTakeaways.length > 0 && (
                            <div className="mt-4">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                                Key Takeaways & Core Insights
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {block.keyTakeaways.map((takeaway, tIdx) => (
                                  <li key={tIdx} className="flex items-start gap-2 text-[12.5px] leading-5 text-[#724060]">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A070A1]" />
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer content={takeaway} />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 4. Active-Recall Questions with Reveal Answer Toggle */}
                          {block.questions && block.questions.length > 0 && (
                            <div className="mt-5 border-t border-[#F8E7E7] pt-4">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#A070A1]">
                                Active-Recall Flash Questions & Model Answers
                              </p>
                              <div className="mt-3 space-y-3">
                                {block.questions.map((rawQ, qIndex) => {
                                  const qKey = `${blockId}-q-${qIndex}`;
                                  const isRevealed = Boolean(revealedQuestions[qKey]);
                                  const qObj =
                                    typeof rawQ === "string"
                                      ? { question: rawQ, answer: "Review the section summary above for full derivation.", examTrap: "" }
                                      : rawQ;

                                  return (
                                    <div
                                      key={qIndex}
                                      className="rounded-xl border border-[#F8E7E7] bg-[#FDF3F3]/50 p-4 transition"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2 text-[13.5px] font-medium text-[#724060]">
                                          <span className="font-bold text-[#A070A1]">{qIndex + 1}.</span>
                                          <div className="flex-1 min-w-0">
                                            <MathRenderer content={qObj.question} />
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => toggleQuestionReveal(qKey)}
                                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#A070A1]/30 bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#724060] shadow-2xs hover:bg-[#F8E7E7] transition"
                                        >
                                          {isRevealed ? (
                                            <>
                                              <EyeOff className="h-3 w-3 text-[#A070A1]" /> Hide Answer
                                            </>
                                          ) : (
                                            <>
                                              <Eye className="h-3 w-3 text-[#A070A1]" /> Reveal Model Answer
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {isRevealed && (
                                        <div className="mt-3 border-t border-[#F8E7E7] pt-3 text-[12.5px] leading-6 text-[#724060] space-y-2">
                                          <div className="rounded-lg bg-white p-3 border border-[#F8E7E7]">
                                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#A070A1]">
                                              Model Answer & Derivation
                                            </p>
                                            <div className="mt-1">
                                              <MathRenderer content={qObj.answer || "See summary above for explanation."} />
                                            </div>
                                          </div>
                                          {qObj.examTrap && (
                                            <div className="flex items-start gap-2 rounded-lg bg-amber-50/70 border border-amber-200 p-2.5 text-amber-900 text-[12px]">
                                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                              <div className="flex-1 min-w-0">
                                                <span className="font-bold">Exam Trap: </span>
                                                <MathRenderer content={qObj.examTrap} inline={true} />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 5. Common Pitfalls & Mistakes */}
                          {block.commonMistakes && block.commonMistakes.length > 0 && (
                            <div className="mt-4 rounded-xl border border-red-100 bg-red-50/40 p-3">
                              <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-800">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                Common Pitfalls to Avoid
                              </p>
                              <ul className="mt-1.5 space-y-1">
                                {block.commonMistakes.map((mistake, mIdx) => (
                                  <li key={mIdx} className="text-[12px] text-red-950 flex items-start gap-1.5">
                                    <span className="text-red-500 font-bold">•</span>
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer content={mistake} />
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>

                  <div className="mt-6 rounded-2xl bg-[#FDF3F3] p-5">
                    <div className="flex items-center gap-2 text-[#724060]">
                      <ClipboardCheck className="h-5 w-5 text-[#A070A1]" />
                      <h3 className="text-[14px] font-bold">End-of-Session Self-Check</h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      {revision.selfCheck?.map((check, index) => (
                        <div key={index} className="flex items-start gap-2 text-[13px] text-[#724060]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#A070A1]" />
                          <div className="flex-1 min-w-0">
                            <MathRenderer content={check} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyWorkspace mode="revision" />
              )}

              {/* STRICTLY GROUNDED DOCUMENT Q&A BOX AT THE BOTTOM */}
              <div className="rounded-[28px] border-2 border-[#724060]/20 bg-gradient-to-b from-white to-[#FDF3F3] p-6 shadow-md sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F8E7E7] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#724060] text-white shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#724060]">
                        Ask This Document (Strictly Grounded Q&A)
                      </h3>
                      <p className="text-[12px] text-[#A070A1]">
                        AI answers strictly from the document text. No external knowledge, assumptions, or hallucinations.
                      </p>
                    </div>
                  </div>

                  {currentDoc && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#724060]/20 bg-[#F8E7E7] px-3.5 py-1 text-[11px] font-semibold text-[#724060]">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Grounded in: <b className="truncate max-w-[200px]">{currentDoc.originalName}</b>
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-[11px] font-medium text-[#A070A1] self-center">Quick inquiries:</span>
                  {[
                    "What are the core definitions and terms?",
                    "Explain the primary formulas and equations",
                    "What are the key mechanisms and rules?",
                    "Summarize worked example problems"
                  ].map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAskDocument(prompt)}
                      disabled={askDocMutation.isPending || !currentDocId}
                      className="rounded-xl border border-[#F8E7E7] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#724060] transition hover:border-[#A070A1] hover:bg-[#F8E7E7]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Question Input Form */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAskDocument();
                  }}
                  className="mt-4 flex gap-2"
                >
                  <input
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value)}
                    placeholder={
                      currentDoc
                        ? `Ask any question strictly based on "${currentDoc.originalName}"...`
                        : "Select an uploaded document to ask questions..."
                    }
                    disabled={askDocMutation.isPending || !currentDocId}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-[#F8E7E7] bg-white px-4 text-[13.5px] text-[#724060] shadow-inner outline-none transition focus:border-[#724060] focus:ring-1 focus:ring-[#724060]"
                  />
                  <button
                    type="submit"
                    disabled={askDocMutation.isPending || !qaInput.trim() || !currentDocId}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#724060] px-6 text-[13px] font-semibold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c] disabled:opacity-40"
                  >
                    {askDocMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>{askDocMutation.isPending ? "Analyzing Text…" : "Ask Document"}</span>
                  </button>
                </form>

                {/* Q&A Responses List */}
                {qaHistory.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                      Document Q&A History
                    </p>
                    {qaHistory.map(item => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#F8E7E7] bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[14px] font-bold text-[#724060]">
                            Q: {item.question}
                          </p>
                          <span className="shrink-0 text-[11px] text-[#A070A1]">
                            {item.timestamp}
                          </span>
                        </div>

                        <div className="mt-3 border-t border-[#F8E7E7] pt-3">
                          <MathRenderer content={item.answer} className="text-[13.5px] leading-6 text-[#724060]" />
                        </div>

                        {item.snippets && item.snippets.length > 0 && (
                          <div className="mt-3 rounded-xl bg-[#FDF3F3] p-3 text-[11.5px] text-[#A070A1]">
                            <p className="font-semibold text-[#724060]">
                              Document Reference: {item.documentName}
                            </p>
                            <div className="mt-1 space-y-1">
                              {item.snippets.map((snip, sIdx) => (
                                <p key={sIdx} className="line-clamp-2 italic">
                                  "{snip.preview}..."
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </StudentAppShell>
  );
}

function EmptyWorkspace({ mode }: { mode: "notes" | "revision" }) {
  return (
    <div className="grid min-h-80 place-items-center rounded-[28px] border border-dashed border-[#F8E7E7] bg-white p-8 text-center shadow-sm">
      <div>
        <FileText className="mx-auto h-8 w-8 text-[#A070A1]" />
        <h2 className="mt-4 text-[18px] font-bold text-[#724060]">
          {mode === "notes" ? "Your generated notes will appear here." : "Your revision guide will appear here."}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#A070A1]">
          Choose an uploaded book or document above, then click generate to create exhaustive, structured notes.
        </p>
      </div>
    </div>
  );
}
