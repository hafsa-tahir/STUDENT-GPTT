import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import {
  AiSynthesisLoader,
  FloatingHeroIllustration,
  MorphCopyButton,
} from "@/components/MicroInteractions";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { toPng } from "html-to-image";
import { 
  BookOpenCheck, Compass, Download, FileText, Lightbulb, 
  ListChecks, MessageCircleMore, Network, PlayCircle, Plus, 
  SearchCheck, Sparkles, Target, Wand2, Quote as QuoteIcon, 
  Clock, Users, Rocket, Cpu, CheckCircle2, AlertTriangle, X 
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MathRenderer } from "@/components/MathRenderer";
import { VoiceReader } from "@/components/VoiceReader";
import { generateResearchLecture } from "@/lib/lectureGenerator";

function formatError(caught: unknown, fallback: string): string {
  if (caught instanceof Error) {
    if (caught.message.includes("Failed to fetch") || caught.message.includes("NetworkError") || caught.message.includes("network")) {
      return "Connection error: Unable to reach the server. Please check the active tunnel URL or refresh the page.";
    }
    return caught.message;
  }
  return fallback;
}

type Concept = { name: string; explanation: string };
type Quote = { text: string; author: string; context?: string };
type Objective = { title: string; description?: string };

type Board = {
  topicType?: string;
  definition?: string;
  description?: string;
  howItWorks?: string;
  pastSummary?: string;
  presentAndContributors?: string;
  futureOutlook?: string;
  quote?: Quote | null;
  projectFocus?: string;
  objectives?: Array<string | Objective>;
  methodology?: string[];
  applications?: string[];
  misconceptions?: string[];
  verificationChecklist?: string[];
  limitations?: string[];
};

function strings(value: unknown): string[] { 
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; 
}

function concepts(value: unknown): Concept[] { 
  return Array.isArray(value) ? value.filter((item): item is Concept => Boolean(item && typeof item === "object" && typeof (item as Concept).name === "string" && typeof (item as Concept).explanation === "string")) : []; 
}

function board(value: unknown): Board { 
  return value && typeof value === "object" ? value as Board : {}; 
}

function parseObjectives(raw: unknown): Array<{ title: string; description: string }> {
  if (!Array.isArray(raw) || !raw.length) {
    return [];
  }
  return raw.map((item, index) => {
    if (typeof item === "string") {
      const parts = item.split(/:\s*/);
      if (parts.length > 1) {
        return { title: parts[0], description: parts.slice(1).join(": ") };
      }
      return { title: `Core Objective ${index + 1}`, description: item };
    }
    if (item && typeof item === "object") {
      const obj = item as { title?: unknown; description?: unknown; name?: unknown };
      return {
        title: typeof obj.title === "string" ? obj.title : (typeof obj.name === "string" ? obj.name : `Core Objective ${index + 1}`),
        description: typeof obj.description === "string" ? obj.description : ""
      };
    }
    return { title: `Core Objective ${index + 1}`, description: String(item) };
  });
}

