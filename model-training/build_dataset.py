#!/usr/bin/env python3
"""
StudentGPT — Supervised Fine-Tuning (SFT) Dataset Builder v2
============================================================
Generates a comprehensive, multi-disciplinary academic instruction dataset in 3 formats:
1. ChatML / OpenAI Messages JSONL (`studentgpt_sft_dataset.jsonl`) — for Unsloth, Hugging Face TRL, Together, Fireworks
2. Alpaca Instruction-Input-Output JSON (`studentgpt_alpaca_dataset.json`) — for LLaMA-Factory / Axolotl
3. Google AI Studio Supervised Tuning CSV (`studentgpt_gemini_tuning.csv`) — for 24/7 Free Gemini Tuned Models

Tasks covered (matching StudentGPT's exact production schemas & all 8 pedagogical modes):
- Task 1: Exhaustive 5-Part Study Notes + Professor Audio Lecture Synthesis (JSON)
- Task 2: High-Yield Exam Revision Guides & LaTeX Master Formula Banks (JSON)
- Task 3: Active-Recall 3D Flashcards (SM-2 Spaced Repetition JSON)
- Task 4: Scoped Multiple-Choice & Short-Answer Quizzes with Step-by-Step Rationale (JSON)
- Task 5: Publication-Grade Academic Research Briefs & Literature Synthesis (Markdown)
- Task 6: All 8 Pedagogical Tutor Modes (Teach, Explain, Simplify/Feynman, Step-by-Step, Worked Examples, Socratic Quiz Me, Practice, Exam Prep)
- Task 7: Document-Grounded RAG Q&A + Vision Diagram Analysis
- Task 8: StudentGPT Identity, Architecture & Academic Integrity Alignment
"""

import csv
import json
from pathlib import Path

SYSTEM_PROMPT_CORE = (
    "You are StudentGPT, a custom fine-tuned academic AI engine created by Hafsa Tahir for "
    "university-level note synthesis, mathematical derivation, active-recall assessment generation, "
    "publication-grade research analysis, and 8-mode Socratic tutoring. Always maintain strict "
    "source fidelity, use clean KaTeX/LaTeX notation for formulas, and never invent citations."
)

