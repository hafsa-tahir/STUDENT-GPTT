import { trpc } from "@/lib/trpc";
import { getSupabaseAccessToken } from "@/lib/supabase";
import {
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Layers3,
  MessageCircle,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  X,
  Zap,
  FolderInput,
  Check,
  Loader2
} from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useLocation } from "wouter";

type SubjectItem = {
  id: number;
  name: string;
  description: string | null;
  color: string;
};

interface SubjectActivityModalProps {
  subject: SubjectItem;
  onClose: () => void;
  onOpenOrganizer: () => void;
}

export function SubjectActivityModal({
  subject,
  onClose,
  onOpenOrganizer,
}: SubjectActivityModalProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"all" | "notes" | "quizzes" | "research" | "documents" | "curriculum">("all");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadNotice, setDocUploadNotice] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  const activitiesQuery = trpc.academic.getSubjectActivities.useQuery(
    { subjectId: subject.id },
    { refetchOnWindowFocus: false }
  );

  const subjectsQuery = trpc.academic.listSubjects.useQuery(undefined, { refetchOnWindowFocus: false });
  const allSubjects = subjectsQuery.data || [];

  const [movingDoc, setMovingDoc] = useState<{ id: number; originalName: string } | null>(null);
  const [targetMoveSubId, setTargetMoveSubId] = useState<number | null>(null);

  const updateSubjectMutation = trpc.documents.updateSubject.useMutation({
    onSuccess: async () => {
      setDocUploadNotice("Document moved to new subject.");
      setMovingDoc(null);
      await activitiesQuery.refetch();
      await utils.documents.list.invalidate();
    },
    onError: (err) => {
      setDocUploadError(`Failed to move document: ${err.message}`);
    }
  });

  async function handleDirectUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDocUploadError(null);
    setDocUploadNotice(null);

    if (file.type !== "application/pdf") {
      setDocUploadError("Please upload a PDF file.");
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setDocUploadError("PDF files on cloud hosting must be 4.5 MB or smaller. Please choose a smaller document.");
      return;
    }

    const token = getSupabaseAccessToken();
    if (!token) {
      setDocUploadError("Session expired. Please sign in again.");
      return;
    }

    setUploadingDoc(true);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/pdf",
          "X-File-Name": encodeURIComponent(file.name),
          "X-Subject-Id": String(subject.id)
        },
        body: file
      });

      let body: { error?: string; document?: { originalName: string } } = {};
      try {
        const text = await response.text();
        body = JSON.parse(text);
      } catch {
        if (response.status === 413) {
          throw new Error("File exceeds cloud 4.5 MB serverless upload limit. Please select a smaller PDF.");
        }
        if (!response.ok) {
          throw new Error(`Upload server error (${response.status}: ${response.statusText || "Request failed"}).`);
        }
      }

      if (!response.ok) throw new Error(body.error || "Upload failed.");

      setDocUploadNotice(`"${body.document?.originalName || file.name}" added to ${subject.name}!`);
      await activitiesQuery.refetch();
      await utils.documents.list.invalidate();
    } catch (caught) {
      setDocUploadError(caught instanceof Error ? caught.message : "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  }

  const data = activitiesQuery.data;
  const isLoading = activitiesQuery.isLoading;

  const totalMinutes = data?.totalMinutes ?? 0;
  const formattedStudyTime =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 ? `${totalMinutes % 60}m` : ""}`.trim()
      : `${totalMinutes}m`;

  const totalActivitiesCount =
    (data?.notes.length ?? 0) +
    (data?.revisions.length ?? 0) +
    (data?.quizzes.length ?? 0) +
    (data?.research.length ?? 0) +
    (data?.documents.length ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#724060]/30 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="flex max-h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-[26px] border border-[#F8E7E7] bg-white shadow-[0_24px_70px_rgba(114,64,96,0.25)]">
        {/* Header with subject color banner */}
        <div
          className="relative px-6 pt-6 pb-5 text-white"
          style={{
            background: `linear-gradient(135deg, ${subject.color} 0%, #724060 100%)`
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white shadow-inner backdrop-blur-md">
                <BookOpen className="h-6 w-6" />
              </span>
              <div>
                <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Subject Learning Hub
                </span>
                <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
                  {subject.name}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {subject.description && (
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-white/90">
              {subject.description}
            </p>
          )}

          {/* Quick Metrics Bar */}
          <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3 text-[12px] font-medium text-white/95">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/15 px-3 py-1.5 backdrop-blur-sm">
              <Clock className="h-3.5 w-3.5" />
              <strong className="font-bold">{formattedStudyTime}</strong> focused study
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/15 px-3 py-1.5 backdrop-blur-sm">
              <NotebookPen className="h-3.5 w-3.5" />
              <strong className="font-bold">{(data?.notes.length ?? 0) + (data?.revisions.length ?? 0)}</strong> notes & guides
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/15 px-3 py-1.5 backdrop-blur-sm">
              <Zap className="h-3.5 w-3.5" />
              <strong className="font-bold">{data?.quizzes.length ?? 0}</strong> quizzes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/15 px-3 py-1.5 backdrop-blur-sm">
              <Compass className="h-3.5 w-3.5" />
              <strong className="font-bold">{data?.research.length ?? 0}</strong> research papers
            </span>
          </div>
        </div>

        {/* Quick Actions Launchpad */}
        <div className="border-b border-[#F8E7E7] bg-[#FDF3F3] px-6 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#A070A1]">
            Create or Practice in {subject.name} Mode
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => {
                onClose();
                setLocation(`/notes?subjectId=${subject.id}&mode=notes`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Generate Notes
            </button>
            <button
              onClick={() => {
                onClose();
                setLocation(`/notes?subjectId=${subject.id}&mode=revision`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-white px-3.5 py-2 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#A070A1]" />
              Revision Guide
            </button>
            <button
              onClick={() => {
                onClose();
                setLocation(`/practice?subjectId=${subject.id}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-white px-3.5 py-2 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
            >
              <Zap className="h-3.5 w-3.5 text-[#A070A1]" />
              Practice Quiz
            </button>
            <button
              onClick={() => {
                onClose();
                setLocation(`/research?subjectId=${subject.id}&new=1`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-white px-3.5 py-2 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
            >
              <Compass className="h-3.5 w-3.5 text-[#A070A1]" />
              New Research Paper
            </button>
            <button
              onClick={() => {
                onClose();
                setLocation(`/chat?subjectId=${subject.id}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-white px-3.5 py-2 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#A070A1]" />
              Study Chat
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenOrganizer();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#A070A1]/40 bg-[#FDF3F3] px-3.5 py-2 text-[12px] font-semibold text-[#A070A1] hover:bg-[#F8E7E7] transition"
            >
              <Layers3 className="h-3.5 w-3.5" />
              Manage Curriculum
            </button>
            <label className={`inline-flex items-center gap-1.5 rounded-xl border border-[#724060]/30 bg-white px-3.5 py-2 text-[12px] font-bold text-[#724060] shadow-xs hover:bg-[#F8E7E7] transition ${uploadingDoc ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
              <UploadCloud className="h-3.5 w-3.5 text-[#A070A1]" />
              {uploadingDoc ? "Uploading PDF…" : "Upload PDF to Subject"}
              <input type="file" accept="application/pdf" onChange={handleDirectUpload} disabled={uploadingDoc} className="sr-only" />
            </label>
          </div>
          {docUploadNotice && (
            <p className="mt-2 text-[12px] font-semibold text-[#724060] bg-white px-3 py-1.5 rounded-lg border border-[#F8E7E7]">
              {docUploadNotice}
            </p>
          )}
          {docUploadError && (
            <p className="mt-2 text-[12px] font-semibold text-[#A070A1] bg-white px-3 py-1.5 rounded-lg border border-[#F8E7E7]">
              {docUploadError}
            </p>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#F8E7E7] px-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "all"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            All Activity ({totalActivitiesCount})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "notes"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            Notes & Revision ({(data?.notes.length ?? 0) + (data?.revisions.length ?? 0)})
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "quizzes"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            Quizzes ({data?.quizzes.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("research")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "research"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            Research Papers ({data?.research.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "documents"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            Documents ({data?.documents.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("curriculum")}
            className={`border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
              activeTab === "curriculum"
                ? "border-[#724060] text-[#724060]"
                : "border-transparent text-[#724060]/70 hover:text-[#724060]"
            }`}
          >
            Courses & Topics ({(data?.courses.length ?? 0) + (data?.topics.length ?? 0)})
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#FDF3F3]" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab: ALL or specific categories */}
              {(activeTab === "all" || activeTab === "notes") && (
                <div>
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
                    Study Notes & Revision Guides
                  </h3>
                  {data?.notes.length || data?.revisions.length ? (
                    <div className="space-y-2">
                      {data?.notes.map(note => (
                        <div
                          key={`note-${note.id}`}
                          onClick={() => {
                            onClose();
                            setLocation(`/notes?subjectId=${subject.id}`);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5 hover:bg-[#F8E7E7] transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                              <BookMarked className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-[#724060] group-hover:text-[#5a334c]">
                                {note.title}
                              </p>
                              <p className="text-[11px] text-[#A070A1]">
                                {note.scopeLabel || "Comprehensive notes"} ·{" "}
                                {new Date(note.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#724060] shadow-xs">
                            Study Note
                          </span>
                        </div>
                      ))}
                      {data?.revisions.map(rev => (
                        <div
                          key={`rev-${rev.id}`}
                          onClick={() => {
                            onClose();
                            setLocation(`/notes?subjectId=${subject.id}&mode=revision`);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5 hover:bg-[#F8E7E7] transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                              <RefreshCw className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-[#724060] group-hover:text-[#5a334c]">
                                {rev.title}
                              </p>
                              <p className="text-[11px] text-[#A070A1]">
                                {rev.scopeLabel || "Revision guide"} ·{" "}
                                {new Date(rev.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-[#F8E7E7] px-2.5 py-1 text-[11px] font-semibold text-[#724060]">
                            Revision Guide
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "notes" ? (
                    <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                      <NotebookPen className="mx-auto h-8 w-8 text-[#A070A1]" />
                      <p className="mt-2 text-[13px] font-semibold text-[#724060]">No notes yet for {subject.name}</p>
                      <button
                        onClick={() => {
                          onClose();
                          setLocation(`/notes?subjectId=${subject.id}&mode=notes`);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create first note
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tab: ALL or quizzes */}
              {(activeTab === "all" || activeTab === "quizzes") && (
                <div className="mt-4">
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
                    Practice Quizzes & Assessments
                  </h3>
                  {data?.quizzes.length ? (
                    <div className="space-y-2">
                      {data.quizzes.map(quiz => (
                        <div
                          key={`quiz-${quiz.id}`}
                          onClick={() => {
                            onClose();
                            setLocation(`/practice?subjectId=${subject.id}`);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5 hover:bg-[#F8E7E7] transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                              <Zap className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-[#724060] group-hover:text-[#5a334c]">
                                {quiz.title}
                              </p>
                              <p className="text-[11px] text-[#A070A1]">
                                {quiz.difficulty.toUpperCase()} difficulty ·{" "}
                                {new Date(quiz.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#724060] shadow-xs">
                            Start Quiz
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "quizzes" ? (
                    <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                      <Zap className="mx-auto h-8 w-8 text-[#A070A1]" />
                      <p className="mt-2 text-[13px] font-semibold text-[#724060]">No quizzes generated yet for {subject.name}</p>
                      <button
                        onClick={() => {
                          onClose();
                          setLocation(`/practice?subjectId=${subject.id}`);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Generate practice quiz
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tab: ALL or research */}
              {(activeTab === "all" || activeTab === "research") && (
                <div className="mt-4">
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
                    Research Papers
                  </h3>
                  {data?.research.length ? (
                    <div className="space-y-2">
                      {data.research.map(brief => (
                        <div
                          key={`res-${brief.id}`}
                          onClick={() => {
                            onClose();
                            setLocation(`/research?subjectId=${subject.id}`);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5 hover:bg-[#F8E7E7] transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                              <Compass className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-[#724060] group-hover:text-[#5a334c]">
                                {brief.title}
                              </p>
                              <p className="truncate text-[11px] text-[#A070A1]">
                                {brief.researchQuestion || "Publication-grade research paper"}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#724060] shadow-xs">
                            {brief.status === "ready" ? "View Paper" : "Open Research"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "research" ? (
                    <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                      <Compass className="mx-auto h-8 w-8 text-[#A070A1]" />
                      <p className="mt-2 text-[13px] font-semibold text-[#724060]">No research papers yet for {subject.name}</p>
                      <button
                        onClick={() => {
                          onClose();
                          setLocation(`/research?subjectId=${subject.id}&new=1`);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Start research paper
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tab: ALL or documents */}
              {(activeTab === "all" || activeTab === "documents") && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
                      {subject.name} Documents ({data?.documents.length ?? 0})
                    </h3>
                    <label className={`inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3 py-1.5 text-[12px] font-bold text-white shadow-xs transition hover:bg-[#5a334c] ${uploadingDoc ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
                      <UploadCloud className="h-3.5 w-3.5" />
                      {uploadingDoc ? "Uploading…" : "Upload PDF"}
                      <input type="file" accept="application/pdf" onChange={handleDirectUpload} disabled={uploadingDoc} className="sr-only" />
                    </label>
                  </div>

                  {data?.documents.length ? (
                    <div className="space-y-2.5">
                      {data.documents.map(doc => (
                        <div
                          key={`doc-${doc.id}`}
                          className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-4 transition hover:bg-[#F8E7E7]/80"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                              <FileText className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-bold text-[#724060]" title={doc.originalName}>
                                {doc.originalName}
                              </p>
                              <p className="text-[11.5px] text-[#A070A1]">
                                {doc.pageCount ? `${doc.pageCount} pages` : "Indexed"} · {Math.ceil(doc.byteSize / 1024)} KB · {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            <button
                              onClick={() => {
                                onClose();
                                setLocation(`/notes?documentId=${doc.id}&subjectId=${subject.id}&mode=notes`);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
                            >
                              <NotebookPen className="h-3 w-3 text-[#A070A1]" /> Notes
                            </button>
                            <button
                              onClick={() => {
                                onClose();
                                setLocation(`/practice?documentId=${doc.id}&subjectId=${subject.id}`);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
                            >
                              <Zap className="h-3 w-3 text-[#A070A1]" /> Quiz
                            </button>
                            <a
                              href={`/api/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs"
                            >
                              <ExternalLink className="h-3 w-3 text-[#A070A1]" /> View
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setMovingDoc(doc);
                                setTargetMoveSubId(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[#724060] hover:bg-[#F8E7E7] transition shadow-xs cursor-pointer"
                              title="Move to another subject"
                            >
                              <FolderInput className="h-3 w-3 text-[#A070A1]" /> Move
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "documents" ? (
                    <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                      <FileText className="mx-auto h-8 w-8 text-[#A070A1]" />
                      <p className="mt-2 text-[13px] font-semibold text-[#724060]">No documents uploaded for {subject.name} yet</p>
                      <label className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-4 py-2 text-[12px] font-bold text-white cursor-pointer hover:bg-[#5a334c] transition shadow-xs">
                        <UploadCloud className="h-3.5 w-3.5" /> Upload PDF for {subject.name}
                        <input type="file" accept="application/pdf" onChange={handleDirectUpload} disabled={uploadingDoc} className="sr-only" />
                      </label>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Tab: Curriculum / Courses & Topics */}
              {(activeTab === "all" || activeTab === "curriculum") && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#A070A1]">
                      Courses & Study Topics
                    </h3>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenOrganizer();
                      }}
                      className="text-[11.5px] font-bold text-[#724060] hover:underline"
                    >
                      Open Full Curriculum Organizer →
                    </button>
                  </div>
                  {data?.courses.length || data?.topics.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {data?.courses.map(course => (
                        <div
                          key={`course-${course.id}`}
                          className="rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5"
                        >
                          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-[#724060]">
                            {course.code || "Course"}
                          </span>
                          <p className="mt-1 text-[13px] font-bold text-[#724060]">{course.name}</p>
                          {course.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-[#A070A1]">{course.description}</p>
                          )}
                        </div>
                      ))}
                      {data?.topics.map(topic => (
                        <div
                          key={`topic-${topic.id}`}
                          className="rounded-2xl border border-[#F8E7E7] bg-white p-3.5"
                        >
                          <span className="rounded-md bg-[#FDF3F3] px-2 py-0.5 text-[10px] font-bold text-[#A070A1]">
                            Topic
                          </span>
                          <p className="mt-1 text-[13px] font-bold text-[#724060]">{topic.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "curriculum" ? (
                    <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                      <Layers3 className="mx-auto h-8 w-8 text-[#A070A1]" />
                      <p className="mt-2 text-[13px] font-semibold text-[#724060]">No courses or topics added yet</p>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenOrganizer();
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#724060] px-3.5 py-1.5 text-[12px] font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Course or Topic
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Empty State when ALL tab has 0 activities */}
              {activeTab === "all" && totalActivitiesCount === 0 && (
                <div className="rounded-2xl border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-10 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-[#A070A1]" />
                  <h3 className="mt-3 text-[15px] font-bold text-[#724060]">
                    Your workspace for {subject.name} is ready
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] text-[#A070A1]">
                    Generate notes, start a research paper, or take a practice quiz using the buttons above to begin building your study history.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Move Document Modal */}
      {movingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-[#724060]/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-[24px] border border-[#F8E7E7] bg-white p-6 shadow-[0_24px_70px_rgba(114,64,96,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F8E7E7] pb-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#724060]">Move Document</h3>
                <p className="text-[12px] text-[#A070A1]">Move from "{subject.name}" to another subject</p>
              </div>
              <button
                disabled={updateSubjectMutation.isPending}
                onClick={() => setMovingDoc(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#A070A1] hover:bg-[#FDF3F3] hover:text-[#724060] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] p-3 text-[12.5px] font-bold text-[#724060] truncate">
              {movingDoc.originalName}
            </div>

            <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
              <label
                onClick={() => setTargetMoveSubId(null)}
                className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
                  targetMoveSubId === null
                    ? "border-[#724060] bg-[#FDF3F3]"
                    : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                }`}
              >
                <span className="text-[12.5px] font-bold text-[#724060]">No Subject (General Library)</span>
                {targetMoveSubId === null && <Check className="h-4 w-4 text-[#724060]" />}
              </label>

              {allSubjects.map((sub) => {
                const isSelected = targetMoveSubId === sub.id;
                const isCurrent = sub.id === subject.id;
                return (
                  <label
                    key={sub.id}
                    onClick={() => setTargetMoveSubId(sub.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
                      isSelected
                        ? "border-[#724060] bg-[#FDF3F3]"
                        : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: sub.color || "#724060" }}
                      />
                      <span className="text-[12.5px] font-bold text-[#724060]">{sub.name}</span>
                      {isCurrent && (
                        <span className="rounded bg-[#724060]/10 px-1.5 py-0.2 text-[10px] font-bold text-[#724060]">
                          Current
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-[#724060]" />}
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#F8E7E7] pt-3">
              <button
                type="button"
                disabled={updateSubjectMutation.isPending}
                onClick={() => setMovingDoc(null)}
                className="h-9 rounded-xl border border-[#F8E7E7] bg-white px-3.5 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateSubjectMutation.isPending || targetMoveSubId === subject.id}
                onClick={() => {
                  if (!movingDoc) return;
                  updateSubjectMutation.mutate({
                    documentId: movingDoc.id,
                    subjectId: targetMoveSubId
                  });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#724060] px-4 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer disabled:opacity-50"
              >
                {updateSubjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Moving…
                  </>
                ) : (
                  <>
                    <FolderInput className="h-3.5 w-3.5" /> Move
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