function formatTopicType(type: string): string {
  if (!type) return "";
  const map: Record<string, string> = {
    physical_object_or_phenomenon: "Physical Object / Phenomenon",
    natural_process: "Natural Process",
    academic_field: "Academic Field",
    technology_or_system: "Technology / System",
    historical_event: "Historical Event",
    person_or_group: "Person / Group",
    concept_or_theory: "Concept / Theory",
    other: "Academic Subject"
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function getResolvedPaperData(title: string, briefOverview?: string | null, boardData?: Board) {
  return {
    topicType: boardData?.topicType || "",
    definition: boardData?.definition || "",
    description: boardData?.description || briefOverview || "",
    howItWorks: boardData?.howItWorks || "",
    pastSummary: boardData?.pastSummary || "",
    presentAndContributors: boardData?.presentAndContributors || "",
    futureOutlook: boardData?.futureOutlook || "",
    quote: (boardData?.quote && boardData.quote.text) ? boardData.quote : null,
    limitations: Array.isArray(boardData?.limitations) ? boardData.limitations.filter(Boolean) : []
  };
}

export default function Research() {
  const { user, loading, authError } = useSupabaseAuth(); 
  const [, setLocation] = useLocation(); 
  const search = useSearch();
  const utils = trpc.useUtils();
  
  const briefs = trpc.research.list.useQuery(undefined, { enabled: Boolean(user) }); 
  const subjects = trpc.academic.listSubjects.useQuery(undefined, { enabled: Boolean(user) });
  
  const [selectedId, setSelectedId] = useState<number | null>(null); 
  const selected = trpc.research.get.useQuery({ briefId: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  
  const [composerOpen, setComposerOpen] = useState(false); 
  const [topic, setTopic] = useState(""); 
  const [subjectId, setSubjectId] = useState(""); 
  const [sourceTitle, setSourceTitle] = useState(""); 
  const [sourceUrl, setSourceUrl] = useState(""); 
  const [sourceNote, setSourceNote] = useState(""); 
  const [error, setError] = useState<string | null>(null); 
  const [exportingCanvas, setExportingCanvas] = useState(false); 
  const canvasRef = useRef<HTMLDivElement>(null);

  const createFromTopic = trpc.research.createFromTopic.useMutation(); 
  const synthesize = trpc.research.synthesize.useMutation(); 
  const addSource = trpc.research.addSource.useMutation(); 
  const exportDocument = trpc.research.exportDocument.useMutation();

  useEffect(() => { 
    if (!loading && !authError && !user) setLocation("/login"); 
  }, [authError, loading, setLocation, user]);

  // Read search query params for subjectId or new=1
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sub = params.get("subjectId");
    if (sub) {
      setSubjectId(sub);
      setComposerOpen(true);
    }
    if (params.get("new") === "1" || params.get("create") === "1") {
      setComposerOpen(true);
    }
  }, [search]);

  useEffect(() => { 
    if (!selectedId && briefs.data?.[0]) setSelectedId(briefs.data[0].id); 
  }, [briefs.data, selectedId]);

  const brief = selected.data?.brief; 
  const videos = trpc.research.videos.useQuery({ query: brief?.title || "study topic" }, { enabled: Boolean(brief) }); 
  const community = trpc.research.community.useQuery({ query: brief?.title || "study topic" }, { enabled: Boolean(brief) }); 
  const exportHistory = trpc.research.exports.useQuery({ briefId: selectedId ?? 0 }, { enabled: Boolean(selectedId) });

  const sourceItems = selected.data?.sources ?? []; 
  const keyConcepts = useMemo(() => concepts(brief?.keyConcepts), [brief?.keyConcepts]); 
  const studyQuestions = useMemo(() => strings(brief?.studyQuestions), [brief?.studyQuestions]); 
  const actionPlan = useMemo(() => strings(brief?.actionPlan), [brief?.actionPlan]); 
  const projectBoard = useMemo(() => board(brief?.boardContent), [brief?.boardContent]);
  
  const resolved = useMemo(() => 
    getResolvedPaperData(brief?.title || "", brief?.overview, projectBoard),
    [brief?.title, brief?.overview, projectBoard]
  );
  
  const parsedObjectives = useMemo(() => 
    parseObjectives(projectBoard.objectives),
    [projectBoard.objectives]
  );

  const speechText = useMemo(() => {
    if (!brief) return "";
    const parts: string[] = [];

    // Title & Abstract
    parts.push(`${brief.title}.`);
    if (brief.researchQuestion) {
      parts.push(`Abstract and Central Inquiry: ${brief.researchQuestion}.`);
    }

    // Section 1.0 Definition & Scope
    parts.push(`Section 1: Definition and Comprehensive Description.`);
    if (resolved.definition) {
      parts.push(`Formal Academic Definition: ${resolved.definition}.`);
    }
    if (resolved.description) {
      parts.push(`Comprehensive Description and Domain Context: ${resolved.description}.`);
    }

    // Section 2.0 Operational Architecture
    if (resolved.howItWorks) {
      parts.push(`Section 2: Operational Architecture and How It Works. Core Mechanisms and Execution Flow: ${resolved.howItWorks}.`);
    }

    // Section 3.0 Chronology & Global Landscape
    parts.push(`Section 3: Chronology and Global Landscape.`);
    if (resolved.pastSummary) {
      parts.push(`Historical Genesis and Origins: ${resolved.pastSummary}.`);
    }
    if (resolved.presentAndContributors) {
      parts.push(`Current Ecosystem and Active Pioneers: ${resolved.presentAndContributors}.`);
    }
    if (resolved.futureOutlook) {
      parts.push(`Future Horizon and Breakthrough Trajectory: ${resolved.futureOutlook}.`);
    }

    // Section 4.0 Research Objectives & Questions
    if (parsedObjectives.length > 0 || studyQuestions.length > 0) {
      parts.push(`Section 4: Research Objectives and Investigative Questions.`);
      if (parsedObjectives.length > 0) {
        const objText = parsedObjectives
          .map((obj, i) => `Objective ${i + 1}: ${obj.title}. ${obj.description || ""}`)
          .join(" ");
        parts.push(`Core Research Objectives: ${objText}`);
      }
      if (studyQuestions.length > 0) {
        const qText = studyQuestions
          .map((q, i) => `Question ${i + 1}: ${q}`)
          .join(" ");
        parts.push(`Questions Under Investigation: ${qText}`);
      }
    }

    // Section 5.0 Key Conceptual Foundations
    if (keyConcepts.length > 0) {
      const conceptsText = keyConcepts
        .map((c, i) => `Concept ${i + 1}: ${c.name}. ${c.explanation}`)
        .join(" ");
      parts.push(`Section 5: Key Conceptual Foundations. ${conceptsText}`);
    }

    // Section 6.0 Methodology, Applications, Action Plan & Checklist
    const methodItems = strings(projectBoard.methodology);
    const appItems = strings(projectBoard.applications);
    const miscItems = strings(projectBoard.misconceptions);
    const checkItems = strings(projectBoard.verificationChecklist);

    if (methodItems.length || appItems.length || actionPlan.length || miscItems.length || checkItems.length) {
      parts.push(`Section 6: Methodology, Applications, and Study Sequence.`);
      if (methodItems.length) {
        parts.push(`Methodology: ${methodItems.join(". ")}.`);
      }
      if (appItems.length) {
        parts.push(`Applications and Impact: ${appItems.join(". ")}.`);
      }
      if (actionPlan.length) {
        parts.push(`Study Timeline: ${actionPlan.join(". ")}.`);
      }
      if (miscItems.length) {
        parts.push(`Misconceptions to Avoid: ${miscItems.join(". ")}.`);
      }
      if (checkItems.length) {
        parts.push(`Verification Checklist: ${checkItems.join(". ")}.`);
      }
    }

    // Section 7.0 Authoritative Statement & Perspective
    if (resolved.quote?.text) {
      parts.push(
        `Section 7: Authoritative Perspective. "${resolved.quote.text}" by ${resolved.quote.author || "Scholarly Authority"}. ${resolved.quote.context || ""}`
      );
    }

    return parts.filter(Boolean).join(" ");
  }, [
    brief?.title,
    brief?.researchQuestion,
    resolved.definition,
    resolved.description,
    resolved.howItWorks,
    resolved.pastSummary,
    resolved.presentAndContributors,
    resolved.futureOutlook,
    resolved.quote?.text,
    resolved.quote?.author,
    resolved.quote?.context,
    parsedObjectives,
    studyQuestions,
    keyConcepts,
    projectBoard.methodology,
    projectBoard.applications,
    projectBoard.misconceptions,
    projectBoard.verificationChecklist,
    actionPlan
  ]);

  const lectureText = useMemo(() => {
    if (!brief) return "";
    return generateResearchLecture(
      { title: brief.title, researchQuestion: brief.researchQuestion },
      resolved,
      parsedObjectives,
      studyQuestions,
      keyConcepts,
      projectBoard,
      actionPlan
    );
  }, [
    brief?.title,
    brief?.researchQuestion,
    resolved,
    parsedObjectives,
    studyQuestions,
    keyConcepts,
    projectBoard,
    actionPlan
  ]);

  if (loading) return <AppLoading />; 
  if (authError) return <AuthError message={authError} />; 
  if (!user) return <AppLoading />;

  async function createBrief(event: FormEvent) { 
    event.preventDefault(); 
    setError(null); 
    try { 
      const created = await createFromTopic.mutateAsync({ topic, subjectId: subjectId ? Number(subjectId) : null }); 
      setSelectedId(created.brief.id); 
      await synthesize.mutateAsync({ briefId: created.brief.id }); 
      await Promise.all([utils.research.list.invalidate(), utils.research.get.invalidate({ briefId: created.brief.id })]); 
      setComposerOpen(false); 
      setTopic(""); 
      setSubjectId(""); 
    } catch (caught) { 
      setError(formatError(caught, "Could not build this research paper.")); 
    } 
  }

  async function runSynthesis() { 
    if (!selectedId) return; 
    setError(null); 
    try { 
      await synthesize.mutateAsync({ briefId: selectedId }); 
      await Promise.all([utils.research.list.invalidate(), utils.research.get.invalidate({ briefId: selectedId })]); 
    } catch (caught) { 
      setError(formatError(caught, "The research synthesis could not be created.")); 
    } 
  }

  async function saveSource(event: FormEvent) { 
    event.preventDefault(); 
    if (!selectedId) return; 
    setError(null); 
    try { 
      await addSource.mutateAsync({ briefId: selectedId, title: sourceTitle, url: sourceUrl || null, note: sourceNote || null }); 
      await utils.research.get.invalidate({ briefId: selectedId }); 
      setSourceTitle(""); 
      setSourceUrl(""); 
      setSourceNote(""); 
    } catch (caught) { 
      setError(formatError(caught, "Could not save this source note.")); 
    } 
  }

  async function downloadToDevice(exportId: number, fileName: string) { 
    const token = getSupabaseAccessToken(); 
    if (!token) throw new Error("Your session is no longer active. Please sign in again."); 
    const response = await fetch(`/api/research-exports/${exportId}/download`, { headers: { Authorization: `Bearer ${token}` } }); 
    if (!response.ok) throw new Error("The saved research paper could not be downloaded."); 
    const objectUrl = URL.createObjectURL(await response.blob()); 
    const link = document.createElement("a"); 
    link.href = objectUrl; 
    link.download = fileName; 
    document.body.appendChild(link); 
    link.click(); 
    link.remove(); 
    URL.revokeObjectURL(objectUrl); 
  }

  async function saveResearchDocument() { 
    if (!selectedId) return; 
    setError(null); 
    try { 
      const saved = await exportDocument.mutateAsync({ briefId: selectedId }); 
      await utils.research.exports.invalidate({ briefId: selectedId }); 
      await downloadToDevice(saved.export.id, saved.export.fileName); 
    } catch (caught) { 
      setError(formatError(caught, "Could not save this research paper.")); 
    } 
  }

  async function downloadSavedExport(exportId: number, fileName: string) { 
    setError(null); 
    try { 
      await downloadToDevice(exportId, fileName); 
    } catch (caught) { 
      setError(caught instanceof Error ? caught.message : "Could not download this research paper."); 
    } 
  }

  async function downloadCanvasImage() { 
    if (!canvasRef.current || !brief) return; 
    setError(null); 
    setExportingCanvas(true); 
    try { 
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, backgroundColor: "#FDFBFB", pixelRatio: 2 }); 
      const link = document.createElement("a"); 
      link.href = dataUrl; 
      link.download = `${brief.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "research-paper"}-preprint.png`; 
      document.body.appendChild(link); 
      link.click(); 
      link.remove(); 
    } catch { 
      setError("The canvas image could not be created. Please try again."); 
    } finally { 
      setExportingCanvas(false); 
    } 
  }

  const miniList = (items: string[], tone = "bg-[#F8E7E7]") => items.length ? (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className={`mt-1 h-3.5 w-3.5 shrink-0 rotate-3 ${tone} shadow-sm`} />
          <div className="flex-1 min-w-0 text-[12px] leading-5 text-[#724060]">
            <MathRenderer content={item} />
          </div>
        </li>
      ))}
    </ul>
  ) : <p className="text-[12px] text-[#A070A1]">Section under synthesis.</p>;

  return (
    <StudentAppShell>
      <div className="min-h-screen bg-[#F8E7E7] px-4 py-5 sm:px-7 sm:py-8 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          
          {/* Header Banner */}
          <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#522943] via-[#724060] to-[#8C5378] px-6 py-7 text-[#FDF3F3] shadow-[0_18px_44px_rgba(114,64,96,.20)] sm:px-9">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[#F8E7E7]/10 blur-2xl" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[.16em] text-[#F8E7E7] backdrop-blur-md">
                  <Compass className="h-3.5 w-3.5" /> Academic Research Canvas
                </p>
                <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
                  Build a publication-grade research paper for any topic.
                </h1>
                <p className="mt-2 text-[13.5px] leading-6 text-[#F8E7E7]/85">
                  Transforms any inquiry into a structured scholarly paper: formal definitions, operational mechanisms, past-present-future landscape, research objectives, verified videos, and downloadable papers.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-bold text-[#724060] shadow-sm transition hover:bg-[#FDF3F3] cursor-pointer"
                  >
                    <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" /> Start a research paper
                  </button>
                </div>
              </div>
              <div className="hidden lg:block">
                <FloatingHeroIllustration
                  src="/illustrations/research-canvas-diagram.jpg"
                  alt="Research Paper Mind-Map"
                  caption="Topic → Paper, Citations & Videos"
                />
              </div>
            </div>
          </header>

          {(error || briefs.error) && (
            <div role="alert" className="mt-5 flex items-center justify-between gap-3 border-l-4 border-[#724060] bg-[#FDF3F3] p-4 text-sm text-[#724060] shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#A070A1]" />
                <span>{error || "Unable to reach the server. Please check the active link or click retry."}</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { 
                    setError(null); 
                    utils.research.list.invalidate(); 
                    if (selectedId) utils.research.get.invalidate({ briefId: selectedId }); 
                  }} 
                  className="rounded bg-[#F8E7E7] px-3 py-1 text-[12px] font-bold text-[#724060] hover:bg-[#FDF3F3] transition"
                >
                  Retry
                </button>
                <button onClick={() => setError(null)} className="rounded p-1 text-[#A070A1] hover:bg-[#FDF3F3] hover:text-[#724060] transition" aria-label="Dismiss error">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-6">
            {/* Library Selector */}
            <aside className="rounded-[24px] border border-[#F8E7E7] bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#F8E7E7] px-2 pb-3">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[.16em] text-[#A070A1]">Project library</p>
                  <p className="mt-0.5 text-[12px] text-[#724060]/75">Saved research papers</p>
                </div>
                <span className="rounded-full bg-[#FDF3F3] px-2.5 py-0.5 text-[11px] font-bold text-[#724060]">{briefs.data?.length ?? 0} saved</span>
              </div>
              <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
                {briefs.data?.length ? briefs.data.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => setSelectedId(item.id)} 
                    className={`min-w-[230px] rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                      item.id === selectedId
                        ? "border-[#724060] bg-[#FDF3F3] shadow-xs"
                        : "border-[#F8E7E7] bg-[#FDF3F3]/40 hover:bg-[#FDF3F3]"
                    }`}
                  >
                    <p className="line-clamp-1 text-[13px] font-bold text-[#2D1826]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-4 text-[#724060]/70">{item.researchQuestion}</p>
                  </button>
                )) : <p className="p-4 text-center text-[12px] leading-5 text-[#A070A1]">Your saved research papers will appear here.</p>}
              </div>
            </aside>

            <main className="min-w-0">
              {brief ? (
                <>
                  {/* Action Toolbar & Topic Summary */}
                  <div className="rounded-[24px] border border-[#F8E7E7] bg-white p-5 shadow-xs sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF3F3] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[.14em] text-[#724060]">
                          <Sparkles className="h-3 w-3 text-[#A070A1]" />
                          {brief.status === "ready" ? "Research Paper Ready" : "Synthesis in Progress"}
                        </span>
                        <h2 className="mt-2.5 text-[26px] font-bold tracking-tight text-[#2D1826] sm:text-[32px]">
                          {brief.title}
                        </h2>
                        <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-[#724060]/80">
                          {brief.researchQuestion}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <MorphCopyButton
                          text={speechText}
                          label="Copy Paper"
                          className="h-10 px-4 text-[12px]"
                        />
                        <button 
                          onClick={runSynthesis} 
                          disabled={synthesize.isPending || brief.status === "generating"} 
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#724060] px-4 text-[12px] font-bold text-white disabled:opacity-60 shadow-xs transition hover:bg-[#5a334c] cursor-pointer"
                        >
                          <Wand2 className="h-4 w-4" />
                          {synthesize.isPending ? "Synthesizing…" : "Deepen Paper"}
                        </button>
                        <button 
                          onClick={downloadCanvasImage} 
                          disabled={exportingCanvas || brief.status !== "ready"} 
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#724060]/15 bg-[#FDF3F3] px-4 text-[12px] font-bold text-[#724060] disabled:opacity-60 transition hover:bg-[#F8E7E7] cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                          {exportingCanvas ? "Rendering Paper…" : "Download Paper Image"}
                        </button>
                        <button 
                          onClick={saveResearchDocument} 
                          disabled={exportDocument.isPending} 
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#724060]/15 bg-[#FDF3F3] px-4 text-[12px] font-bold text-[#724060] disabled:opacity-60 transition hover:bg-[#F8E7E7] cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                          {exportDocument.isPending ? "Preparing…" : "Download Research Paper (.md)"}
                        </button>
                      </div>
                    </div>
                    {brief.failureReason && (
                      <p className="mt-4 border-l-4 border-[#A070A1] bg-[#FDF3F3] p-3 text-[13px] text-[#724060]">{brief.failureReason}</p>
                    )}
                  </div>

                  {/* Multi-Step AI Synthesis Animation when generating */}
                  {(synthesize.isPending || brief.status === "generating") && (
                    <div className="mt-6">
                      <AiSynthesisLoader
                        title="Synthesizing Publication-Grade Research Paper…"
                        steps={[
                          "Formulating academic definitions & operational mechanisms…",
                          "Mapping past, present & future scientific landscape…",
                          "Verifying scholarly citations & YouTube lectures…",
                          "Typesetting multi-section research canvas…",
                        ]}
                      />
                    </div>
                  )}

                  {/* Voice Mode Audio Reader Bar */}
                  {brief.status === "ready" && (
                    <div className="mt-6">
                      <VoiceReader
                        title={`Listen to "${brief.title}" Preprint`}
                        text={speechText}
                        lectureText={lectureText}
                      />
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* RESEARCH PAPER CANVAS (Arranged like an authentic publication) */}
                  {/* ============================================================== */}
                  {brief.status === "ready" ? (
                    <div 
                      ref={canvasRef} 
                      className="mt-6 overflow-hidden rounded-[14px] border-2 border-[#724060]/20 bg-[#FDFBFB] p-6 shadow-[0_20px_60px_rgba(114,64,96,.10)] sm:p-10 lg:p-12"
                    >
                      {/* Paper Masthead */}
                      <header className="border-b-2 border-[#724060] pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-extrabold uppercase tracking-[.22em] text-[#A070A1]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>StudentGPT Research Study Guide</span>
                            {resolved.topicType && (
                              <span className="rounded bg-[#724060] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FDF3F3]">
                                {formatTopicType(resolved.topicType)}
                              </span>
                            )}
                          </div>
                          <span className="rounded bg-[#F8E7E7] px-2.5 py-1 text-[#724060]">
                            AI-generated study guide · Check against sources
                          </span>
                        </div>
                        <h2 className="mt-5 text-3xl font-extrabold tracking-[-.035em] text-[#724060] sm:text-4xl lg:text-5xl font-serif">
                          {brief.title}
                        </h2>
                        <div className="mt-4 border-l-4 border-[#724060] bg-[#F8E7E7]/50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#A070A1]">Abstract & Central Inquiry</p>
                          <div className="mt-1 text-[13px] italic leading-6 text-[#724060]">
                            <MathRenderer content={brief.researchQuestion} />
                          </div>
                        </div>
                      </header>

                      {/* Section 1.0 Definition & Scope */}
                      <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">1</span>
                          <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Definition & Comprehensive Description</h3>
                        </div>
                        <div className="mt-4 space-y-4">
                          {/* 1.1 Definition */}
                          <div className="rounded-lg border border-[#A070A1]/30 bg-[#F8E7E7]/50 p-4 sm:p-5">
                            <div className="flex items-center gap-2">
                              <BookOpenCheck className="h-4 w-4 text-[#724060]" />
                              <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">1.1 Formal Academic Definition</h4>
                            </div>
                            <div className="mt-2 text-[13px] font-medium leading-6 text-[#724060]">
                              {resolved.definition ? (
                                <MathRenderer content={resolved.definition} />
                              ) : (
                                <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                              )}
                            </div>
                          </div>
                          {/* 1.2 Description */}
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">1.2 Comprehensive Description & Domain Context</h4>
                            <div className="mt-2 space-y-3 text-[13px] leading-6 text-[#724060]/90">
                              {resolved.description ? (
                                <MathRenderer content={resolved.description} />
                              ) : (
                                <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section 2.0 Operational Architecture: How It Works */}
                      <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">2</span>
                          <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Operational Architecture & How It Works</h3>
                        </div>
                        <div className="mt-4 rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-5 sm:p-6">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-[#A070A1]" />
                            <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Core Mechanisms & Execution Flow</h4>
                          </div>
                          <div className="mt-2.5 text-[13px] leading-6 text-[#724060]">
                            {resolved.howItWorks ? (
                              <MathRenderer content={resolved.howItWorks} />
                            ) : (
                              <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Section 3.0 Chronology & Global Landscape (Past, Present & Future) */}
                      <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">3</span>
                          <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Chronology & Global Landscape</h3>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          {/* 3.1 Past */}
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-5">
                            <div className="flex items-center gap-1.5 text-[#A070A1]">
                              <Clock className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-[.14em]">3.1 Historical Genesis (Past)</span>
                            </div>
                            <h5 className="mt-2 text-[13px] font-bold text-[#724060]">Origins & Discovery Timeline</h5>
                            <div className="mt-2 text-[12px] leading-5 text-[#724060]/90">
                              {resolved.pastSummary ? (
                                <MathRenderer content={resolved.pastSummary} />
                              ) : (
                                <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                              )}
                            </div>
                          </div>
                          {/* 3.2 Present */}
                          <div className="rounded-lg border-2 border-[#A070A1]/30 bg-[#F8E7E7]/50 p-5">
                            <div className="flex items-center gap-1.5 text-[#724060]">
                              <Users className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-[.14em]">3.2 Current Ecosystem (Present)</span>
                            </div>
                            <h5 className="mt-2 text-[13px] font-bold text-[#724060]">Active Pioneers & Institutions</h5>
                            <div className="mt-2 text-[12px] leading-5 text-[#724060]">
                              {resolved.presentAndContributors ? (
                                <MathRenderer content={resolved.presentAndContributors} />
                              ) : (
                                <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                              )}
                            </div>
                          </div>
                          {/* 3.3 Future */}
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-5">
                            <div className="flex items-center gap-1.5 text-[#A070A1]">
                              <Compass className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-[.14em]">3.3 Future Horizon (Future)</span>
                            </div>
                            <h5 className="mt-2 text-[13px] font-bold text-[#724060]">Breakthrough Trajectory</h5>
                            <div className="mt-2 text-[12px] leading-5 text-[#724060]/90">
                              {resolved.futureOutlook ? (
                                <MathRenderer content={resolved.futureOutlook} />
                              ) : (
                                <p className="text-[12px] italic text-[#A070A1]">Couldn't generate this section. Please try synthesizing again.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section 4.0 Research Objectives & Investigative Questions */}
                      {(parsedObjectives.length > 0 || studyQuestions.length > 0) && (
                        <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">4</span>
                            <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Research Objectives & Questions</h3>
                          </div>
                          <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                            <div>
                              <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">4.1 Core Research Objectives</h4>
                              <div className="mt-3 space-y-3">
                                {parsedObjectives.map((obj, idx) => (
                                  <div key={idx} className="rounded border-l-4 border-[#724060] bg-[#F8E7E7]/40 p-3.5 pl-4">
                                    <h5 className="text-[13px] font-bold text-[#724060]">
                                      <MathRenderer content={obj.title} inline={true} />
                                    </h5>
                                    {obj.description && (
                                      <div className="mt-1 text-[12px] leading-5 text-[#724060]/90">
                                        <MathRenderer content={obj.description} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">4.2 Questions Under Investigation</h4>
                              <ol className="mt-3 space-y-2.5">
                                {studyQuestions.map((q, idx) => (
                                  <li key={idx} className="flex gap-2.5 rounded border border-[#F8E7E7] bg-[#FDF3F3] p-3 text-[12px] leading-5 text-[#724060]">
                                    <span className="font-bold text-[#A070A1]">{idx + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer content={q} />
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Section 5.0 Key Conceptual Foundations */}
                      {keyConcepts.length > 0 && (
                        <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">5</span>
                            <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Key Conceptual Foundations</h3>
                          </div>
                          <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                            {keyConcepts.map((concept, index) => (
                              <div key={index} className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                                <p className="text-[13px] font-bold text-[#724060]">
                                  <MathRenderer content={concept.name} inline={true} />
                                </p>
                                <div className="mt-1 text-[12px] leading-5 text-[#724060]/85">
                                  <MathRenderer content={concept.explanation} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Section 6.0 Methodologies, Applications & Study Sequence */}
                      <section className="mt-8 border-b border-[#F8E7E7] pb-8">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded bg-[#724060] text-xs font-bold text-[#FDF3F3]">6</span>
                          <h3 className="text-[16px] font-bold tracking-tight text-[#724060]">Methodology, Impact & Action Plan</h3>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Methodology</h4>
                            <div className="mt-2">{miniList(strings(projectBoard.methodology), "bg-[#F8E7E7]")}</div>
                          </div>
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Applications & Impact</h4>
                            <div className="mt-2">{miniList(strings(projectBoard.applications), "bg-[#F8E7E7]")}</div>
                          </div>
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Study Timeline</h4>
                            <div className="mt-2">{miniList(actionPlan, "bg-[#F8E7E7]")}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Misconceptions to Avoid</h4>
                            <div className="mt-2">{miniList(strings(projectBoard.misconceptions), "bg-[#F8E7E7]")}</div>
                          </div>
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A070A1]">Verification Checklist</h4>
                            <div className="mt-2">{miniList(strings(projectBoard.verificationChecklist), "bg-[#F8E7E7]")}</div>
                          </div>
                        </div>
                      </section>

                      {/* Areas to Double-Check / Verification Advisory */}
                      {resolved.limitations.length > 0 && (
                        <section className="mt-8 rounded-lg border-2 border-[#A070A1]/30 bg-[#F8E7E7]/60 p-5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-[#724060]" />
                            <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#724060]">
                              Areas to Double-Check (Verification Advisory)
                            </h4>
                          </div>
                          <p className="mt-1 text-[11px] text-[#A070A1]">
                            The following details were noted as requiring careful double-checking against authoritative primary sources:
                          </p>
                          <ul className="mt-2.5 space-y-1.5">
                            {resolved.limitations.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[12px] leading-5 text-[#724060]">
                                <span className="font-bold text-[#A070A1]">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {/* Section 7.0 Authoritative Perspective & Statement (Only shown if authentic quote is present) */}
                      {resolved.quote && resolved.quote.text && (
                        <section className="mt-8 rounded-xl border-2 border-[#724060]/20 bg-[#F8E7E7]/50 p-6 sm:p-8 text-center shadow-sm">
                          <QuoteIcon className="mx-auto h-8 w-8 text-[#A070A1]" />
                          <div className="mx-auto mt-3 max-w-3xl font-serif text-[16px] italic leading-7 text-[#724060] sm:text-[18px]">
                            "<MathRenderer content={resolved.quote.text} inline={true} />"
                          </div>
                          <div className="mt-4 flex flex-col items-center justify-center">
                            <span className="text-[13px] font-bold tracking-wide text-[#724060]">— {resolved.quote.author || "Authority"}</span>
                            {resolved.quote.context && (
                              <span className="mt-0.5 text-[11px] text-[#A070A1]">{resolved.quote.context}</span>
                            )}
                          </div>
                        </section>
                      )}

                      {/* Paper Footer */}
                      <footer className="mt-8 border-t border-[#F8E7E7] pt-4 flex flex-wrap items-center justify-between text-[11px] text-[#A070A1]">
                        <span>StudentGPT Academic Research Study Guide · Continuous Learning Synthesis</span>
                        <span>Downloadable as High-Resolution Image or Markdown Document</span>
                      </footer>
                    </div>
                  ) : brief.status === "failed" ? (
                    <div className="mt-6 rounded-xl border-2 border-[#724060]/30 bg-[#F8E7E7] p-8 text-center shadow-sm">
                      <AlertTriangle className="mx-auto h-8 w-8 text-[#724060]" />
                      <h3 className="mt-3 text-[16px] font-bold text-[#724060]">Couldn't generate research synthesis</h3>
                      <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-[#724060]/90">
                        {brief.failureReason || "The model output could not be validated against academic standards. Please retry."}
                      </p>
                      <button
                        onClick={runSynthesis}
                        disabled={synthesize.isPending}
                        className="mt-5 inline-flex items-center gap-2 bg-[#724060] px-5 py-2.5 text-[12px] font-bold text-[#FDF3F3] shadow-md transition hover:bg-[#5e344e] disabled:opacity-60"
                      >
                        <Wand2 className="h-4 w-4" />
                        {synthesize.isPending ? "Retrying Synthesis…" : "Retry Synthesis"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-10 text-center text-sm text-[#A070A1]">
                      StudentGPT is preparing the research paper synthesis.
                    </div>
                  )}

                  {/* ============================================================== */}
                  {/* SECTION 8: EXTERNAL RESOURCES APPENDIX (Videos, Documents, Community) */}
                  {/* ============================================================== */}
                  
                  {/* Topic-Matched YouTube Videos */}
                  <section className="mt-8 border border-[#F8E7E7] bg-[#FDF3F3] p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <PlayCircle className="h-4 w-4 text-[#A070A1]" />
                          <h3 className="text-[15px] font-bold text-[#724060]">Verified Video Lectures & Resources</h3>
                        </div>
                        <p className="mt-1 text-[12px] leading-5 text-[#A070A1]">
                          Videos retrieved using the exact topic title and ranked by syllabus relevance.
                        </p>
                      </div>
                      <span className="bg-[#F8E7E7] px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#A070A1]">YouTube</span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {videos.isLoading ? (
                        [1, 2, 3].map(item => <div key={item} className="h-44 animate-pulse bg-[#F8E7E7]" />)
                      ) : videos.data?.length ? (
                        videos.data.map(video => (
                          <a 
                            key={video.id} 
                            href={video.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="group overflow-hidden border border-[#F8E7E7] bg-[#FDF3F3] transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="h-28 w-full object-cover" />}
                            <div className="p-3">
                              <p className="line-clamp-2 text-[13px] font-bold leading-5 text-[#724060]">{video.title}</p>
                              <p className="mt-1 truncate text-[11px] text-[#A070A1]">{video.channelTitle}</p>
                              <p className="mt-3 text-[10px] font-bold uppercase tracking-[.1em] text-[#A070A1]">{video.relevance} · Watch video</p>
                            </div>
                          </a>
                        ))
                      ) : (
                        <p className="border border-dashed border-[#F8E7E7] p-4 text-[12px] text-[#A070A1]">
                          No topic-matched YouTube videos were returned. Try refreshing the canvas with a more specific title.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Documents & Community Perspectives */}
                  <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
                    <section className="border border-[#F8E7E7] bg-[#FDF3F3] p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <MessageCircleMore className="h-4 w-4 text-[#A070A1]" />
                        <h3 className="text-[14px] font-bold">Scholarly & Community Discussions</h3>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[#A070A1]">
                        Reddit and Quora discussions provide qualitative community context and edge-case perspectives.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {community.data?.slice(0, 4).map(item => (
                          <a 
                            key={item.url} 
                            href={item.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="border border-[#F8E7E7] bg-[#FDF3F3] p-3 hover:bg-[#F8E7E7] transition"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#A070A1]">{item.source}</span>
                            <p className="mt-2 line-clamp-2 text-[12px] font-bold leading-5 text-[#724060]">{item.title}</p>
                          </a>
                        ))}
                      </div>
                    </section>

                    <section className="border border-[#F8E7E7] bg-[#FDF3F3] p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#A070A1]" />
                        <h3 className="text-[14px] font-bold">Saved Research Papers</h3>
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-[#A070A1]">
                        Download a publication-ready Markdown research paper directly to this device.
                      </p>
                      <div className="mt-4 space-y-2">
                        {exportHistory.data?.length ? (
                          exportHistory.data.map(item => (
                            <button 
                              key={item.id} 
                              onClick={() => downloadSavedExport(item.id, item.fileName)} 
                              className="flex w-full items-center justify-between gap-3 border border-[#F8E7E7] bg-[#FDF3F3] px-3 py-2 text-left hover:bg-[#F8E7E7] transition"
                            >
                              <span className="truncate text-[12px] font-bold text-[#724060]">{item.fileName}</span>
                              <Download className="h-3.5 w-3.5 shrink-0 text-[#A070A1]" />
                            </button>
                          ))
                        ) : (
                          <p className="rounded-xl bg-[#FDF3F3] p-3 text-[12px] text-[#A070A1]">
                            Use "Download Research Paper" to generate the first local document.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Source Desk */}
                  <section className="mt-6 border border-[#F8E7E7] bg-[#FDF3F3] p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#A070A1]" />
                      <h3 className="text-[14px] font-bold">Student Source Desk & Field Notes</h3>
                    </div>
                    <p className="mt-1 text-[12px] text-[#A070A1]">
                      Add citations, professor notes, or reference links to deepen future syntheses.
                    </p>
                    <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_.9fr]">
                      <div className="space-y-2">
                        {sourceItems.length ? (
                          sourceItems.map(source => (
                            <div key={source.id} className="border border-[#F8E7E7] bg-[#FDF3F3] p-3">
                              <p className="text-[12px] font-bold text-[#724060]">{source.title}</p>
                              {source.url && (
                                <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[11px] text-[#A070A1] hover:underline">
                                  {source.url}
                                </a>
                              )}
                              {source.note && <p className="mt-2 text-[12px] leading-5 text-[#A070A1]">{source.note}</p>}
                            </div>
                          ))
                        ) : (
                          <p className="border border-dashed border-[#F8E7E7] p-4 text-[12px] text-[#A070A1]">No source notes saved yet.</p>
                        )}
                      </div>
                      <form onSubmit={saveSource} className="border border-[#F8E7E7] bg-[#FDF3F3] p-4">
                        <p className="text-[12px] font-bold text-[#724060]">Add source note</p>
                        <input 
                          required 
                          value={sourceTitle} 
                          onChange={event => setSourceTitle(event.target.value)} 
                          placeholder="Source title" 
                          className="mt-3 h-10 w-full border border-[#F8E7E7] px-3 text-[12px] outline-none focus:border-[#A070A1]" 
                        />
                        <input 
                          value={sourceUrl} 
                          onChange={event => setSourceUrl(event.target.value)} 
                          placeholder="Optional URL" 
                          type="url" 
                          className="mt-2 h-10 w-full border border-[#F8E7E7] px-3 text-[12px] outline-none focus:border-[#A070A1]" 
                        />
                        <textarea 
                          value={sourceNote} 
                          onChange={event => setSourceNote(event.target.value)} 
                          placeholder="Key evidence or notes" 
                          className="mt-2 min-h-20 w-full border border-[#F8E7E7] p-3 text-[12px] outline-none focus:border-[#A070A1]" 
                        />
                        <button disabled={addSource.isPending} className="mt-3 h-9 bg-[#724060] px-3 text-[12px] font-bold text-[#FDF3F3]">
                          Save source
                        </button>
                      </form>
                    </div>
                  </section>
                </>
              ) : (
                <div className="grid min-h-[460px] place-items-center rounded-[28px] border border-dashed border-[#F8E7E7] bg-white p-8 text-center shadow-xs">
                  <div className="flex flex-col items-center">
                    <div className="overflow-hidden rounded-2xl border border-[#724060]/12 bg-[#FDF3F3] shadow-xs">
                      <img
                        src="/illustrations/research-canvas-diagram.jpg"
                        alt="Research Studio Mind-Map"
                        className="h-40 w-64 object-cover"
                      />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-[#2D1826]">Start a publication-grade research paper.</h2>
                    <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#724060]/75">
                      Choose a topic and StudentGPT will create a formal research paper with definitions, operational mechanics, chronological landscape, objectives, and verified resources.
                    </p>
                    <button
                      onClick={() => setComposerOpen(true)}
                      className="mt-5 rounded-full bg-[#724060] px-5 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-[#5a334c] cursor-pointer"
                    >
                      + Start a Research Paper
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* New Topic Modal */}
          {composerOpen && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#724060]/40 p-4 backdrop-blur-sm">
              <form onSubmit={createBrief} className="w-full max-w-xl border border-[#F8E7E7] bg-[#FDF3F3] p-6 shadow-[0_24px_80px_rgba(10,20,30,.3)]">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#A070A1]">New research paper</p>
                <h2 className="mt-2 text-[25px] font-bold tracking-[-.04em] text-[#724060]">What would you like to investigate?</h2>
                <p className="mt-2 text-[13px] leading-5 text-[#A070A1]">
                  StudentGPT will generate a publication-ready academic research paper with definitions, mechanisms, chronology, and verified references.
                </p>
                <div className="mt-6 space-y-4">
                  <label className="block text-[12px] font-bold text-[#724060]">
                    Topic
                    <input 
                      required 
                      minLength={3} 
                      value={topic} 
                      onChange={event => setTopic(event.target.value)} 
                      placeholder="For example: Quantum computing, Computer networks, CRISPR gene editing" 
                      className="mt-1.5 h-11 w-full border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm outline-none focus:border-[#A070A1]" 
                    />
                  </label>
                  <label className="block text-[12px] font-bold text-[#724060]">
                    Connect to a subject <span className="font-normal text-[#A070A1]">optional</span>
                    <select 
                      value={subjectId} 
                      onChange={event => setSubjectId(event.target.value)} 
                      className="mt-1.5 h-11 w-full border border-[#F8E7E7] bg-[#FDF3F3] px-3 text-sm outline-none focus:border-[#A070A1]"
                    >
                      <option value="">No subject selected</option>
                      {subjects.data?.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setComposerOpen(false)} className="h-10 px-4 text-[13px] font-bold text-[#A070A1]">
                    Cancel
                  </button>
                  <button 
                    disabled={createFromTopic.isPending || synthesize.isPending} 
                    className="h-10 bg-[#724060] px-4 text-[13px] font-bold text-[#FDF3F3] disabled:opacity-60"
                  >
                    {createFromTopic.isPending || synthesize.isPending ? "Synthesizing paper…" : "Generate Research Paper"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </StudentAppShell>
  );
}