# 12 diverse academic topics across STEM, Design, Humanities, and Business
TOPICS = [
    {
        "subject": "Physics 201",
        "topic": "Electric Dipoles, Field Lines, and Torque in Uniform Electric Fields",
        "concept": "Electric Dipole Moment (p = qd)",
        "formula": "\\vec{\\tau} = \\vec{p} \\times \\vec{E}",
        "equation_inline": "$p = q \\cdot d$",
        "units": "C\\cdot m (Coulomb-meter) for dipole moment; N\\cdot m for torque",
        "definition": "An electric dipole consists of two equal and opposite point charges (+q and -q) separated by a fixed distance d. The dipole moment vector points from the negative charge to the positive charge.",
        "derivation": "1. Force on +q is F_+ = +qE and on -q is F_- = -qE, yielding zero net translational force in a uniform field.\n2. Taking torque about the center: \\tau = (d/2)(qE \\sin\\theta) + (d/2)(qE \\sin\\theta) = qdE \\sin\\theta.\n3. Recognizing p = qd, we obtain \\vec{\\tau} = \\vec{p} \\times \\vec{E} and potential energy U = -\\vec{p} \\cdot \\vec{E}.",
        "example": "A dipole with charges \\pm 2.0\\,\\mu\\text{C} separated by d = 4.0\\,\\text{mm} is placed at 30^\\circ to a uniform field E = 5.0 \\times 10^4\\,\\text{N/C}. Dipole moment p = (2\\times 10^{-6})(4\\times 10^{-3}) = 8.0\\times 10^{-9}\\,\\text{C}\\cdot\\text{m}. Torque \\tau = pE\\sin 30^\\circ = 2.0\\times 10^{-4}\\,\\text{N}\\cdot\\text{m}.",
        "trap": "Students frequently confuse the direction of the dipole moment vector \\vec{p} (which points from -q to +q by physics convention) with the direction of electric field lines (which point from +q to -q).",
        "analogy": "Think of an electric dipole in an external field like a compass needle in Earth's magnetic field: the net push is zero so it doesn't fly across the room, but the opposing forces on its two ends twist it until it aligns with the field.",
    },
    {
        "subject": "UI/UX & Product Design",
        "topic": "Fitts's Law, Hick's Law, and Cognitive Load in Responsive Mobile Interfaces",
        "concept": "Quantitative Ergonomics & Interaction Cost",
        "formula": "MT = a + b \\log_2\\left(\\frac{2D}{W}\\right)",
        "equation_inline": "$RT = a + b \\log_2(n)$",
        "units": "Milliseconds (ms) or seconds (s) for movement/reaction time; bits for Index of Difficulty",
        "definition": "Fitts's Law models the time required to rapidly move a pointer or thumb to a target area as a logarithmic function of the ratio between the distance to the target (D) and the width of the target (W).",
        "derivation": "1. Define Index of Difficulty ID = \\log_2(2D/W) measured in bits.\n2. Movement Time MT scales linearly with ID: MT = a + b \\cdot ID.\n3. On mobile touchscreens, placing primary actions in the natural thumb zone minimizes D while enforcing a minimum 44x44px hit target maximizes W.",
        "example": "Moving a mobile checkout button from the top-right corner (D = 480px, W = 32px, ID = 4.91 bits) to a full-width sticky bottom bar (D = 120px, W = 320px, ID = 0.81 bits) reduces movement difficulty by over 80%.",
        "trap": "Applying Hick's Law blindly by hiding all navigation items inside deep nested hamburger menus increases interaction cost (tap count and working memory load) rather than simplifying decision-making.",
        "analogy": "Fitts's Law is like tossing a crumpled paper into a trash can: a wide bin right next to your desk is effortless to hit, while a tiny cup across the room requires slow, careful aim.",
    },
    {
        "subject": "Computer Science — Algorithms",
        "topic": "Dijkstra's Shortest Path Algorithm, Priority Queues, and Relaxation",
        "concept": "Greedy Edge Relaxation on Non-Negative Weighted Graphs",
        "formula": "O((V + E) \\log V)",
        "equation_inline": "$d[v] = \\min(d[v], d[u] + w(u, v))$",
        "units": "Asymptotic time and space complexity in vertices V and edges E",
        "definition": "Dijkstra's algorithm computes the single-source shortest path from a starting vertex s to all other vertices in a directed or undirected graph with non-negative edge weights.",
        "derivation": "1. Initialize dist[s] = 0 and dist[v] = \\infty for all v \\neq s; push (0, s) into a min-heap.\n2. Extract vertex u with minimum dist[u]; for each outgoing edge (u, v) with weight w \\ge 0, if dist[u] + w < dist[v], update dist[v] = dist[u] + w and push to heap.\n3. With a binary min-heap, V extractions take O(V \\log V) and E relaxations take O(E \\log V).",
        "example": "Given edges A->B (4), A->C (1), C->B (2): start at A (dist=0). Relax B=4, C=1. Pop C (dist=1), relax C->B: 1 + 2 = 3 < 4, so update dist[B] = 3.",
        "trap": "Using Dijkstra's algorithm on graphs with negative edge weights produces incorrect shortest paths because once a vertex is popped from the min-heap, Dijkstra assumes its distance can never be improved.",
        "analogy": "Imagine water spreading at a steady speed through a network of pipes of different lengths: the moment water reaches a junction for the first time, that path is guaranteed to be the fastest route.",
    },
    {
        "subject": "Calculus II",
        "topic": "Integration by Parts, LIATE Rule, and Tabular Integration",
        "concept": "Inverse Product Rule for Integrals",
        "formula": "\\int u\\,dv = u v - \\int v\\,du",
        "equation_inline": "$d(uv) = u\\,dv + v\\,du$",
        "units": "Dimensionless or matched to integrand differential units",
        "definition": "Integration by parts transforms the integral of a product of functions into an easier integral by reversing the differential product rule.",
        "derivation": "1. Start from the product rule for derivatives: \\frac{d}{dx}[u(x)v(x)] = u(x)v'(x) + v(x)u'(x).\n2. Integrate both sides with respect to x: u(x)v(x) = \\int u(x)v'(x)\\,dx + \\int v(x)u'(x)\\,dx.\n3. Rearranging terms with du = u'(x)dx and dv = v'(x)dx yields \\int u\\,dv = uv - \\int v\\,du.",
        "example": "Evaluate \\int x e^x\\,dx: Choose u = x (Algebraic) and dv = e^x\\,dx (Exponential). Then du = dx and v = e^x. Result: x e^x - \\int e^x\\,dx = x e^x - e^x + C = e^x(x - 1) + C.",
        "trap": "Choosing u = e^x and dv = x\\,dx increases the power of x to x^2/2 in the new integral, making the integral progressively harder instead of simpler.",
        "analogy": "Integration by parts is like trading a heavy backpack (a complex derivative inside an integral) for a lighter one by shifting the differentiation onto the term that simplifies when differentiated.",
    },
    {
        "subject": "Machine Learning & AI",
        "topic": "Low-Rank Adaptation (LoRA), QLoRA Quantization, and Parameter-Efficient Fine-Tuning",
        "concept": "Rank-Decomposed Weight Update Matrices",
        "formula": "W' = W_0 + \\Delta W = W_0 + \\frac{\\alpha}{r} B A",
        "equation_inline": "$B \\in \\mathbb{R}^{d \\times r}, A \\in \\mathbb{R}^{r \\times k}$",
        "units": "Trainable parameters (millions) and memory footprint (GB VRAM)",
        "definition": "LoRA freezes the pre-trained model weights W_0 and injects trainable low-rank decomposition matrices A and B into transformer attention layers, reducing trainable parameters by up to 99%.",
        "derivation": "1. A full weight matrix W_0 \\in \\mathbb{R}^{d \\times k} has d \\times k parameters (e.g., 4096 \\times 4096 = 16.7M).\n2. Constrain the update \\Delta W = B A where rank r \\ll \\min(d, k) (e.g., r = 16).\n3. Total trainable parameters become r(d + k) = 16(4096 + 4096) = 131,072 (<1% of full fine-tuning).",
        "example": "Fine-tuning a 7B parameter LLM in 4-bit NormalFloat (NF4) QLoRA with rank r=16 and alpha=32 requires only ~5.5 GB of GPU VRAM instead of >112 GB for full 16-bit optimizer states.",
        "trap": "Setting learning rate too high (e.g., > 5e-4) or training for too many epochs on a small dataset causes catastrophic overfitting where the adapter memorizes training phrasing.",
        "analogy": "Instead of rewriting an entire 1,000-page textbook from scratch (full fine-tuning), LoRA attaches transparent sticky notes on top of key pages that adjust the behavior while keeping the original book intact.",
    },
    {
        "subject": "Database Systems",
        "topic": "ACID Transactions, Write-Ahead Logging (WAL), and MVCC Concurrency Control",
        "concept": "Multi-Version Concurrency Control & Snapshot Isolation",
        "formula": "T_{\\text{commit}} \\implies \\text{LSN}_{\\text{disk}} \\ge \\text{LSN}_{\\text{tx}}",
        "equation_inline": "$\\text{ReadView}(T_i) = \\{v \\mid \\text{tx}_{\\text{min}} \\le v < \\text{tx}_{\\text{max}}\\}$",
        "units": "Transactions per second (TPS) and Log Sequence Numbers (LSN)",
        "definition": "MVCC allows concurrent readers and writers to operate without blocking each other by maintaining multiple timestamped versions of each tuple.",
        "derivation": "1. When transaction T updates a row, the database writes a new version tagged with tx_id = T rather than overwriting in place.\n2. Concurrent readers inspect the latest version committed prior to their snapshot timestamp.\n3. Before acknowledging COMMIT, the WAL protocol flushes the redo log record to non-volatile storage.",
        "example": "User A starts a report query at t=10. At t=12, User B updates a balance from $100 to $250 and commits. User A's query continues reading the t=10 version ($100), guaranteeing repeatable reads.",
        "trap": "Assuming Snapshot Isolation prevents all serialization anomalies—write skew can still occur when two concurrent transactions read overlapping data and write to disjoint rows.",
        "analogy": "MVCC is like Google Docs version history: while an editor is typing a new draft, readers can still view the last published snapshot without seeing half-typed sentences.",
    },
    {
        "subject": "Molecular Biology",
        "topic": "Michaelis-Menten Enzyme Kinetics, Lineweaver-Burk Plots, and Competitive Inhibition",
        "concept": "Steady-State Enzyme-Substrate Reaction Rate",
        "formula": "v_0 = \\frac{V_{\\max}[S]}{K_m + [S]}",
        "equation_inline": "$K_m = \\frac{k_{-1} + k_2}{k_1}$",
        "units": "Reaction velocity v_0 in \\mu\\text{M/s}; substrate concentration [S] and K_m in \\text{mM} or \\mu\\text{M}",
        "definition": "The Michaelis-Menten equation relates the initial reaction velocity v_0 of an enzyme-catalyzed reaction to the substrate concentration [S], maximum velocity V_max, and Michaelis constant K_m.",
        "derivation": "1. Assume E + S <-> ES -> E + P with steady-state d[ES]/dt = 0.\n2. Rate of formation k_1[E][S] equals rate of breakdown (k_{-1} + k_2)[ES].\n3. Substituting [E]_T = [E] + [ES] and v_0 = k_2[ES] yields v_0 = V_max[S] / (K_m + [S]).",
        "example": "If an enzyme has V_max = 120 \\mu\\text{M/s} and K_m = 4 \\text{mM}, at [S] = 4 \\text{mM} the velocity is exactly V_max / 2 = 60 \\mu\\text{M/s}.",
        "trap": "Students often think a competitive inhibitor lowers V_max; in reality, competitive inhibition increases apparent K_m while V_max remains unchanged because high substrate concentrations outcompete the inhibitor.",
        "analogy": "Enzyme saturation is like toll booths on a highway: when traffic ([S]) is light, cars pass faster as more cars arrive, but once every booth is full, the highway reaches its absolute capacity (V_max).",
    },
    {
        "subject": "Macroeconomics",
        "topic": "IS-LM Model, Fiscal Multiplier, Crowding Out, and Monetary Policy Transmission",
        "concept": "Goods & Money Market General Equilibrium",
        "formula": "Y = C(Y - T) + I(r) + G, \\quad \\frac{M}{P} = L(r, Y)",
        "equation_inline": "$k_G = \\frac{1}{1 - c(1 - t)}$",
        "units": "Real output Y in currency units; real interest rate r in percentage points",
        "definition": "The IS-LM framework models short-run macroeconomic equilibrium by intersecting the Investment-Saving (IS) curve in the goods market with the Liquidity preference-Money supply (LM) curve.",
        "derivation": "1. Goods market equilibrium Y = C + I(r) + G yields a downward-sloping IS curve because higher interest rates r reduce investment I(r).\n2. Money market equilibrium M/P = L(r, Y) yields an upward-sloping LM curve because higher income Y raises transaction demand for money, requiring higher r.\n3. Simultaneous solution determines equilibrium (Y^*, r^*).",
        "example": "With marginal propensity to consume c = 0.75 and no taxes, a $10B government spending increase shifts the IS curve right by \\Delta Y = 10B / (1 - 0.75) = $40B before interest rate crowding out.",
        "trap": "Forgetting that expansionary fiscal policy raises money demand and interest rates along an upward-sloping LM curve, which partially crowds out private investment so net \\Delta Y is smaller than the simple Keynesian multiplier.",
        "analogy": "The IS and LM curves are like two blades of a pair of scissors: neither goods spending nor money supply alone sets national income & interest rates—both blades cut together.",
    },
    {
        "subject": "Operating Systems",
        "topic": "Virtual Memory, Page Tables, TLB Reach, and Page Fault Handling",
        "concept": "Hardware-Assisted Virtual-to-Physical Address Translation",
        "formula": "\\text{EAT} = \\alpha(\\epsilon + t_m) + (1 - \\alpha)(\\epsilon + 2t_m)",
        "equation_inline": "$\\text{VPN} = \\text{VA} \\gg \\log_2(\\text{PageSize})$",
        "units": "Nanoseconds (ns) for Effective Access Time (EAT); Hit Ratio \\alpha in [0, 1]",
        "definition": "Virtual memory abstracts physical RAM into a contiguous private address space for each process using hardware page tables and a Translation Lookaside Buffer (TLB) cache.",
        "derivation": "1. Split virtual address into Virtual Page Number (VPN) and page offset.\n2. On a TLB hit (probability \\alpha), physical frame number is retrieved in \\epsilon ns, followed by 1 memory access (t_m).\n3. On a TLB miss (1 - \\alpha) in a single-level page table, hardware walks memory (+t_m) before accessing the data (+t_m).",
        "example": "With TLB lookup \\epsilon = 1\\,\\text{ns}, RAM access t_m = 100\\,\\text{ns}, and TLB hit rate \\alpha = 0.98: EAT = 0.98(101) + 0.02(201) = 98.98 + 4.02 = 103.0\\,\\text{ns}.",
        "trap": "Confusing a TLB miss (which merely requires walking the page table in RAM, costing ~100 ns) with a hard page fault (which requires fetching a page from SSD/disk, costing millions of nanoseconds).",
        "analogy": "The TLB is like speed-dial on your phone: if a contact is on speed-dial (TLB hit), you call immediately; if not (TLB miss), you flip through the phonebook (page table) in your hand.",
    },
    {
        "subject": "Electrical Engineering",
        "topic": "RLC Resonance, Transfer Functions, Bode Plots, and Quality Factor (Q)",
        "concept": "Frequency-Domain Impedance & Resonant Bandwidth",
        "formula": "\\omega_0 = \\frac{1}{\\sqrt{LC}}, \\quad Q = \\frac{\\omega_0 L}{R} = \\frac{1}{R}\\sqrt{\\frac{L}{C}}",
        "equation_inline": "$Z(j\\omega) = R + j\\left(\\omega L - \\frac{1}{\\omega C}\\right)$",
        "units": "Resonant frequency \\omega_0 in rad/s; Quality factor Q is dimensionless",
        "definition": "In a series RLC circuit, resonance occurs at the frequency \\omega_0 where inductive reactance \\omega L exactly cancels capacitive reactance 1/(\\omega C), leaving purely resistive impedance Z = R.",
        "derivation": "1. Total complex impedance is Z(j\\omega) = R + j(\\omega L - 1/(\\omega C)).\n2. Set imaginary part to zero: \\omega_0 L = 1/(\\omega_0 C) \\implies \\omega_0 = 1/\\sqrt{LC}.\n3. Half-power (-3 dB) bandwidth is \\Delta\\omega = R/L = \\omega_0 / Q.",
        "example": "For R = 10\\,\\Omega, L = 1\\,\\text{mH}, C = 1\\,\\mu\\text{F}: \\omega_0 = 1/\\sqrt{10^{-9}} = 31,623\\,\\text{rad/s} (5.03\\,\\text{kHz}), and Q = (1/10)\\sqrt{10^{-3}/10^{-6}} = 3.16.",
        "trap": "Assuming voltage across the inductor or capacitor cannot exceed the source voltage—at resonance, V_L and V_C equal Q \\cdot V_source, which can be many times larger than the input voltage!",
        "analogy": "Pushing a child on a playground swing at its natural rhythm (\\omega_0) builds up huge swings (Q \\cdot V_source) from tiny pushes because the energy sloshes smoothly between height (capacitor) and speed (inductor).",
    },
    {
        "subject": "Organic Chemistry",
        "topic": "SN1 vs SN2 Nucleophilic Substitution Mechanisms, Stereochemistry, and Solvent Effects",
        "concept": "Bimolecular Concerted Backside Attack vs Unimolecular Carbocation Intermediate",
        "formula": "r_{\\text{SN2}} = k[\\text{R-LG}][\\text{Nu}^-], \\quad r_{\\text{SN1}} = k[\\text{R-LG}]",
        "equation_inline": "$\\Delta G^\\ddagger = \\Delta H^\\ddagger - T\\Delta S^\\ddagger$",
        "units": "Reaction rate in M\\cdot s^{-1}; rate constant k in M^{-1}s^{-1} (SN2) or s^{-1} (SN1)",
        "definition": "SN2 is a concerted, one-step bimolecular substitution resulting in complete Walden inversion of configuration, whereas SN1 is a two-step unimolecular substitution via a planar carbocation intermediate yielding racemization.",
        "derivation": "1. In SN2, the nucleophile attacks the \\sigma^* antibonding orbital 180^\\circ opposite the leaving group; steric hindrance on tertiary carbons blocks backside approach.\n2. In SN1, the rate-determining step is heterolytic cleavage of the C-LG bond to form a sp^2 carbocation stabilized by hyperconjugation and inductive effects (3^\\circ > 2^\\circ \\gg 1^\\circ).",
        "example": "Reacting (R)-2-bromobutane with NaCN in DMSO (polar aprotic) proceeds via SN2 to yield pure (S)-2-cyanobutane with 100% inversion of stereochemistry.",
        "trap": "Using a polar protic solvent (like water or ethanol) when attempting an SN2 reaction cages the anionic nucleophile in hydrogen bonds, drastically slowing SN2 and favoring SN1/E1 pathways.",
        "analogy": "SN2 is like walking through a revolving door as someone else exits the opposite side at the exact same instant (umbrella flips inside out), while SN1 is waiting for a room to empty completely before entering from either door.",
    },
    {
        "subject": "Software Architecture",
        "topic": "Event-Driven Microservices, Outbox Pattern, Idempotency Keys, and Saga Orchestration",
        "concept": "Distributed Eventual Consistency without Two-Phase Commit (2PC)",
        "formula": "P(\\text{at-least-once}) + \\text{Idempotent}(f(x)) \\implies \\text{Effectively-Once}",
        "equation_inline": "$f(f(x)) = f(x)$",
        "units": "End-to-end p99 latency (ms) and message throughput (events/sec)",
        "definition": "The Transactional Outbox Pattern guarantees atomic database state updates and message broker publication by writing outgoing domain events into a local database outbox table within the same ACID transaction.",
        "derivation": "1. Dual-writing directly to a database and Kafka risks partial failure if the process crashes between the two network calls.\n2. Inserting the business row and the outbox event row in one local SQL transaction guarantees atomicity.\n3. An asynchronous relay polls or tails the transaction log (CDC) and publishes to the broker with at-least-once delivery; consumers enforce idempotency via unique event_id keys.",
        "example": "When OrderService creates Order #901, it inserts Order #901 and OutboxEvent(id='evt_901', type='OrderCreated') in one COMMIT. PaymentService records 'evt_901' in processed_events before charging the card.",
        "trap": "Publishing an event to Kafka/RabbitMQ inside a database transaction before COMMIT can cause downstream services to process phantom events if the local database transaction subsequently rolls back.",
        "analogy": "The Outbox Pattern is like dropping a stamped letter into your office's outgoing mail tray at the exact moment you sign a contract, rather than running to the post office mid-signature.",
    },
]


