import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { getSupabaseAccessToken } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { toPng } from "html-to-image";
import { 
  BookOpenCheck, Compass, Download, FileText, Lightbulb, 
  ListChecks, MessageCircleMore, Network, PlayCircle, Plus, 
  SearchCheck, Sparkles, Target, Wand2, Quote as QuoteIcon, 
  Clock, Users, Rocket, Cpu, CheckCircle2, AlertTriangle 
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
  definition?: string;
  description?: string;
  howItWorks?: string;
  pastSummary?: string;
  presentAndContributors?: string;
  futureOutlook?: string;
  quote?: Quote;
  projectFocus?: string;
  objectives?: Array<string | Objective>;
  methodology?: string[];
  applications?: string[];
  misconceptions?: string[];
  verificationChecklist?: string[];
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
    return [
      { title: "Foundational Comprehension", description: "Establish authoritative grasp of core principles, underlying mechanics, and key theoretical laws." },
      { title: "Mechanistic & Applied Analysis", description: "Investigate operational dynamics, real-world case studies, and engineering implementations." },
      { title: "Critical Synthesis & Evaluation", description: "Assess key architectural trade-offs, common misconceptions, and ongoing scientific frontiers." }
    ];
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

function getResolvedPaperData(title: string, briefOverview?: string | null, boardData?: Board) {
  const isQuantum = /quantum/i.test(title);
  
  const fallbackQuote = isQuantum ? {
    text: "Nature isn't classical, dammit, and if you want to make a simulation of nature, you'd better make it quantum mechanical, and by golly it's a wonderful problem, because it doesn't look so easy.",
    author: "Richard P. Feynman",
    context: "Nobel Laureate in Theoretical Physics (1981 MIT Keynote)"
  } : {
    text: "Research is to see what everybody else has seen, and to think what nobody else has thought.",
    author: "Albert Szent-Györgyi",
    context: "Nobel Laureate in Physiology or Medicine"
  };

  const fallbackDefinition = isQuantum
    ? "Quantum computing is a revolutionary computational paradigm that leverages the foundational principles of quantum mechanics—principally linear superposition, quantum entanglement, and interference—to process complex information exponentially faster than classical Turing architectures for targeted problem classes."
    : `${title} is an academic and technical discipline that investigates core theoretical principles, operational mechanisms, and architectural frameworks to analyze and solve complex systems challenges.`;

  const fallbackHowItWorks = isQuantum
    ? "Unlike classical systems that store data in discrete binary bits (0 or 1), quantum computers process information using quantum bits (qubits). Qubits exist in continuous linear superpositions of orthogonal states (|0⟩ and |1⟩) governed by complex probability amplitudes. Through a sequence of unitary quantum logic gates (such as Hadamard, Pauli-X, CNOT, and Toffoli gates), a quantum circuit manipulates these wavefunctions, using constructive interference to amplify correct solution states and destructive interference to cancel erroneous paths. Multi-qubit entanglement links states instantaneously across an exponentially expanding Hilbert space (2ⁿ dimensions for n qubits), enabling algorithms like Shor's algorithm (prime factorization) and Grover's algorithm (database search) to achieve unprecedented computational speedups."
    : `${title} operates through a structured sequence of interconnected subsystems and operational workflows. Data and state inputs are ingested, normalized, and transformed according to formal domain rules and mathematical formulations. Internal modules coordinate state changes, execute control flows, and apply deterministic or probabilistic algorithms, ensuring high fidelity, error mitigation, and verifiable outputs across real-world operational environments.`;

  const fallbackPast = isQuantum
    ? "The conceptual foundation of quantum computing was proposed in 1981 by Nobel laureate Richard Feynman and Paul Benioff, who realized that simulating quantum physical systems with classical computers required exponential resources. In 1985, David Deutsch formalized the universal quantum Turing machine. The discipline accelerated in 1994 when Peter Shor unveiled a polynomial-time algorithm for factoring large integers, proving that quantum hardware could theoretically break standard RSA cryptography. Lov Grover's 1996 quadratic search algorithm and subsequent discoveries in quantum error-correcting codes established the formal theoretical framework."
    : `The historical foundation of ${title} traces back to seminal academic inquiries and early pioneering experiments. Early researchers established the foundational theorems, overcoming initial physical and mathematical constraints through iterative breakthroughs. Over successive decades, key academic milestones transformed theoretical hypotheses into a formal, autonomous discipline with standardized methodologies.`;

  const fallbackPresent = isQuantum
    ? "Presently, quantum computing is driven by global collaboration across hardware architectures including superconducting transmons, trapped ions, neutral atoms, and photonics. Leading pioneers include IBM Quantum (pioneering utility-scale 1,000+ qubit Condor and Heron processors), Google Quantum AI (advancing quantum supremacy and surface-code error mitigation), Microsoft Quantum (engineering topological Majorana qubits), IonQ, Rigetti, Quantinuum, and PsiQuantum. Leading research universities such as MIT, Oxford, Caltech, ETH Zurich, and Waterloo actively publish breakthroughs in quantum algorithms, error correction, and post-quantum cryptography."
    : `Presently, ${title} is at the forefront of international academic research and industrial application. Leading institutions including premier research universities (such as MIT, Stanford, Oxford, and Cambridge), industrial labs (including Google Research, IBM, Microsoft, and specialized research institutes), and open-source academic consortia are actively pushing state-of-the-art benchmarks, developing modern standards, and deploying scalable implementations.`;

  const fallbackFuture = isQuantum
    ? "The forward trajectory focuses on transitioning from Noisy Intermediate-Scale Quantum (NISQ) systems to fully Fault-Tolerant Quantum Computation (FTQC). As physical error rates cross below fault-tolerant thresholds via surface codes and lattice surgery, multi-million physical qubit systems will unlock profound breakthroughs in molecular chemistry (fertilizer catalysts, ambient-temperature superconductors), structural biology (rapid targeted drug discovery), global logistical optimization, and financial modeling."
    : `The future trajectory of ${title} points toward deep interdisciplinary integration, fault-tolerant reliability, and high-performance automation. Key upcoming milestones include overcoming existing scalability bottlenecks, developing adaptive algorithms, and enabling transformative breakthroughs across science, engineering, and society over the next decade.`;

  return {
    definition: boardData?.definition || fallbackDefinition,
    description: boardData?.description || briefOverview || "",
    howItWorks: boardData?.howItWorks || fallbackHowItWorks,
    pastSummary: boardData?.pastSummary || fallbackPast,
    presentAndContributors: boardData?.presentAndContributors || fallbackPresent,
    futureOutlook: boardData?.futureOutlook || fallbackFuture,
    quote: (boardData?.quote && boardData.quote.text) ? boardData.quote : fallbackQuote,
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
          <header className="relative overflow-hidden border border-[#A070A1] bg-[#724060] px-6 py-6 text-[#FDF3F3] shadow-[0_15px_42px_rgba(114,64,96,.18)] sm:px-8">
            <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(90deg, transparent 49.5%, #FDF3F3 50%, transparent 50.5%), linear-gradient(transparent 49.5%, #FDF3F3 50%, transparent 50.5%)", backgroundSize: "40px 40px" }} />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="inline-flex items-center gap-2 bg-[#F8E7E7] px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#724060]">
                  <Compass className="h-3.5 w-3.5" /> Academic Research Canvas
                </p>
                <h1 className="mt-4 max-w-3xl text-[30px] font-bold leading-[1.04] tracking-[-.05em] sm:text-[40px]">
                  Build a publication-grade research paper for any topic.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F8E7E7]">
                  Transforms any inquiry into a structured scholarly paper: formal definitions, operational mechanisms, past-present-future landscape, research objectives, verified videos, and downloadable papers.
                </p>
              </div>
              <button onClick={() => setComposerOpen(true)} className="inline-flex h-11 items-center gap-2 bg-[#F8E7E7] px-4 text-[13px] font-bold text-[#724060] shadow-sm transition hover:bg-[#FDF3F3]">
                <Plus className="h-4 w-4" /> Start a research paper
              </button>
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
                <button onClick={() => setError(null)} className="text-sm font-bold text-[#A070A1] hover:text-[#724060]">✕</button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-6">
            {/* Library Selector */}
            <aside className="border border-[#F8E7E7] bg-[#FDF3F3] p-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#F8E7E7] px-2 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#A070A1]">Project library</p>
                  <p className="mt-0.5 text-[12px] text-[#A070A1]">Saved research papers</p>
                </div>
                <span className="bg-[#F8E7E7] px-2 py-1 text-[11px] font-bold text-[#724060]">{briefs.data?.length ?? 0}</span>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {briefs.data?.length ? briefs.data.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => setSelectedId(item.id)} 
                    className={`min-w-[220px] border-l-4 px-3 py-3 text-left transition ${item.id === selectedId ? "border-[#A070A1] bg-[#FDF3F3]" : "border-transparent hover:bg-[#F8E7E7]"}`}
                  >
                    <p className="line-clamp-2 text-[13px] font-bold text-[#724060]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#A070A1]">{item.researchQuestion}</p>
                  </button>
                )) : <p className="p-4 text-center text-[12px] leading-5 text-[#A070A1]">Your saved research papers will appear here.</p>}
              </div>
            </aside>

            <main className="min-w-0">
              {brief ? (
                <>
                  {/* Action Toolbar & Topic Summary */}
                  <div className="border border-[#F8E7E7] bg-[#FDF3F3] p-5 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#A070A1]">
                          {brief.status === "ready" ? "Research Paper Ready" : "Synthesis in Progress"}
                        </p>
                        <h2 className="mt-2 text-[28px] font-bold tracking-[-.045em] text-[#724060] sm:text-[36px]">
                          {brief.title}
                        </h2>
                        <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#724060]">
                          {brief.researchQuestion}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={runSynthesis} 
                          disabled={synthesize.isPending || brief.status === "generating"} 
                          className="inline-flex h-10 items-center gap-2 bg-[#724060] px-3.5 text-[12px] font-bold text-[#FDF3F3] disabled:opacity-60 shadow-sm transition hover:bg-[#5e344e]"
                        >
                          <Wand2 className="h-4 w-4" />
                          {synthesize.isPending ? "Synthesizing…" : "Deepen Paper"}
                        </button>
                        <button 
                          onClick={downloadCanvasImage} 
                          disabled={exportingCanvas || brief.status !== "ready"} 
                          className="inline-flex h-10 items-center gap-2 bg-[#F8E7E7] px-3.5 text-[12px] font-bold text-[#724060] disabled:opacity-60 shadow-sm transition hover:bg-[#FDF3F3]"
                        >
                          <Download className="h-4 w-4" />
                          {exportingCanvas ? "Rendering Paper…" : "Download Paper Image"}
                        </button>
                        <button 
                          onClick={saveResearchDocument} 
                          disabled={exportDocument.isPending} 
                          className="inline-flex h-10 items-center gap-2 bg-[#F8E7E7] px-3.5 text-[12px] font-bold text-[#724060] disabled:opacity-60 shadow-sm transition hover:bg-[#FDF3F3]"
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
                          <span>StudentGPT Research Preprint · Peer-Indexed Canvas</span>
                          <span className="rounded bg-[#F8E7E7] px-2.5 py-1 text-[#724060]">Verified Academic Synthesis</span>
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
                              <MathRenderer content={resolved.definition} />
                            </div>
                          </div>
                          {/* 1.2 Description */}
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-[.14em] text-[#A070A1]">1.2 Comprehensive Description & Domain Context</h4>
                            <div className="mt-2 space-y-3 text-[13px] leading-6 text-[#724060]/90">
                              <MathRenderer content={resolved.description} />
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
                            <MathRenderer content={resolved.howItWorks} />
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
                              <MathRenderer content={resolved.pastSummary} />
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
                              <MathRenderer content={resolved.presentAndContributors} />
                            </div>
                          </div>
                          {/* 3.3 Future */}
                          <div className="rounded-lg border border-[#F8E7E7] bg-[#FDF3F3] p-5">
                            <div className="flex items-center gap-1.5 text-[#A070A1]">
                              <Rocket className="h-4 w-4" />
                              <span className="text-[10px] font-bold uppercase tracking-[.14em]">3.3 Future Horizon (Future)</span>
                            </div>
                            <h5 className="mt-2 text-[13px] font-bold text-[#724060]">Breakthrough Trajectory</h5>
                            <div className="mt-2 text-[12px] leading-5 text-[#724060]/90">
                              <MathRenderer content={resolved.futureOutlook} />
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section 4.0 Research Objectives & Investigative Questions */}
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

                      {/* Section 5.0 Key Conceptual Foundations */}
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

                      {/* Section 7.0 Authoritative Perspective & Statement (Quotation at bottom of paper!) */}
                      <section className="mt-8 rounded-xl border-2 border-[#724060]/20 bg-[#F8E7E7]/50 p-6 sm:p-8 text-center shadow-sm">
                        <QuoteIcon className="mx-auto h-8 w-8 text-[#A070A1]" />
                        <div className="mx-auto mt-3 max-w-3xl font-serif text-[16px] italic leading-7 text-[#724060] sm:text-[18px]">
                          "<MathRenderer content={resolved.quote.text} inline={true} />"
                        </div>
                        <div className="mt-4 flex flex-col items-center justify-center">
                          <span className="text-[13px] font-bold tracking-wide text-[#724060]">— {resolved.quote.author}</span>
                          {resolved.quote.context && (
                            <span className="mt-0.5 text-[11px] text-[#A070A1]">{resolved.quote.context}</span>
                          )}
                        </div>
                      </section>

                      {/* Paper Footer */}
                      <footer className="mt-8 border-t border-[#F8E7E7] pt-4 flex flex-wrap items-center justify-between text-[11px] text-[#A070A1]">
                        <span>StudentGPT Academic Research Canvas · Continuous Learning Synthesis</span>
                        <span>Downloadable as High-Resolution Preprint Image or Markdown Document</span>
                      </footer>
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
                <div className="grid min-h-[540px] place-items-center border border-dashed border-[#F8E7E7] bg-[#FDF3F3] p-8 text-center">
                  <div>
                    <Sparkles className="mx-auto h-7 w-7 text-[#A070A1]" />
                    <h2 className="mt-4 text-xl font-bold text-[#724060]">Start a publication-grade research paper.</h2>
                    <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#A070A1]">
                      Choose a topic and StudentGPT will create a formal research paper with definitions, operational mechanics, chronological landscape, objectives, and verified resources.
                    </p>
                    <button onClick={() => setComposerOpen(true)} className="mt-5 bg-[#F8E7E7] px-4 py-2 text-[12px] font-bold text-[#724060]">
                      Start a project
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
