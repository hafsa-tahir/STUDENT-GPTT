import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { HoldToDeleteButton } from "@/components/HoldToDeleteButton";
import { SpotlightCard } from "@/components/MicroInteractions";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  FolderInput,
  FolderOpen,
  LockKeyhole,
  NotebookPen,
  Plus,
  Trash2,
  UploadCloud,
  X,
  Zap,
  Loader2
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";

const PRESET_COLORS = [
  "#724060",
  "#A070A1",
  "#407256",
  "#4f46e5",
  "#d97706",
  "#0284c7",
  "#dc2626"
];

export default function Documents() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subjectsQuery = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const documentsQuery = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });

  const createSubjectMutation = trpc.academic.createSubject.useMutation({
    onSuccess: (newSub) => {
      utils.academic.listSubjects.invalidate();
      if (uploadModalOpen) {
        setPendingUploadSubjectId(newSub.id);
      }
      if (movingDocument) {
        setTargetMoveSubjectId(newSub.id);
      }
      setIsCreatingSubject(false);
      setNewSubjectName("");
    },
    onError: (err) => {
      setError(`Failed to create subject: ${err.message}`);
    }
  });

  const updateSubjectMutation = trpc.documents.updateSubject.useMutation({
    onMutate: async ({ documentId, subjectId }) => {
      await utils.documents.list.cancel();
      const previousDocs = utils.documents.list.getData();
      utils.documents.list.setData(undefined, (old) =>
        old?.map((d) => (d.id === documentId ? { ...d, subjectId } : d))
      );
      return { previousDocs };
    },
    onError: (err, _vars, context) => {
      if (context?.previousDocs) {
        utils.documents.list.setData(undefined, context.previousDocs);
      }
      setError(`Failed to move document: ${err.message}`);
    },
    onSuccess: (_data, variables) => {
      const destSubject = subjects.find((s) => s.id === variables.subjectId);
      const destName = destSubject ? destSubject.name : "Unassigned / General";
      setNotice(`Document successfully moved to "${destName}".`);
      setMovingDocument(null);
      utils.documents.list.invalidate();
      utils.academic.getSubjectActivities.invalidate();
    }
  });

  const deleteDocumentMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      setNotice("Document deleted successfully.");
      utils.documents.list.invalidate();
      utils.academic.getSubjectActivities.invalidate();
    },
    onError: (err) => {
      setError(`Failed to delete document: ${err.message}`);
    }
  });

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadSubjectId, setPendingUploadSubjectId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Move document modal state
  const [movingDocument, setMovingDocument] = useState<(typeof allDocuments)[0] | null>(null);
  const [targetMoveSubjectId, setTargetMoveSubjectId] = useState<number | null>(null);

  // Inline subject creator state
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState(PRESET_COLORS[0]);

  // Sync subject filter from URL query param if present
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) {
      const subId = Number(sub);
      if (Number.isInteger(subId) && subId > 0) {
        setSelectedSubjectFilter(subId);
      }
    }
  }, [search]);

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const allDocuments = useMemo(() => documentsQuery.data || [], [documentsQuery.data]);

  const filteredDocuments = useMemo(() => {
    if (selectedSubjectFilter === "all") return allDocuments;
    return allDocuments.filter((d) => d.subjectId === selectedSubjectFilter);
  }, [allDocuments, selectedSubjectFilter]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  // File selection interceptor: instead of silently uploading, prompt the student for the subject!
  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);

    if (file.type !== "application/pdf") {
      setError("Please choose a valid PDF file.");
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setError("PDF files on cloud hosting must be 4.5 MB or smaller. Please choose a smaller document.");
      return;
    }

    setPendingUploadFile(file);
    // Pre-select current filter if filtering a subject, else first subject or null
    const initialSubject =
      typeof selectedSubjectFilter === "number"
        ? selectedSubjectFilter
        : subjects[0]?.id ?? null;
    setPendingUploadSubjectId(initialSubject);
    setUploadModalOpen(true);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    handleFileSelected(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelected(file);
  }

  async function handleConfirmUpload() {
    if (!pendingUploadFile) return;

    if (pendingUploadFile.size > 4.5 * 1024 * 1024) {
      setError("PDF files on cloud hosting must be 4.5 MB or smaller. Please choose a smaller document.");
      return;
    }

    const token = getSupabaseAccessToken();
    if (!token) {
      setError("Your session is not active. Please sign in again.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent(pendingUploadFile.name)
      };

      if (pendingUploadSubjectId && pendingUploadSubjectId > 0) {
        headers["X-Subject-Id"] = String(pendingUploadSubjectId);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers,
        body: pendingUploadFile
      });

      let body: {
        error?: string;
        document?: { id: number; status: string; originalName: string; subjectId?: number | null; failureReason?: string | null };
      } = {};

      try {
        const text = await response.text();
        body = JSON.parse(text);
      } catch {
        if (response.status === 413) {
          throw new Error("File exceeds the cloud 4.5 MB upload limit. Please select a smaller PDF.");
        }
        if (!response.ok) {
          throw new Error(`Upload server error (${response.status}: ${response.statusText || "Request failed"}).`);
        }
      }

      if (!response.ok || body.error || !body.document || body.document.status === "failed") {
        throw new Error(body.error || body.document?.failureReason || "Upload failed: unable to process document.");
      }

      const assignedSubjectName = subjects.find((s) => s.id === pendingUploadSubjectId)?.name;
      const destinationText = assignedSubjectName ? ` assigned to "${assignedSubjectName}"` : "";

      setNotice(
        `"${body.document.originalName}" is indexed and ready${destinationText}.`
      );

      // If user uploaded to a specific subject, switch filter so they see it immediately
      if (pendingUploadSubjectId) {
        setSelectedSubjectFilter(pendingUploadSubjectId);
      }

      setUploadModalOpen(false);
      setPendingUploadFile(null);
      await utils.documents.list.invalidate();
      await utils.academic.getSubjectActivities.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload your PDF.");
    } finally {
      setUploading(false);
    }
  }

  function handleCreateSubjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    createSubjectMutation.mutate({
      name: newSubjectName.trim(),
      color: newSubjectColor
    });
  }

  function handleConfirmMove() {
    if (!movingDocument) return;
    updateSubjectMutation.mutate({
      documentId: movingDocument.id,
      subjectId: targetMoveSubjectId
    });
  }

  return (
    <StudentAppShell>
      <div
        className={`mx-auto w-full max-w-[1280px] overflow-x-hidden p-3.5 sm:p-8 lg:p-10 transition-colors ${
          isDragging ? "bg-[#FDF3F3] ring-4 ring-dashed ring-[#A070A1]" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden Global File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileInputChange}
          className="sr-only"
        />

        {/* Header Banner + Uiverse 3D Folder Dropzone */}
        <header className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-5 py-6 text-white shadow-[0_18px_44px_rgba(114,64,96,0.20)] sm:px-9 sm:py-7">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-5 sm:gap-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-[#F8E7E7] backdrop-blur-md">
                <LockKeyhole className="h-3 w-3 shrink-0" /> Private Academic Vault
              </div>
              <h1 className="mt-2.5 text-[24px] font-bold tracking-tight sm:text-[34px]">
                Documents & Source Material
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] sm:text-[13.5px] leading-relaxed text-[#F8E7E7]/85">
                Upload lectures, textbook chapters, and syllabi. Link each file to its subject so notes, flashcards, and practice questions stay strictly organized.
              </p>
            </div>

            {/* Uiverse 3D Animated Folder Upload Card */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex w-full sm:w-auto items-center gap-3.5 sm:gap-4 rounded-[22px] border border-white/20 bg-white/12 px-4 py-3 text-left backdrop-blur-md transition hover:border-white/40 hover:bg-white/18 cursor-pointer"
            >
              <img
                src="/illustrations/pdf-folder-3d.svg"
                alt="3D PDF Folder"
                className="h-14 w-20 shrink-0 rounded-xl object-cover shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-white flex items-center gap-1.5">
                  <UploadCloud className="h-4 w-4 shrink-0 text-[#F8E7E7]" />
                  <span>Drop or Upload PDF</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-[#F8E7E7]/80">Click or drag any lecture PDF anywhere</p>
              </div>
            </button>
          </div>
        </header>

        {/* Dismissible Error Alert */}
        {error && (
          <div
            role="alert"
            className="mt-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-medium text-red-800 shadow-xs"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-600 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dismissible Success Notice */}
        {notice && (
          <div
            role="status"
            className="mt-5 flex items-center justify-between rounded-2xl border border-[#724060]/20 bg-[#FDF3F3] p-4 text-[13px] font-semibold text-[#724060] shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#724060]" />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="ml-3 text-[#724060] hover:text-[#5a334c]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filter Pills by Subject */}
        <div className="mt-7 flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setSelectedSubjectFilter("all")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold transition cursor-pointer ${
              selectedSubjectFilter === "all"
                ? "bg-[#724060] text-white shadow-xs"
                : "border border-[#F8E7E7] bg-white text-[#724060] hover:bg-[#F8E7E7]"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            All Documents ({allDocuments.length})
          </button>

          {subjects.map((sub) => {
            const count = allDocuments.filter((d) => d.subjectId === sub.id).length;
            const isSelected = selectedSubjectFilter === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectFilter(sub.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition cursor-pointer ${
                  isSelected
                    ? "bg-[#724060] text-white shadow-xs"
                    : "border border-[#F8E7E7] bg-white text-[#724060] hover:bg-[#F8E7E7]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: sub.color || "#724060" }}
                />
                <span>{sub.name}</span>
                <span
                  className={`text-[11px] font-semibold ${
                    isSelected ? "text-white/80" : "text-[#A070A1]"
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Document Library Cards */}
        <div className="mt-6">
          {documentsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl bg-white border border-[#F8E7E7]"
                />
              ))}
            </div>
          ) : filteredDocuments.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => {
                const docSubject = subjects.find((s) => s.id === doc.subjectId);
                const isMovingThis =
                  updateSubjectMutation.isPending &&
                  updateSubjectMutation.variables?.documentId === doc.id;

                return (
                  <SpotlightCard
                    key={doc.id}
                    className="min-w-0 max-w-full overflow-hidden flex flex-col justify-between rounded-2xl border border-[#F8E7E7] bg-white p-4 sm:p-5 shadow-xs transition hover:shadow-[0_12px_32px_rgba(114,64,96,0.08)] relative"
                  >
                    <div>
                      {/* Subject Tag & Delete Action */}
                      <div className="flex items-center justify-between gap-2">
                        {docSubject ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                            style={{
                              backgroundColor: `${docSubject.color}15`,
                              color: docSubject.color || "#724060"
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: docSubject.color || "#724060" }}
                            />
                            {docSubject.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#F8E7E7]/60 px-2 py-0.5 text-[11px] font-semibold text-[#A070A1]">
                            Unassigned
                          </span>
                        )}

                        <HoldToDeleteButton
                          compact
                          label="Hold"
                          onConfirm={() => deleteDocumentMutation.mutate({ documentId: doc.id })}
                        />
                      </div>

                      {/* Title & Metadata */}
                      <div className="mt-3 flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="truncate text-[14px] font-bold text-[#724060]"
                            title={doc.originalName}
                          >
                            {doc.originalName}
                          </h3>
                          <p className="mt-1 text-[11.5px] text-[#A070A1]">
                            {Math.ceil(doc.byteSize / 1024)} KB ·{" "}
                            {doc.pageCount ? `${doc.pageCount} pages` : "Indexed"} ·{" "}
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Dedicated Move to Subject Action Button */}
                      <div className="mt-4 flex items-center justify-between border-t border-[#F8E7E7] pt-3">
                        <div className="flex items-center gap-1.5 text-[12px] text-[#A070A1]">
                          <FolderInput className="h-3.5 w-3.5 text-[#A070A1]" />
                          <span className="text-[11.5px] font-medium text-[#A070A1]">Subject:</span>
                          <span className="text-[11.5px] font-bold text-[#724060]">
                            {docSubject ? docSubject.name : "None (General)"}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isMovingThis}
                          onClick={() => {
                            setMovingDocument(doc);
                            setTargetMoveSubjectId(doc.subjectId);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#FDF3F3] px-3 py-1.5 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs border border-[#F8E7E7] cursor-pointer"
                        >
                          {isMovingThis ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-[#724060]" />
                              Moving…
                            </>
                          ) : (
                            <>
                              <FolderInput className="h-3.5 w-3.5 text-[#724060]" />
                              Move to subject
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick Study Launchers */}
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#F8E7E7] pt-3 text-[11.5px] font-bold">
                      <button
                        onClick={() =>
                          setLocation(
                            `/notes?documentId=${doc.id}&subjectId=${doc.subjectId || ""}&mode=notes`
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FDF3F3] py-2 text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs cursor-pointer"
                      >
                        <NotebookPen className="h-3.5 w-3.5 text-[#A070A1]" /> Notes
                      </button>
                      <button
                        onClick={() =>
                          setLocation(
                            `/practice?documentId=${doc.id}&subjectId=${doc.subjectId || ""}`
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FDF3F3] py-2 text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs cursor-pointer"
                      >
                        <Zap className="h-3.5 w-3.5 text-[#A070A1]" /> Quiz
                      </button>
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FDF3F3] py-2 text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#A070A1]" /> View
                      </a>
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#A070A1]/30 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto w-56 overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
                <img
                  src="/illustrations/pdf-folder-3d.svg"
                  alt="3D PDF Folder"
                  className="h-36 w-full object-cover"
                />
              </div>
              <h2 className="mt-4 text-[17px] font-bold text-[#724060]">
                {selectedSubjectFilter === "all"
                  ? "No documents uploaded yet"
                  : `No documents in "${
                      subjects.find((s) => s.id === selectedSubjectFilter)?.name || "this subject"
                    }"`}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#724060]/75">
                Upload your course lectures, textbook PDFs, or study guides. You will be prompted to select which subject they belong to.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#724060] px-5 py-2.5 text-[13px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer"
              >
                <UploadCloud className="h-4 w-4" /> Upload PDF Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. UPLOAD DOCUMENT MODAL - ASKS WHICH SUBJECT TO ASSIGN BEFORE UPLOADING */}
      {/* ========================================================================= */}
      {uploadModalOpen && pendingUploadFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#724060]/30 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-[540px] overflow-hidden rounded-[24px] border border-[#F8E7E7] bg-white p-6 shadow-[0_24px_70px_rgba(114,64,96,0.25)] sm:p-7">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#F8E7E7] pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#A070A1]/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                  <UploadCloud className="h-3 w-3" /> Document Upload
                </div>
                <h2 className="mt-1 text-[20px] font-bold text-[#724060]">
                  Upload & Assign to Subject
                </h2>
                <p className="text-[12.5px] text-[#A070A1]">
                  Which subject does this study document belong to?
                </p>
              </div>
              <button
                disabled={uploading}
                onClick={() => {
                  setUploadModalOpen(false);
                  setPendingUploadFile(null);
                }}
                className="grid h-8 w-8 place-items-center rounded-xl text-[#A070A1] hover:bg-[#FDF3F3] hover:text-[#724060] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selected File Overview Card */}
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[#724060]" title={pendingUploadFile.name}>
                    {pendingUploadFile.name}
                  </p>
                  <p className="text-[11px] text-[#A070A1]">
                    {Math.ceil(pendingUploadFile.size / 1024)} KB · PDF Document
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 text-[11.5px] font-bold text-[#724060] hover:underline cursor-pointer ml-2"
              >
                Change file
              </button>
            </div>

            {/* Subject Selector Options */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[#724060]">
                  Select Destination Subject:
                </label>
                {!isCreatingSubject && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingSubject(true)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#724060] hover:text-[#5a334c] cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> New Subject
                  </button>
                )}
              </div>

              {/* Inline Create Subject Form */}
              {isCreatingSubject && (
                <form
                  onSubmit={handleCreateSubjectSubmit}
                  className="mt-3 rounded-2xl border border-[#A070A1]/30 bg-[#FDF3F3] p-3.5"
                >
                  <p className="text-[12px] font-bold text-[#724060]">Create New Subject</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Physics, Chemistry, CS"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-[#F8E7E7] bg-white px-3 text-[12.5px] font-semibold text-[#724060] outline-none focus:border-[#724060]"
                    />
                    <button
                      type="submit"
                      disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
                      className="h-9 rounded-xl bg-[#724060] px-3.5 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer disabled:opacity-50"
                    >
                      {createSubjectMutation.isPending ? "Creating…" : "Save & Use"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubject(false)}
                      className="h-9 rounded-xl border border-[#F8E7E7] bg-white px-3 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {/* Colors */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#A070A1]">Color:</span>
                    <div className="flex gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewSubjectColor(c)}
                          className={`h-5 w-5 rounded-full transition cursor-pointer ${
                            newSubjectColor === c ? "ring-2 ring-[#724060] ring-offset-1 scale-110" : ""
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {/* Subject Grid Selection */}
              <div className="mt-2.5 max-h-[190px] space-y-2 overflow-y-auto pr-1">
                {/* Option: Unassigned / No Subject */}
                <label
                  onClick={() => setPendingUploadSubjectId(null)}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                    pendingUploadSubjectId === null
                      ? "border-[#724060] bg-[#FDF3F3] shadow-xs"
                      : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-[#A070A1]/50" />
                    <div>
                      <p className="text-[13px] font-bold text-[#724060]">No Subject (General)</p>
                      <p className="text-[11px] text-[#A070A1]">Available in the general library</p>
                    </div>
                  </div>
                  <div
                    className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                      pendingUploadSubjectId === null
                        ? "border-[#724060] bg-[#724060] text-white"
                        : "border-[#F8E7E7] bg-white"
                    }`}
                  >
                    {pendingUploadSubjectId === null && <Check className="h-3 w-3" />}
                  </div>
                </label>

                {/* Option for each user subject */}
                {subjects.map((sub) => {
                  const isSelected = pendingUploadSubjectId === sub.id;
                  const docCount = allDocuments.filter((d) => d.subjectId === sub.id).length;

                  return (
                    <label
                      key={sub.id}
                      onClick={() => setPendingUploadSubjectId(sub.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                        isSelected
                          ? "border-[#724060] bg-[#FDF3F3] shadow-xs"
                          : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: sub.color || "#724060" }}
                        />
                        <div>
                          <p className="text-[13px] font-bold text-[#724060]">{sub.name}</p>
                          <p className="text-[11px] text-[#A070A1]">
                            {docCount} {docCount === 1 ? "document" : "documents"} currently
                          </p>
                        </div>
                      </div>
                      <div
                        className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                          isSelected
                            ? "border-[#724060] bg-[#724060] text-white"
                            : "border-[#F8E7E7] bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F8E7E7] pt-4">
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  setUploadModalOpen(false);
                  setPendingUploadFile(null);
                }}
                className="h-10 rounded-xl border border-[#F8E7E7] bg-white px-4 text-[13px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={handleConfirmUpload}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Extracting & Indexing…
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    {pendingUploadSubjectId
                      ? `Upload to "${
                          subjects.find((s) => s.id === pendingUploadSubjectId)?.name || "Subject"
                        }"`
                      : "Upload to General"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MOVE TO SUBJECT MODAL - CLEAR, RELIABLE SUBJECT RE-ASSIGNMENT */}
      {/* ========================================================================= */}
      {movingDocument && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#724060]/30 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-[500px] overflow-hidden rounded-[24px] border border-[#F8E7E7] bg-white p-6 shadow-[0_24px_70px_rgba(114,64,96,0.25)] sm:p-7">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#F8E7E7] pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#A070A1]/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
                  <FolderInput className="h-3 w-3" /> Move Document
                </div>
                <h2 className="mt-1 text-[20px] font-bold text-[#724060]">
                  Move to Subject
                </h2>
                <p className="text-[12.5px] text-[#A070A1]">
                  Re-assign this document to organize your study notes and quizzes.
                </p>
              </div>
              <button
                disabled={updateSubjectMutation.isPending}
                onClick={() => setMovingDocument(null)}
                className="grid h-8 w-8 place-items-center rounded-xl text-[#A070A1] hover:bg-[#FDF3F3] hover:text-[#724060] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Document Card */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#F8E7E7] bg-[#FDF3F3] p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#724060] shadow-xs">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#724060]" title={movingDocument.originalName}>
                  {movingDocument.originalName}
                </p>
                <p className="text-[11.5px] text-[#A070A1]">
                  Current Subject:{" "}
                  <span className="font-bold text-[#724060]">
                    {subjects.find((s) => s.id === movingDocument.subjectId)?.name || "Unassigned"}
                  </span>
                </p>
              </div>
            </div>

            {/* Destination Subject Options */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-bold text-[#724060]">
                  Choose New Subject:
                </label>
                {!isCreatingSubject && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingSubject(true)}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#724060] hover:text-[#5a334c] cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> New Subject
                  </button>
                )}
              </div>

              {/* Inline Create Subject Form */}
              {isCreatingSubject && (
                <form
                  onSubmit={handleCreateSubjectSubmit}
                  className="mt-3 rounded-2xl border border-[#A070A1]/30 bg-[#FDF3F3] p-3.5"
                >
                  <p className="text-[12px] font-bold text-[#724060]">Create New Subject</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Physics, Chemistry, CS"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-[#F8E7E7] bg-white px-3 text-[12.5px] font-semibold text-[#724060] outline-none focus:border-[#724060]"
                    />
                    <button
                      type="submit"
                      disabled={createSubjectMutation.isPending || !newSubjectName.trim()}
                      className="h-9 rounded-xl bg-[#724060] px-3.5 text-[12px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer disabled:opacity-50"
                    >
                      {createSubjectMutation.isPending ? "Creating…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubject(false)}
                      className="h-9 rounded-xl border border-[#F8E7E7] bg-white px-3 text-[12px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {/* Colors */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#A070A1]">Color:</span>
                    <div className="flex gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewSubjectColor(c)}
                          className={`h-5 w-5 rounded-full transition cursor-pointer ${
                            newSubjectColor === c ? "ring-2 ring-[#724060] ring-offset-1 scale-110" : ""
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {/* Subject Options List */}
              <div className="mt-2.5 max-h-[200px] space-y-2 overflow-y-auto pr-1">
                {/* Unassign Option */}
                <label
                  onClick={() => setTargetMoveSubjectId(null)}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                    targetMoveSubjectId === null
                      ? "border-[#724060] bg-[#FDF3F3] shadow-xs"
                      : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-[#A070A1]/50" />
                    <div>
                      <p className="text-[13px] font-bold text-[#724060]">Unassign (General Library)</p>
                      <p className="text-[11px] text-[#A070A1]">Remove from current subject</p>
                    </div>
                  </div>
                  <div
                    className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                      targetMoveSubjectId === null
                        ? "border-[#724060] bg-[#724060] text-white"
                        : "border-[#F8E7E7] bg-white"
                    }`}
                  >
                    {targetMoveSubjectId === null && <Check className="h-3 w-3" />}
                  </div>
                </label>

                {/* Each subject */}
                {subjects.map((sub) => {
                  const isSelected = targetMoveSubjectId === sub.id;
                  const isCurrent = movingDocument.subjectId === sub.id;
                  const docCount = allDocuments.filter((d) => d.subjectId === sub.id).length;

                  return (
                    <label
                      key={sub.id}
                      onClick={() => setTargetMoveSubjectId(sub.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                        isSelected
                          ? "border-[#724060] bg-[#FDF3F3] shadow-xs"
                          : "border-[#F8E7E7] bg-white hover:bg-[#FDF3F3]/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: sub.color || "#724060" }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-[#724060]">{sub.name}</p>
                            {isCurrent && (
                              <span className="rounded-md bg-[#724060]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#724060]">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#A070A1]">
                            {docCount} {docCount === 1 ? "document" : "documents"} currently
                          </p>
                        </div>
                      </div>
                      <div
                        className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                          isSelected
                            ? "border-[#724060] bg-[#724060] text-white"
                            : "border-[#F8E7E7] bg-white"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F8E7E7] pt-4">
              <button
                type="button"
                disabled={updateSubjectMutation.isPending}
                onClick={() => setMovingDocument(null)}
                className="h-10 rounded-xl border border-[#F8E7E7] bg-white px-4 text-[13px] font-bold text-[#724060] hover:bg-[#F8E7E7] transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  updateSubjectMutation.isPending ||
                  targetMoveSubjectId === movingDocument.subjectId
                }
                onClick={handleConfirmMove}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-bold text-white shadow-xs hover:bg-[#5a334c] transition cursor-pointer disabled:opacity-60"
              >
                {updateSubjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Moving…
                  </>
                ) : (
                  <>
                    <FolderInput className="h-4 w-4" />
                    Confirm Move
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentAppShell>
  );
}