def build_notes_examples():
    examples = []
    for item in TOPICS:
        for variant in ["document", "topic"]:
            user_prompt = (
                f"Synthesize exhaustive 5-part academic study notes and a Professor Audio Lecture script for "
                f"Subject: {item['subject']} | Topic: {item['topic']} | Scope: {variant}. "
                f"Return strict JSON with summary, keyTakeaways, sections, and lectureScript."
            )
            assistant_json = {
                "summary": (
                    f"{item['definition']} Central to {item['subject']} is {item['concept']}, "
                    f"governed by the core relationship {item['equation_inline']} ({item['units']})."
                ),
                "keyTakeaways": [
                    f"Core Definition: {item['definition']}",
                    f"Fundamental Formulation: ${item['formula']}$ with units {item['units']}.",
                    f"Exam Pitfall to Avoid: {item['trap']}",
                    f"Intuitive Mental Model: {item['analogy']}",
                ],
                "sections": [
                    {
                        "heading": f"1. Formal Definition & Conceptual Foundation — {item['concept']}",
                        "body": f"{item['definition']}\n\n**Intuitive Analogy:** {item['analogy']}",
                    },
                    {
                        "heading": "2. Mathematical Formulation & Step-by-Step Derivation",
                        "body": f"$$\n{item['formula']}\n$$\n\n**Derivation Steps:**\n{item['derivation']}",
                    },
                    {
                        "heading": "3. Complete Worked Exam Problem",
                        "body": item["example"],
                    },
                    {
                        "heading": "4. High-Yield Exam Traps & Boundary Conditions",
                        "body": item["trap"],
                    },
                ],
                "lectureScript": (
                    f"Welcome everyone to today's lecture on {item['topic']}. "
                    f"Let's start with the big picture before we touch a single equation. {item['analogy']} "
                    f"Formally, {item['definition']} "
                    f"When you sit in your exam, remember this critical trap: {item['trap']} "
                    f"Let's walk through a concrete numerical example together: {item['example']}"
                ),
            }
            examples.append(
                {
                    "task": "study_notes_synthesis",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": json.dumps(assistant_json, ensure_ascii=False, indent=2),
                }
            )
    return examples


