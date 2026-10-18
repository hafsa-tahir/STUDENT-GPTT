import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  LockKeyhole,
  NotebookPen,
  Plus,
  Trash2,
  UploadCloud,
  Zap
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

export default function Documents() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const subjectsQuery = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  const documentsQuery = trpc.documents.list.useQuery(undefined, { enabled: Boolean(user) });

  const updateSubjectMutation = trpc.documents.updateSubject.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      utils.academic.getSubjectActivities.invalidate();
    }
  });

  const deleteDocumentMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      utils.academic.getSubjectActivities.invalidate();
    }
  });

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | "all">("all");
  const [targetSubjectId, setTargetSubjectId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sync subject filter from URL query param if present
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) {
      const subId = Number(sub);
      if (Number.isInteger(subId) && subId > 0) {
        setSelectedSubjectFilter(subId);
        setTargetSubjectId(subId);
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
    return allDocuments.filter(d => d.subjectId === selectedSubjectFilter);
  }, [allDocuments, selectedSubjectFilter]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);

    if (file.type !== "application/pdf") {
      setError("Please choose a standard PDF file.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setError("PDF files must be 12 MB or smaller.");
      return;
    }

    const token = getSupabaseAccessToken();
    if (!token) {
      setError("Your session is not active. Please sign in again.");
      return;
    }

    setUploading(true);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/pdf",
        "X-File-Name": encodeURIComponent(file.name)
      };

      const assignedSubId =
        targetSubjectId || (typeof selectedSubjectFilter === "number" ? selectedSubjectFilter : null);

      if (assignedSubId) {
        headers["X-Subject-Id"] = String(assignedSubId);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers,
        body: file
      });

      const body = (await response.json()) as {
        error?: string;
        document?: { id: number; status: string; originalName: string; subjectId?: number | null };
      };

      if (!response.ok) throw new Error(body.error || "Upload failed.");

      const assignedSubjectName = subjects.find(s => s.id === assignedSubId)?.name;
      const destinationText = assignedSubjectName ? ` assigned to "${assignedSubjectName}"` : "";

      setNotice(
        body.document?.status === "ready"
          ? `${body.document.originalName} is indexed and ready${destinationText}.`
          : `${body.document?.originalName || "Your PDF"} was stored${destinationText}.`
      );

      await utils.documents.list.invalidate();
      await utils.academic.getSubjectActivities.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload your PDF.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <StudentAppShell>
      <div className="mx-auto max-w-[1280px] p-5 sm:p-8 lg:p-10">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#F8E7E7] pb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#A070A1]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#724060]">
              <LockKeyhole className="h-3 w-3" /> Private Academic Vault
            </div>
            <h1 className="mt-2 text-[32px] font-bold tracking-tight text-[#724060]">
              Documents & Source Material
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#724060]/80">
              Upload lectures, textbook chapters, and syllabi. Link each file to its subject so notes and practice questions stay strictly organized.
            </p>
          </div>

          {/* Upload Controls with Subject Assignment */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-[#F8E7E7] bg-white px-3 py-1.5 shadow-xs">
              <span className="text-[12px] font-semibold text-[#A070A1] mr-2">Subject:</span>
              <select
                value={targetSubjectId ?? ""}
                onChange={e => setTargetSubjectId(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent text-[13px] font-bold text-[#724060] outline-none cursor-pointer"
              >
                <option value="">No subject (General)</option>
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <label
              className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#724060] px-5 text-[13px] font-bold text-white shadow-xs transition ${
                uploading ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-[#5a334c]"
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              {uploading ? "Extracting & Indexing…" : "Upload PDF"}
              <input
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-[#F8E7E7] bg-[#F8E7E7] p-4 text-[13px] font-medium text-[#724060]">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="mt-5 rounded-2xl border border-[#724060]/20 bg-[#FDF3F3] p-4 text-[13px] font-semibold text-[#724060]">
            {notice}
          </p>
        )}

        {/* Filter Pills by Subject */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedSubjectFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold transition ${
              selectedSubjectFilter === "all"
                ? "bg-[#724060] text-white shadow-xs"
                : "border border-[#F8E7E7] bg-white text-[#724060] hover:bg-[#F8E7E7]"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            All Documents ({allDocuments.length})
          </button>

          {subjects.map(sub => {
            const count = allDocuments.filter(d => d.subjectId === sub.id).length;
            const isSelected = selectedSubjectFilter === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedSubjectFilter(sub.id);
                  setTargetSubjectId(sub.id);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition ${
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
                <span className={`text-[11px] font-semibold ${isSelected ? "text-white/80" : "text-[#A070A1]"}`}>
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
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-white border border-[#F8E7E7]" />
              ))}
            </div>
          ) : filteredDocuments.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map(doc => {
                const docSubject = subjects.find(s => s.id === doc.subjectId);
                return (
                  <article
                    key={doc.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#F8E7E7] bg-white p-5 shadow-xs transition hover:shadow-[0_12px_32px_rgba(114,64,96,0.08)]"
                  >
                    <div>
                      {/* Subject Tag & Actions */}
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

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete "${doc.originalName}"?`)) {
                              deleteDocumentMutation.mutate({ documentId: doc.id });
                            }
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-[#A070A1] hover:bg-[#F8E7E7] hover:text-[#724060] transition"
                          title="Delete document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Title & Metadata */}
                      <div className="mt-3 flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-[14px] font-bold text-[#724060]" title={doc.originalName}>
                            {doc.originalName}
                          </h3>
                          <p className="mt-1 text-[11.5px] text-[#A070A1]">
                            {Math.ceil(doc.byteSize / 1024)} KB · {doc.pageCount ? `${doc.pageCount} pages` : "Indexed"} · {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Assign / Change Subject Selector */}
                      <div className="mt-4 flex items-center gap-2 border-t border-[#F8E7E7] pt-3">
                        <span className="text-[11px] font-medium text-[#A070A1]">Move to:</span>
                        <select
                          value={doc.subjectId ?? ""}
                          onChange={e => {
                            const newSubId = e.target.value ? Number(e.target.value) : null;
                            updateSubjectMutation.mutate({ documentId: doc.id, subjectId: newSubId });
                          }}
                          className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] px-2 py-1 text-[11.5px] font-semibold text-[#724060] outline-none cursor-pointer hover:border-[#A070A1]"
                        >
                          <option value="">No subject</option>
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Study Launchers */}
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#F8E7E7] pt-3 text-[11.5px] font-bold">
                      <button
                        onClick={() =>
                          setLocation(`/notes?documentId=${doc.id}&subjectId=${doc.subjectId || ""}&mode=notes`)
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FDF3F3] py-2 text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs"
                      >
                        <NotebookPen className="h-3.5 w-3.5 text-[#A070A1]" /> Notes
                      </button>
                      <button
                        onClick={() =>
                          setLocation(`/practice?documentId=${doc.id}&subjectId=${doc.subjectId || ""}`)
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#FDF3F3] py-2 text-[#724060] hover:bg-[#F8E7E7] transition shadow-2xs"
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
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#A070A1]/30 bg-white p-12 text-center shadow-xs">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#FDF3F3] text-[#724060]">
                <FileText className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-[17px] font-bold text-[#724060]">
                {selectedSubjectFilter === "all"
                  ? "No documents uploaded yet"
                  : `No documents in "${subjects.find(s => s.id === selectedSubjectFilter)?.name || "this subject"}"`}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#724060]/75">
                Upload a selectable-text PDF above. Choose a subject so your notes, practice questions, and study materials stay perfectly organized.
              </p>
            </div>
          )}
        </div>
      </div>
    </StudentAppShell>
  );
}
