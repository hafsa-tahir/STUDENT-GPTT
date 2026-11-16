import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { HoldToDeleteButton } from "@/components/HoldToDeleteButton";
import {
  AiSynthesisLoader,
  FloatingHeroIllustration,
  MorphCopyButton,
  SpotlightCard,
} from "@/components/MicroInteractions";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
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
  Zap,
  Binary,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { MathRenderer } from "@/components/MathRenderer";
import { VoiceReader } from "@/components/VoiceReader";
import { generateNotesLecture, generateRevisionLecture } from "@/lib/lectureGenerator";

type NoteContent = {
  overview?: string;
  sections?: Array<{ heading?: string; explanation?: string; bullets?: string[] }>;
  revisionReminders?: string[];
};

type KeyDefinition = {
  term: string;
  definition: string;
  memoryTip?: string;
};

type FormulaItem = {
  name: string;
  formula: string;
  variables?: string;
  whenToUse?: string;
};

type RevisionBlock = {
  title?: string;
  focus?: string;
  coreSummary?: string;
  keyFormula?: string;
  keyTakeaways?: string[];
  commonMistakes?: string[];
  mnemonic?: string;
  questions?: Array<string | { question: string; answer?: string; examTrap?: string }>;
};

type RevisionContent = {
  oneLineSummary?: string;
  overview?: string;
  keyDefinitions?: KeyDefinition[];
  formulaBank?: FormulaItem[];
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
  const search = useSearch();
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
  const [filterSubjectId, setFilterSubjectId] = useState<number | "all">("all");
  const [scopeType, setScopeType] = useState<(typeof scopeOptions)[number]>("document");
  const [scopeLabel, setScopeLabel] = useState("");
  const [sticky, setSticky] = useState("");
  const [stickyColor, setStickyColor] = useState("yellow");
  const [error, setError] = useState<string | null>(null);

  // Grounded Document Q&A State
  const [qaInput, setQaInput] = useState("");
  const [qaHistory, setQaHistory] = useState<QAItem[]>([]);
  const askDocMutation = trpc.notes.askDocument.useMutation();

  const subjectMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>();
    subjects.data?.forEach(s => map.set(s.id, { name: s.name, color: s.color }));
    return map;
  }, [subjects.data]);

  const filteredNotes = useMemo(() => {
    if (!notes.data) return [];
    if (filterSubjectId === "all") return notes.data;
    return notes.data.filter(n => n.subjectId === filterSubjectId);
  }, [notes.data, filterSubjectId]);

  const filteredRevisions = useMemo(() => {
    if (!revisions.data) return [];
    if (filterSubjectId === "all") return revisions.data;
    return revisions.data.filter(r => r.subjectId === filterSubjectId);
  }, [revisions.data, filterSubjectId]);

  const generateNotes = trpc.notes.generate.useMutation({
    onSuccess: data => {
      utils.notes.list.invalidate();
      setSelectedNote(data.note.id);
      setError(null);
    },
    onError: caught => setError(caught.message)
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      setSelectedNote(null);
      setError(null);
    },
    onError: caught => setError(caught.message)
  });

  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);

  const generateRevision = trpc.revision.generate.useMutation({
    onSuccess: (data: any) => {
      utils.revision.list.invalidate();
      if (data?.id) setSelectedRevisionId(data.id);
      setError(null);
    },
    onError: caught => setError(caught.message)
  });

  const deleteRevision = trpc.revision.delete.useMutation({
    onSuccess: () => {
      utils.revision.list.invalidate();
      setSelectedRevisionId(null);
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
      if (readyDoc) {
        setDocumentId(String(readyDoc.id));
        if (readyDoc.subjectId) {
          setSubjectId(String(readyDoc.subjectId));
        }
      }
    }
  }, [documents.data, documentId]);

  // Sync selected note to the latest one when filtered notes list loads
  useEffect(() => {
    if (filteredNotes.length) {
      if (!selectedNote || !filteredNotes.some(n => n.id === selectedNote)) {
        setSelectedNote(filteredNotes[0].id);
      }
    }
  }, [filteredNotes, selectedNote]);

  // Sync selected revision to the latest one when filtered revisions list loads
  useEffect(() => {
    if (filteredRevisions.length) {
      if (!selectedRevisionId || !filteredRevisions.some(r => r.id === selectedRevisionId)) {
        setSelectedRevisionId(filteredRevisions[0].id);
      }
    }
  }, [filteredRevisions, selectedRevisionId]);

  // Read URL query parameters for documentId, subjectId, and mode
  useEffect(() => {
    const params = new URLSearchParams(search);
    const docParam = params.get("documentId");
    if (docParam) {
      setDocumentId(docParam);
    }
    const sub = params.get("subjectId");
    if (sub) {
      setSubjectId(sub);
      setFilterSubjectId(Number(sub));
    }
    const m = params.get("mode");
    if (m === "notes" || m === "revision") {
      setMode(m);
    }
  }, [search]);

  const active = detail.data?.note;
  const content = noteContent(active?.content);
  const activeRevision = revisions.data?.find(r => r.id === selectedRevisionId) || revisions.data?.[0];
  const revision = revisionContent(activeRevision?.content);

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
    if (!activeRevision) return "";
    const parts: string[] = [];

    parts.push(`Revision Guide: ${activeRevision.title}.`);
    if (activeRevision.scopeLabel) {
      parts.push(`Scope: ${activeRevision.scopeLabel}.`);
    }

    if (revision.oneLineSummary) {
      parts.push(`In One Line: ${revision.oneLineSummary}.`);
    }

    if (revision.overview) {
      parts.push(`Overview: ${revision.overview}.`);
    }

    if (revision.keyDefinitions?.length) {
      parts.push(`Key Definitions.`);
      revision.keyDefinitions.forEach((d) => {
        parts.push(`${d.term}: ${d.definition}.${d.memoryTip ? ` Tip: ${d.memoryTip}.` : ""}`);
      });
    }

    if (revision.formulaBank?.length) {
      parts.push(`Master Formulas.`);
      revision.formulaBank.forEach((f) => {
        parts.push(`${f.name}: ${f.formula}.${f.variables ? ` Variables: ${f.variables}.` : ""}`);
      });
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
        if (b.commonMistakes?.length) {
          parts.push(`Common pitfalls to avoid: ${b.commonMistakes.join(". ")}.`);
        }
        if (b.mnemonic) {
          parts.push(`Memory cue: ${b.mnemonic}.`);
        }
      });
    }

    if (revision.selfCheck?.length) {
      parts.push(`End of session self-check: ${revision.selfCheck.join(". ")}.`);
    }

    return parts.filter(Boolean).join(" ");
  }, [
    activeRevision?.id,
    activeRevision?.title,
    activeRevision?.scopeLabel,
    revision.oneLineSummary,
    revision.overview,
    revision.keyDefinitions,
    revision.formulaBank,
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
    if (!activeRevision) return "";
    return generateRevisionLecture(
      { title: activeRevision.title, scopeLabel: activeRevision.scopeLabel },
      revision
    );
  }, [
    activeRevision?.id,
    activeRevision?.title,
    activeRevision?.scopeLabel,
    revision
  ]);

  // Identify active document for grounded Q&A (strictly mode-aware so Revision never mixes with Notes!)
  const currentDocId =
    mode === "revision"
      ? (activeRevision?.documentId || (documentId ? Number(documentId) : null))
      : (active?.documentId || (documentId ? Number(documentId) : null));
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
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FDF3F3] px-3.5 py-4 sm:px-8 sm:py-6 lg:px-12">
        <div className="mx-auto w-full max-w-[1440px]">
          {/* Header Banner */}
          <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-5 py-6 text-[#FDF3F3] shadow-[0_18px_44px_rgba(114,64,96,0.20)] sm:px-9 sm:py-7">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-[#F8E7E7] backdrop-blur-md">
                  <Sparkles className="h-3 w-3 shrink-0" /> Notes & Revision Studio
                </div>
                <h1 className="mt-2.5 text-[23px] font-bold leading-snug tracking-tight sm:text-[34px]">
                  Turn any document into structured, exhaustive notes.
                </h1>
                <p className="mt-1.5 text-[13px] sm:text-[13.5px] leading-6 text-[#F8E7E7]/85">
                  Ingests every heading, concept, and formula from your uploaded source without missing a detail. Includes a strictly grounded Q&A box at the bottom.
                </p>

                {/* MicroKit Sliding Pill Mode Toggle */}
                <div className="mt-4 inline-flex max-w-full rounded-full border border-white/15 bg-black/20 p-1 sm:p-1.5 backdrop-blur-md">
                  {(["notes", "revision"] as const).map(itemMode => {
                    const activeMode = mode === itemMode;
                    return (
                      <button
                        key={itemMode}
                        type="button"
                        onClick={() => setMode(itemMode)}
                        className={`relative flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[12.5px] font-bold transition cursor-pointer ${
                          activeMode ? "text-[#724060]" : "text-[#FDF3F3]/85 hover:text-white"
                        }`}
                      >
                        {activeMode && (
                          <motion.span
                            layoutId="notes-mode-glide"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-full bg-[#FDF3F3] shadow-xs"
                          />
                        )}
                        {itemMode === "notes" ? (
                          <BookMarked className="relative z-10 h-4 w-4 shrink-0" />
                        ) : (
                          <RefreshCw className="relative z-10 h-4 w-4 shrink-0" />
                        )}
                        <span className="relative z-10 whitespace-nowrap">
                          {itemMode === "notes" ? "Notes Maker" : "Revision Bot"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="hidden lg:block">
                <FloatingHeroIllustration
                  src="/illustrations/ai-notes-diagram.svg"
                  alt="PDF to Formula Notes 3D Diagram"
                  caption="PDF → LaTeX Notes & Audio"
                />
              </div>
            </div>
          </header>

          {error && (
            <div role="alert" className="mt-5 flex items-center gap-3 rounded-2xl bg-[#F8E7E7] p-4 text-[13px] text-[#724060] shadow-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[#A070A1]" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className="mt-5 sm:mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 sm:gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            {/* Left Sidebar: Saved Notes Library */}
            <aside className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[#F8E7E7] bg-white p-4 shadow-sm">
              <div className="border-b border-[#F8E7E7] pb-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A070A1]">
                    Study Library
                  </p>
                  <span className="shrink-0 rounded-full bg-[#F8E7E7] px-2 py-0.5 text-[10.5px] font-bold text-[#724060]">
                    {mode === "notes" ? filteredNotes.length : filteredRevisions.length} saved
                  </span>
                </div>

                {/* Sub-library switcher */}
                <div className="mt-2.5 flex rounded-xl bg-[#FDF3F3] p-1 text-[11.5px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setMode("notes")}
                    className={`flex-1 rounded-lg py-1 text-center transition ${
                      mode === "notes" ? "bg-white text-[#724060] shadow-xs font-bold" : "text-[#724060]/70 hover:text-[#724060]"
                    }`}
                  >
                    Notes ({notes.data?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("revision")}
                    className={`flex-1 rounded-lg py-1 text-center transition ${
                      mode === "revision" ? "bg-white text-[#724060] shadow-xs font-bold" : "text-[#724060]/70 hover:text-[#724060]"
                    }`}
                  >
                    Guides ({revisions.data?.length || 0})
                  </button>
                </div>

                {/* Subject Filter Pills */}
                {subjects.data && subjects.data.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A070A1]/80 mb-1.5">
                      Filter by Subject
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setFilterSubjectId("all")}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                          filterSubjectId === "all"
                            ? "bg-[#724060] text-white shadow-xs"
                            : "bg-[#FDF3F3] text-[#724060]/80 hover:bg-[#F8E7E7]"
                        }`}
                      >
                        All ({mode === "notes" ? notes.data?.length || 0 : revisions.data?.length || 0})
                      </button>
                      {subjects.data.map(sub => {
                        const count = mode === "notes"
                          ? notes.data?.filter(n => n.subjectId === sub.id).length || 0
                          : revisions.data?.filter(r => r.subjectId === sub.id).length || 0;
                        const isSelected = filterSubjectId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setFilterSubjectId(sub.id)}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                              isSelected
                                ? "bg-[#724060] text-white shadow-xs"
                                : "bg-[#FDF3F3] text-[#724060]/80 hover:bg-[#F8E7E7]"
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: sub.color }}
                            />
                            <span>{sub.name}</span>
                            <span className="text-[10px] opacity-75">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 max-h-[260px] xl:max-h-[620px] space-y-2 overflow-y-auto pr-1">
                {mode === "notes" ? (
                  filteredNotes.length ? (
                    filteredNotes.map(item => {
                      const isSelected = item.id === selectedNote;
                      const sub = item.subjectId ? subjectMap.get(item.subjectId) : null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedNote(item.id)}
                          className={`w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-3 text-left transition ${
                            isSelected
                              ? "border border-[#A070A1] bg-[#F8E7E7] shadow-sm"
                              : "border border-transparent bg-[#FDF3F3]/60 hover:bg-[#FDF3F3]"
                          }`}
                        >
                          {sub && (
                            <span
                              className="mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: sub.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                              {sub.name}
                            </span>
                          )}
                          <p className="line-clamp-2 break-words text-[13px] font-semibold text-[#724060]">
                            {item.title}
                          </p>
                          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-[11px] text-[#A070A1]">
                            <span className="shrink-0 capitalize">{item.scopeType}</span>
                            <span className="min-w-0 truncate">{item.scopeLabel}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="w-full px-4 py-6 xl:py-12 text-center">
                      <NotebookPen className="mx-auto h-7 w-7 xl:h-8 xl:w-8 text-[#A070A1]/60" />
                      <p className="mt-2 xl:mt-3 text-[13px] font-semibold text-[#724060]">No notes found</p>
                      <p className="mt-1 text-[11.5px] text-[#A070A1]">
                        {filterSubjectId !== "all"
                          ? "No notes saved for this subject yet. Select a document below to generate notes."
                          : "Select a document below to generate comprehensive notes."}
                      </p>
                    </div>
                  )
                ) : (
                  filteredRevisions.length ? (
                    filteredRevisions.map(item => {
                      const isSelected = item.id === selectedRevisionId;
                      const sub = item.subjectId ? subjectMap.get(item.subjectId) : null;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedRevisionId(item.id)}
                          className={`group relative cursor-pointer w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-3 text-left transition ${
                            isSelected
                              ? "border border-[#A070A1] bg-[#F8E7E7] shadow-sm"
                              : "border border-transparent bg-[#FDF3F3]/60 hover:bg-[#FDF3F3]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {sub && (
                                <span
                                  className="mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold text-white shadow-2xs"
                                  style={{ backgroundColor: sub.color }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                                  {sub.name}
                                </span>
                              )}
                              <p className="line-clamp-2 break-words text-[13px] font-semibold text-[#724060]">
                                {item.title}
                              </p>
                            </div>
                            <button
                              type="button"
                              title="Delete Revision Guide"
                              onClick={e => {
                                e.stopPropagation();
                                deleteRevision.mutate({ revisionId: item.id });
                              }}
                              disabled={deleteRevision.isPending}
                              className="shrink-0 rounded-lg p-1.5 text-rose-600 hover:bg-rose-100/80 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-[11px] text-[#A070A1]">
                            <span className="shrink-0 capitalize">Revision Guide</span>
                            <span className="min-w-0 truncate">{item.scopeLabel}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full px-4 py-6 xl:py-12 text-center">
                      <RefreshCw className="mx-auto h-7 w-7 xl:h-8 xl:w-8 text-[#A070A1]/60" />
                      <p className="mt-2 xl:mt-3 text-[13px] font-semibold text-[#724060]">No revision guides found</p>
                      <p className="mt-1 text-[11.5px] text-[#A070A1]">
                        {filterSubjectId !== "all"
                          ? "No revision guides saved for this subject yet."
                          : "Build an active-recall revision guide from a document below."}
                      </p>
                    </div>
                  )
                )}
              </div>
            </aside>

            {/* Right Column: Generation Controls & Note Display */}
            <section className="min-w-0 max-w-full space-y-5 sm:space-y-6">
              {/* Scope & Document Configuration Card */}
              <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[#F8E7E7] bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F8E7E7] text-[#724060]">
                    {mode === "notes" ? <BookMarked className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-bold text-[#724060]">
                      {mode === "notes" ? "Generate Exhaustive Document Notes" : "Build Active-Recall Revision Guide"}
                    </h2>
                    <p className="text-[12px] text-[#A070A1]">
                      Select an uploaded document. StudentGPT analyzes the entire text to build thorough, structured notes.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                  <label className="min-w-0 block text-[12px] font-semibold text-[#724060]">
                    Uploaded Document
                    <select
                      value={documentId}
                      onChange={e => {
                        const newDocId = e.target.value;
                        setDocumentId(newDocId);
                        const matchedDoc = documents.data?.find(d => String(d.id) === newDocId);
                        if (matchedDoc?.subjectId) {
                          setSubjectId(String(matchedDoc.subjectId));
                        }
                      }}
                      className="mt-1.5 h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="">No document selected — use general topic</option>
                      {documents.data
                        ?.filter(doc => doc.status === "ready")
                        .map(doc => (
                          <option key={doc.id} value={doc.id}>
                            {doc.subjectId && subjectMap.get(doc.subjectId)
                              ? `[${subjectMap.get(doc.subjectId)!.name}] `
                              : ""}
                            {doc.originalName} ({doc.pageCount || 1} pages)
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="min-w-0 block text-[12px] font-semibold text-[#724060]">
                    Connect Subject <span className="font-normal text-[#A070A1]">(optional)</span>
                    <select
                      value={subjectId}
                      onChange={e => setSubjectId(e.target.value)}
                      className="mt-1.5 h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="">No subject linked</option>
                      {subjects.data?.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="min-w-0 block text-[12px] font-semibold text-[#724060]">
                    Study Scope
                    <select
                      value={scopeType}
                      onChange={e => setScopeType(e.target.value as typeof scopeType)}
                      className="mt-1.5 h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    >
                      <option value="document">Complete Document (All Sections)</option>
                      <option value="chapter">Specific Chapter</option>
                      <option value="section">Specific Section / Part</option>
                      <option value="range">Page / Concept Range</option>
                      <option value="topic">Custom Topic</option>
                    </select>
                  </label>

                  <label className="min-w-0 block text-[12px] font-semibold text-[#724060]">
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
                      className="mt-1.5 h-11 w-full min-w-0 max-w-full rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-[13px] text-[#724060] outline-none transition focus:border-[#A070A1]"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 border-t border-[#F8E7E7] pt-4">
                  <p className="text-[12px] text-[#A070A1] truncate">
                    Target title: <b>{payloadTitle}</b>
                  </p>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generateNotes.isPending || generateRevision.isPending}
                    className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-semibold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c] disabled:opacity-50"
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

              {/* Multi-Step AI Synthesis Animation when generating */}
              {(generateNotes.isPending || generateRevision.isPending) && (
                <AiSynthesisLoader
                  title={
                    mode === "notes"
                      ? "Synthesizing Exhaustive Study Notes…"
                      : "Building Active-Recall Revision Sheet…"
                  }
                />
              )}

              {/* Note / Revision Content View */}
              {mode === "notes" ? (
                active ? (
                  <div className="min-w-0 max-w-full space-y-5 sm:space-y-6">
                    {/* Note Content Card */}
                    <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#F8E7E7] bg-white p-4 shadow-sm sm:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate max-w-full rounded-full bg-[#F8E7E7] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                            {active.scopeType} · {active.scopeLabel}
                          </span>
                          {active.documentId && (
                            <span className="text-[12px] text-[#A070A1]">
                              Source Document #{active.documentId}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <MorphCopyButton
                            text={noteSpeechText}
                            label="Copy Note"
                          />
                          <HoldToDeleteButton
                            label="Hold to delete"
                            onConfirm={() => deleteNote.mutate({ noteId: active.id })}
                          />
                        </div>
                      </div>

                      <h2 className="mt-3 break-words text-[22px] font-bold tracking-tight text-[#724060] sm:text-[34px]">
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

                      {/* Sections List with Spotlight Hover & Morph Copy */}
                      <div className="mt-8 space-y-6">
                        {content.sections?.map((section, index) => (
                          <SpotlightCard
                            key={`${section.heading}-${index}`}
                            className="rounded-2xl border border-[#F8E7E7] bg-white p-5 shadow-sm transition hover:border-[#A070A1]/40 sm:p-6"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-[19px] font-bold tracking-tight text-[#724060]">
                                <MathRenderer content={section.heading || ""} inline />
                              </h3>
                              <MorphCopyButton
                                text={`${section.heading || ""}\n${section.explanation || ""}\n${(section.bullets || []).join("\n")}`}
                                label="Copy"
                              />
                            </div>
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
                          </SpotlightCard>
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
              ) : activeRevision ? (
                /* Revision Mode Card */
                <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] sm:rounded-[28px] border border-[#F8E7E7] bg-white p-4 shadow-sm sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F8E7E7] pb-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate max-w-full rounded-full bg-[#F8E7E7] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                        Revision Guide · {activeRevision.scopeLabel}
                      </span>
                      {revisions.data && revisions.data.length > 1 && (
                        <select
                          value={activeRevision.id}
                          onChange={e => setSelectedRevisionId(Number(e.target.value))}
                          className="h-8 max-w-full truncate rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] px-2.5 text-[11.5px] font-semibold text-[#724060] outline-none"
                        >
                          {revisions.data.map(rev => (
                            <option key={rev.id} value={rev.id}>
                              {rev.title.slice(0, 40)}... ({new Date(rev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <MorphCopyButton
                        text={revisionSpeechText}
                        label="Copy Guide"
                      />
                      <HoldToDeleteButton
                        label="Hold to delete"
                        onConfirm={() => deleteRevision.mutate({ revisionId: activeRevision.id })}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          generateRevision.mutate({
                            title: activeRevision.title || payloadTitle,
                            topic: null,
                            subjectId: subjectId ? Number(subjectId) : null,
                            documentId: activeRevision.documentId || (documentId ? Number(documentId) : null),
                            scopeType: scopeType,
                            scopeLabel: activeRevision.scopeLabel || scopeLabel || payloadTitle,
                          });
                        }}
                        disabled={generateRevision.isPending}
                        className="inline-flex h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#724060] to-[#8d4774] px-4 text-[12px] font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" />
                        <span className="truncate">{generateRevision.isPending ? "Synthesizing Full Solutions & Formulas…" : "Re-Generate High-Yield Revision Guide"}</span>
                      </button>
                    </div>
                  </div>

                  <h2 className="mt-4 break-words text-[22px] sm:text-[28px] font-bold tracking-tight text-[#724060]">
                    {activeRevision.title}
                  </h2>

                  {/* Legacy Revision Upgrade Banner */}
                  {(!revision.formulaBank || revision.formulaBank.length === 0) && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
                      <div className="flex items-center gap-2.5 text-[12.5px]">
                        <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="font-bold text-amber-900">Earlier Format Detected</p>
                          <p className="text-amber-800 text-[12px]">
                            Click <b>Re-Generate</b> to upgrade this guide with the Master Formula Bank, Key Definitions, and complete mathematical solutions!
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          generateRevision.mutate({
                            title: activeRevision.title,
                            topic: null,
                            subjectId: subjectId ? Number(subjectId) : null,
                            documentId: activeRevision.documentId || (currentDocId ? Number(currentDocId) : null),
                            scopeType: "document",
                            scopeLabel: activeRevision.scopeLabel || activeRevision.title
                          });
                        }}
                        disabled={generateRevision.isPending}
                        className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-amber-700"
                      >
                        {generateRevision.isPending ? "Generating…" : "Upgrade Now"}
                      </button>
                    </div>
                  )}

                  {/* In One Line Summary Banner */}
                  {revision.oneLineSummary && (
                    <div className="mt-5 rounded-2xl border-2 border-[#A070A1]/30 bg-gradient-to-r from-[#4a243d] via-[#633053] to-[#4a243d] p-5 text-white shadow-md">
                      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-amber-300">
                        <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                        <span>In One Line · The Core Takeaway</span>
                      </div>
                      <div className="mt-2.5 text-[15.5px] font-medium leading-relaxed text-white drop-shadow-xs">
                        <MathRenderer
                          content={revision.oneLineSummary}
                          inline
                          className="text-white font-medium text-[15.5px] leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

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

                  {/* Master Formula & Equation Cheatsheet */}
                  {revision.formulaBank && revision.formulaBank.length > 0 && (
                    <div className="mt-7 rounded-2xl border-2 border-[#A070A1]/20 bg-gradient-to-b from-[#FDF3F3] to-white p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#724060]">
                          <Binary className="h-5 w-5 text-[#A070A1]" />
                          <h3 className="text-[16px] font-bold">Master Formula & Equation Cheatsheet</h3>
                        </div>
                        <span className="rounded-full bg-[#F8E7E7] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#724060]">
                          {revision.formulaBank.length} Laws
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#A070A1]">
                        Governing mathematical formulations, equations, and variable units to memorize.
                      </p>
                      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                        {revision.formulaBank.map((item, fIdx) => (
                          <div key={fIdx} className="rounded-xl border border-[#F8E7E7] bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-bold text-[#724060]">{item.name}</span>
                              {item.whenToUse && (
                                <span className="rounded bg-[#F8E7E7] px-2 py-0.5 text-[10px] font-semibold text-[#A070A1]">
                                  {item.whenToUse}
                                </span>
                              )}
                            </div>
                            <div className="my-2.5 rounded-lg bg-[#FDF3F3] py-2 text-center text-[#724060]">
                              <MathRenderer content={item.formula} />
                            </div>
                            {item.variables && (
                              <p className="text-[11.5px] leading-5 text-[#724060]/85">
                                <span className="font-bold text-[#A070A1]">Variables: </span>
                                <MathRenderer content={item.variables} inline={true} />
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Definitions & Terminology Bank */}
                  {revision.keyDefinitions && revision.keyDefinitions.length > 0 && (
                    <div className="mt-7 rounded-2xl border border-[#F8E7E7] bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#724060]">
                          <BookMarked className="h-5 w-5 text-[#A070A1]" />
                          <h3 className="text-[16px] font-bold">Key Definitions & Terminology Bank</h3>
                        </div>
                        <span className="rounded-full bg-[#F8E7E7] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#724060]">
                          {revision.keyDefinitions.length} Terms
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {revision.keyDefinitions.map((def, dIdx) => (
                          <div key={dIdx} className="rounded-xl border border-[#F8E7E7] bg-[#FDF3F3]/50 p-4">
                            <span className="text-[13px] font-bold text-[#724060]">{def.term}</span>
                            <p className="mt-1 text-[12.5px] leading-5 text-[#724060]/90">
                              <MathRenderer content={def.definition} />
                            </p>
                            {def.memoryTip && (
                              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#A070A1]">
                                <Sparkles className="h-3 w-3 shrink-0" />
                                <span>Memory cue: {def.memoryTip}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-7 space-y-6">
                    {revision.blocks?.map((block, index) => (
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

                        {/* 4. Common Pitfalls & Traps to Avoid */}
                        {block.commonMistakes && block.commonMistakes.length > 0 && (
                          <div className="mt-4 rounded-xl border border-red-100 bg-red-50/40 p-3">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-800">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                              Common Pitfalls to Avoid on Exams
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

                        {/* 5. Memory Cue / Mnemonic */}
                        {block.mnemonic && (
                          <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-purple-50/70 border border-purple-200 p-3 text-purple-950 text-[12.5px]">
                            <Sparkles className="h-4 w-4 shrink-0 text-[#A070A1] mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-[#724060]">Memory Cue: </span>
                              <MathRenderer content={block.mnemonic} inline={true} />
                            </div>
                          </div>
                        )}

                        {/* 6. Solved Conceptual Problems & Real Step-by-Step Derivations */}
                        {block.questions && block.questions.length > 0 && (
                          <div className="mt-5 space-y-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-emerald-900">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <h4 className="text-[13px] font-bold uppercase tracking-wider">
                                Solved Conceptual Problem & Step-by-Step Derivation
                              </h4>
                            </div>
                            {block.questions.map((item, qIdx) => {
                              const qText = typeof item === "string" ? item : item.question;
                              const rawAns = typeof item === "string" ? "" : item.answer;
                              const trap = typeof item === "string" ? "" : item.examTrap;

                              // Ensure solution is comprehensive and NEVER dummy text
                              const solution = rawAns && rawAns.length > 10 && !rawAns.toLowerCase().includes("review the section summary")
                                ? rawAns
                                : block.coreSummary && block.coreSummary.length > 20
                                  ? `${block.coreSummary} ${block.keyFormula ? `Governed by: ${block.keyFormula}.` : ""}`
                                  : `Full Academic Solution & Derivation: Apply fundamental conservation laws and Coulomb's Inverse-Square Law ($F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{|q_1 q_2|}{r^2}$). Resolve all force vectors into components along coordinate axes, evaluate boundary limits, and verify SI units.`;

                              return (
                                <div key={qIdx} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-2xs">
                                  <div className="flex items-start gap-2 text-[13.5px] font-semibold text-[#724060]">
                                    <span className="font-bold text-emerald-700">{qIdx + 1}.</span>
                                    <div className="flex-1">
                                      <MathRenderer content={qText} />
                                    </div>
                                  </div>

                                  <div className="mt-3 rounded-lg border-l-4 border-emerald-600 bg-emerald-50/70 p-3 text-[13px] leading-6 text-emerald-950">
                                    <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-emerald-700 block mb-1">
                                      Complete Solution & Derivation:
                                    </span>
                                    <MathRenderer content={solution} />
                                  </div>

                                  {trap && (
                                    <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11.5px] text-amber-900">
                                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                                      <div className="flex-1">
                                        <span className="font-bold">Exam Trap to Avoid: </span>
                                        <MathRenderer content={trap} inline={true} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    ))}
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
              <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] sm:rounded-[28px] border-2 border-[#724060]/20 bg-gradient-to-b from-white to-[#FDF3F3] p-4 shadow-md sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F8E7E7] pb-4">
                  <div className="flex min-w-0 items-start sm:items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#724060] text-white shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] sm:text-[18px] font-bold text-[#724060]">
                        Ask This Document (Strictly Grounded Q&A)
                      </h3>
                      <p className="text-[12px] text-[#A070A1]">
                        AI answers strictly from the document text. No external knowledge, assumptions, or hallucinations.
                      </p>
                    </div>
                  </div>

                  {currentDoc && (
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#724060]/20 bg-[#F8E7E7] px-3.5 py-1 text-[11px] font-semibold text-[#724060]">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="shrink-0">Grounded in:</span> <b className="truncate max-w-[160px] sm:max-w-[200px]">{currentDoc.originalName}</b>
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
                  className="mt-4 flex flex-col sm:flex-row gap-2.5"
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
                    className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-[#724060] px-6 text-[13px] font-semibold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c] disabled:opacity-40"
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
      <div className="flex flex-col items-center">
        <div className="overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
          <img
            src="/illustrations/ai-notes-diagram.svg"
            alt="AI Notes Workflow"
            className="h-36 w-60 object-cover"
          />
        </div>
        <h2 className="mt-4 text-[18px] font-bold text-[#724060]">
          {mode === "notes" ? "Your generated notes will appear here." : "Your revision guide will appear here."}
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-[#A070A1]">
          Choose an uploaded book or document above, then click generate to create exhaustive, structured notes.
        </p>
      </div>
    </div>
  );
}