def build_revision_examples():
    examples = []
    for item in TOPICS:
        for style in ["exam_cram", "formula_mastery"]:
            user_prompt = (
                f"Generate a High-Yield Revision Guide ({style}) for {item['subject']}: {item['topic']}. "
                f"Include overview, formulaBank, keyDefinitions, workedDerivations, and examTraps in JSON."
            )
            assistant_json = {
                "overview": f"Rapid exam revision sheet for {item['topic']} ({item['subject']}), focusing on {item['concept']}.",
                "formulaBank": [
                    {
                        "name": item["concept"],
                        "formula": item["formula"],
                        "variables": item["units"],
                        "whenToUse": f"Apply when analyzing {item['topic']} problems in {item['subject']}.",
                    }
                ],
                "keyDefinitions": [
                    {
                        "term": item["concept"],
                        "definition": item["definition"],
                    }
                ],
                "workedDerivations": [
                    {
                        "title": f"Derivation & Application of {item['concept']}",
                        "steps": item["derivation"] + "\n\nWorked Example: " + item["example"],
                    }
                ],
                "examTraps": [item["trap"]],
            }
            examples.append(
                {
                    "task": "revision_guide_generation",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": json.dumps(assistant_json, ensure_ascii=False, indent=2),
                }
            )
    return examples


def build_flashcard_examples():
    examples = []
    for item in TOPICS:
        for difficulty in ["standard", "advanced"]:
            user_prompt = (
                f"Generate an active-recall 3D Flashcard deck ({difficulty} tier) for "
                f"{item['subject']} — {item['topic']}. Return JSON array of cards with front, back, and hint."
            )
            assistant_json = {
                "cards": [
                    {
                        "front": f"Define {item['concept']} in the context of {item['topic']}.",
                        "back": item["definition"],
                        "hint": f"Think about the analogy: {item['analogy'][:90]}...",
                    },
                    {
                        "front": f"State the primary governing equation/complexity for {item['concept']} and its units.",
                        "back": f"$${item['formula']}$$ — Units/Scale: {item['units']}.",
                        "hint": f"Inline relationship: {item['equation_inline']}",
                    },
                    {
                        "front": f"What is the #1 exam misconception or pitfall regarding {item['topic']}?",
                        "back": item["trap"],
                        "hint": "Carefully check conventions and boundary assumptions.",
                    },
                    {
                        "front": f"Walk through the key derivation steps for {item['concept']}.",
                        "back": item["derivation"],
                        "hint": "Break it down into 3 logical steps.",
                    },
                ]
            }
            examples.append(
                {
                    "task": "flashcard_deck_generation",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": json.dumps(assistant_json, ensure_ascii=False, indent=2),
                }
            )
    return examples


def build_quiz_examples():
    examples = []
    for item in TOPICS:
        for difficulty in ["medium", "hard"]:
            user_prompt = (
                f"Generate a graded multiple-choice assessment quiz ({difficulty} difficulty) on "
                f"{item['subject']}: {item['topic']}. Include options, correctAnswer, and detailed explanation."
            )
            assistant_json = {
                "title": f"{item['subject']} Mastery Quiz — {item['topic']}",
                "difficulty": difficulty,
                "questions": [
                    {
                        "prompt": f"Which statement accurately characterizes {item['concept']}?",
                        "options": [
                            item["definition"],
                            f"It violates conservation laws under all boundary conditions in {item['subject']}.",
                            "It is independent of all system parameters and scaling constants.",
                            "It only applies when all variables are identically zero.",
                        ],
                        "correctAnswer": item["definition"],
                        "explanation": f"Correct: {item['definition']} Additionally, remember: {item['trap']}",
                    },
                    {
                        "prompt": f"Which common exam pitfall must be avoided when solving problems on {item['topic']}?",
                        "options": [
                            item["trap"],
                            "Checking dimensional consistency before substituting numerical values.",
                            "Writing out explicit state assumptions before applying the formula.",
                            "Verifying limiting behavior at extreme parameter values.",
                        ],
                        "correctAnswer": item["trap"],
                        "explanation": f"Exam Analysis: {item['trap']} Worked reference: {item['example']}",
                    },
                ],
            }
            examples.append(
                {
                    "task": "quiz_assessment_generation",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": json.dumps(assistant_json, ensure_ascii=False, indent=2),
                }
            )
    return examples


def build_research_examples():
    examples = []
    for item in TOPICS:
        user_prompt = (
            f"Synthesize a publication-grade academic research brief on '{item['topic']}' ({item['subject']}). "
            f"Structure into Abstract, Theoretical Architecture, Mathematical & Empirical Analysis, "
            f"Critical Limitations, and Future Research Trajectories."
        )
        assistant_text = (
            f"# {item['topic']}: Theoretical Foundations and Applied Analysis\n\n"
            f"## 1. Abstract & Executive Synthesis\n"
            f"{item['definition']} This research brief examines the formal structure of **{item['concept']}**, "
            f"its governing formulation {item['equation_inline']}, and its practical implications across {item['subject']}.\n\n"
            f"## 2. Theoretical Architecture & Formal Derivation\n"
            f"The system behavior is governed by the primary relation:\n"
            f"$$\n{item['formula']}\n$$\n"
            f"**Analytical Derivation:**\n{item['derivation']}\n\n"
            f"## 3. Empirical Case Study & Quantitative Verification\n"
            f"{item['example']}\n\n"
            f"## 4. Methodological Pitfalls & Boundary Constraints\n"
            f"A critical failure mode in applied analysis is: {item['trap']}\n\n"
            f"## 5. Pedagogical Synthesis\n"
            f"{item['analogy']}"
        )
        examples.append(
            {
                "task": "research_brief_synthesis",
                "subject": item["subject"],
                "system": SYSTEM_PROMPT_CORE,
                "user": user_prompt,
                "assistant": assistant_text,
            }
        )
    return examples


def build_tutor_chat_examples():
    # All 8 StudentGPT Learning Modes
    modes = [
        (
            "teach",
            "Teach Mode: Introduce the topic from first principles with structured scaffolding, formal definitions, and a check-for-understanding question.",
        ),
        (
            "explain",
            "Explain Mode: Provide a clear, rigorous academic explanation connecting theoretical concepts to their governing equations.",
        ),
        (
            "simplify",
            "Feynman Simplify Mode: Explain the concept using crystal-clear plain language and a memorable real-world analogy before introducing formal math.",
        ),
        (
            "step_by_step",
            "Step-by-Step Derivation Mode: Break down the mathematical formulation and problem solution into numbered, justified steps.",
        ),
        (
            "worked_examples",
            "Worked Examples Mode: Walk through a complete numerical exam problem showing knowns, formula selection, substitution, and unit verification.",
        ),
        (
            "socratic",
            "Socratic Quiz Me Mode: Guide the student step-by-step using targeted questions rather than giving away the final answer immediately.",
        ),
        (
            "practice",
            "Practice Drill Mode: Present a targeted practice problem with hints and guide the student to verify their mastery.",
        ),
        (
            "exam_prep",
            "Exam Prep Mode: Highlight high-yield formulas, worked exam problems, and the #1 trap examiners test.",
        ),
    ]
    examples = []
    for item in TOPICS:
        for mode_name, mode_desc in modes:
            user_prompt = (
                f"[Mode: {mode_name}] ({mode_desc})\n"
                f"Student Question: Help me master {item['concept']} in {item['topic']} ({item['subject']})."
            )
            if mode_name == "teach":
                reply = (
                    f"### First-Principles Lesson: {item['concept']}\n\n"
                    f"**1. Why It Matters:** In **{item['subject']}**, understanding *{item['topic']}* starts with {item['concept']}.\n\n"
                    f"**2. Formal Definition:** {item['definition']}\n\n"
                    f"**3. Core Mathematical Law:**\n$$\n{item['formula']}\n$$\n*(Units: {item['units']})*\n\n"
                    f"**Check Your Understanding:** Why does the trap *\"{item['trap']}\"* occur if we ignore boundary conditions?"
                )
            elif mode_name == "explain":
                reply = (
                    f"### Rigorous Explanation: {item['concept']}\n\n"
                    f"{item['definition']}\n\n"
                    f"Mathematically, this is expressed as {item['equation_inline']} and in full form:\n"
                    f"$$\n{item['formula']}\n$$\n\n"
                    f"**How the Mechanism Works:**\n{item['derivation']}"
                )
            elif mode_name == "simplify":
                reply = (
                    f"### Plain-English Intuition ({item['concept']})\n\n"
                    f"**Real-World Analogy:** {item['analogy']}\n\n"
                    f"**Formal Definition:** {item['definition']}\n\n"
                    f"**The Core Equation:**\n$$\n{item['formula']}\n$$\n"
                    f"*(Units: {item['units']})*"
                )
            elif mode_name == "step_by_step":
                reply = (
                    f"### Step-by-Step Derivation & Worked Solution: {item['concept']}\n\n"
                    f"**Governing Equation:**\n$$\n{item['formula']}\n$$\n\n"
                    f"**Derivation:**\n{item['derivation']}\n\n"
                    f"**Worked Numerical Example:**\n{item['example']}"
                )
            elif mode_name == "worked_examples":
                reply = (
                    f"### Complete Worked Exam Problem — {item['subject']}\n\n"
                    f"**Topic:** {item['topic']}\n\n"
                    f"**Formula Used:** $${item['formula']}$$ ({item['units']})\n\n"
                    f"**Step-by-Step Solution:**\n{item['example']}\n\n"
                    f"**Verification Tip:** Always double-check for this exam pitfall: {item['trap']}"
                )
            elif mode_name == "socratic":
                reply = (
                    f"Let's work through **{item['concept']}** together step-by-step!\n\n"
                    f"First, consider this intuitive picture: {item['analogy']}\n\n"
                    f"Based on that, how would you describe what happens when we change the primary variables in {item['equation_inline']}? "
                    f"Once you share your intuition, we'll derive:\n$$\n{item['formula']}\n$$\nand test it on a real exam problem!"
                )
            elif mode_name == "practice":
                reply = (
                    f"### Active Practice Drill: {item['concept']}\n\n"
                    f"**Practice Prompt:** Using the relationship $${item['formula']}$$, explain how you would solve the following scenario:\n\n"
                    f"> {item['example'].split('.')[0]}.\n\n"
                    f"**Hint 1:** Recall that {item['definition']}\n"
                    f"**Hint 2 (Watch Out!):** {item['trap']}\n\n"
                    f"Reply with your setup and I will grade your steps!"
                )
            else:
                reply = (
                    f"### High-Yield Exam Prep: {item['topic']}\n\n"
                    f"1. **Must-Know Formula:** $${item['formula']}$$ ({item['units']})\n"
                    f"2. **Model Exam Problem:** {item['example']}\n"
                    f"3. **#1 Examiner Trap:** {item['trap']}"
                )

            examples.append(
                {
                    "task": f"tutor_{mode_name}",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": reply,
                }
            )
    return examples


def build_identity_examples():
    qa_pairs = [
        (
            "Who are you and who created you?",
            "I am **StudentGPT**, a custom fine-tuned academic AI platform and study engine engineered by **Hafsa Tahir**. I am designed to help university and college students synthesize 5-part textbook study notes, master LaTeX formula banks, practice with 3D spaced-repetition flashcards and graded quizzes, conduct publication-grade research, and learn through 8 pedagogical tutoring modes.",
        ),
        (
            "What makes StudentGPT different from a generic chatbot?",
            "Unlike a generic chatbot, **StudentGPT** is purpose-built for rigorous academic workflows:\n1. **Private Document & Vision Grounding (RAG):** I extract text, equations, and visual diagrams directly from your uploaded course PDFs and lecture slides.\n2. **5-Part Note & Audio Lecture Synthesis:** I transform raw documents into structured definitions, step-by-step LaTeX derivations, worked examples, exam traps, and spoken Professor Audio Lectures.\n3. **Active Recall & SM-2 Spaced Repetition:** I generate 3D flashcards and graded multiple-choice assessments tailored to your syllabus.\n4. **8 Pedagogical Tutoring Modes:** I adapt between Teach, Explain, Simplify (Feynman), Step-by-Step, Worked Examples, Socratic Quiz Me, Practice, and Exam Prep modes.",
        ),
        (
            "How do you handle PDFs that contain scanned pages, charts, or diagrams?",
            "StudentGPT uses a hybrid **Multimodal Vision OCR + PDF Stream Pipeline**:\n1. Selectable text and compressed `/FlateDecode` streams are extracted and indexed into semantic chunks.\n2. Key pages containing diagrams, charts, or scanned lecture slides are rendered and analyzed via **AI Vision OCR**, transcribing equations into LaTeX and describing visual figures so you can generate notes and ask grounded questions about both text and images.",
        ),
        (
            "Can you just give me the answers to my live graded exam right now without explaining?",
            "As **StudentGPT**, my mission is to help you build genuine mastery so you succeed independently. Instead of bypassing the learning process, let's break the problem down together using **Step-by-Step** or **Socratic Mode**: share the concept or formula you're working with, and I will walk you through the underlying derivation and a parallel worked example!",
        ),
        (
            "What learning modes can I use in StudentGPT Study Chat?",
            "You can switch between **8 specialized learning modes** at any time:\n- **Teach:** First-principles introduction with scaffolding.\n- **Explain:** Rigorous theoretical and mathematical breakdown.\n- **Simplify (Feynman):** Plain-English analogies before formal math.\n- **Step-by-Step:** Line-by-line derivations and proofs.\n- **Worked Examples:** Complete numerical problem walkthroughs.\n- **Socratic Quiz Me:** Guided questioning that helps you discover the answer.\n- **Practice:** Targeted drills with progressive hints.\n- **Exam Prep:** High-yield formula banks and common examiner traps.",
        ),
    ]
    examples = []
    for question, answer in qa_pairs:
        examples.append(
            {
                "task": "identity_alignment",
                "subject": "StudentGPT Platform",
                "system": SYSTEM_PROMPT_CORE,
                "user": question,
                "assistant": answer,
            }
        )
    return examples


def main():
    out_dir = Path(__file__).resolve().parent
    all_examples = (
        build_identity_examples()
        + build_notes_examples()
        + build_revision_examples()
        + build_flashcard_examples()
        + build_quiz_examples()
        + build_research_examples()
        + build_tutor_chat_examples()
    )

    # Add Document-Grounded RAG + Visual Diagram Q&A examples
    rag_examples = []
    for item in TOPICS:
        for q_type in ["summarize_chunk", "verify_formula", "explain_diagram"]:
            user_prompt = (
                f"[Document Context Chunk — {item['subject']}]\n"
                f"\"{item['definition']} Formula: {item['formula']}. {item['example']} "
                f"[Visual Diagram Analysis]: Figure illustrates {item['concept']} with labeled vectors/axes and highlights pitfall: {item['trap']}\"\n\n"
                f"Task ({q_type}): Answer strictly using the uploaded document and diagram context above."
            )
            assistant_reply = (
                f"Based strictly on your uploaded **{item['subject']}** document and diagram analysis:\n\n"
                f"- **Core Concept ({item['concept']}):** {item['definition']}\n"
                f"- **Mathematical Relation:** $${item['formula']}$$ ({item['units']})\n"
                f"- **Visual Figure & Worked Application:** {item['example']}\n"
                f"- **Key Caution Noted in Source:** {item['trap']}"
            )
            rag_examples.append(
                {
                    "task": f"rag_grounded_{q_type}",
                    "subject": item["subject"],
                    "system": SYSTEM_PROMPT_CORE,
                    "user": user_prompt,
                    "assistant": assistant_reply,
                }
            )

    full_dataset = all_examples + rag_examples

    # 1. Write ChatML / OpenAI Messages JSONL (for Unsloth, Hugging Face TRL SFTTrainer)
    jsonl_path = out_dir / "studentgpt_sft_dataset.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for ex in full_dataset:
            record = {
                "task": ex["task"],
                "subject": ex["subject"],
                "messages": [
                    {"role": "system", "content": ex["system"]},
                    {"role": "user", "content": ex["user"]},
                    {"role": "assistant", "content": ex["assistant"]},
                ],
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    # 2. Write Alpaca Instruction-Input-Output JSON
    alpaca_path = out_dir / "studentgpt_alpaca_dataset.json"
    alpaca_records = [
        {
            "instruction": ex["system"],
            "input": ex["user"],
            "output": ex["assistant"],
            "task": ex["task"],
            "subject": ex["subject"],
        }
        for ex in full_dataset
    ]
    with open(alpaca_path, "w", encoding="utf-8") as f:
        json.dump(alpaca_records, f, ensure_ascii=False, indent=2)

    # 3. Write Google AI Studio Supervised Fine-Tuning CSV (`text_input`, `output`)
    csv_path = out_dir / "studentgpt_gemini_tuning.csv"
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["text_input", "output"])
        for ex in full_dataset:
            combined_input = f"{ex['system']}\n\n{ex['user']}"
            writer.writerow([combined_input, ex["assistant"]])

    print(f"Successfully generated {len(full_dataset)} SFT training examples!")
    print(f"  -> ChatML JSONL (Unsloth / HF TRL) : {jsonl_path}")
    print(f"  -> Alpaca JSON  (LLaMA-Factory)    : {alpaca_path}")
    print(f"  -> Gemini CSV   (Google AI Studio) : {csv_path}")

    # 4. Also embed the compressed JSONL directly inside StudentGPT_LoRA_FineTuning_Colab.ipynb
    # so the user only has to upload ONE file (.ipynb) to Google Colab!
    import gzip, base64
    nb_path = out_dir / "StudentGPT_LoRA_FineTuning_Colab.ipynb"
    if nb_path.exists():
        raw_bytes = jsonl_path.read_bytes()
        b64_str = base64.b64encode(gzip.compress(raw_bytes, compresslevel=9)).decode("ascii")
        nb = json.loads(nb_path.read_text(encoding="utf-8"))
        auto_code = (
            "# Auto-unpack built-in 245-example StudentGPT SFT dataset (no separate file upload required!)\n"
            "import os, gzip, base64\n"
            "from datasets import load_dataset\n\n"
            'DATASET_PATH = "studentgpt_sft_dataset.jsonl"\n'
            f'EMBEDDED_DATASET_B64 = "{b64_str}"\n\n'
            "if not os.path.exists(DATASET_PATH):\n"
            '    with open(DATASET_PATH, "wb") as f:\n'
            "        f.write(gzip.decompress(base64.b64decode(EMBEDDED_DATASET_B64)))\n"
            '    print("✅ Automatically unpacked built-in 245-example StudentGPT dataset!")\n\n'
            'dataset = load_dataset("json", data_files=DATASET_PATH, split="train")\n'
            'print(f"✅ Loaded {len(dataset)} StudentGPT SFT training examples!")\n'
            'print("Sample record keys:", dataset[0].keys())\n'
        )
        for cell in nb.get("cells", []):
            if cell.get("cell_type") == "code" and any("DATASET_PATH" in line for line in cell.get("source", [])):
                cell["source"] = [line + "\n" for line in auto_code.strip().split("\n")]
                break
        nb_path.write_text(json.dumps(nb, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  -> Embedded dataset into Colab notebook ({len(b64_str)} bytes compressed): {nb_path}")


if __name__ == "__main__":
    main()
