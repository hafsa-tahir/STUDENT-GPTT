/**
 * lectureGenerator.ts
 *
 * Transforms structured research canvases, study notes, and revision guides
 * into charismatic, enthusiastic, conversational classroom lectures.
 * Employs pedagogical scaffolding, intuition-first explanations, analogies,
 * and exam tips so students feel actively taught rather than read to.
 */

interface ResearchPaperResolved {
  definition: string;
  description: string;
  howItWorks: string;
  pastSummary: string;
  presentAndContributors: string;
  futureOutlook: string;
  quote?: {
    text: string;
    author: string;
    context?: string;
  };
}

interface ResearchBriefInput {
  title: string;
  researchQuestion?: string;
}

interface ObjectiveItem {
  title: string;
  description?: string;
}

interface ConceptItem {
  name: string;
  explanation: string;
}

interface ProjectBoardInput {
  methodology?: string[] | unknown;
  applications?: string[] | unknown;
  misconceptions?: string[] | unknown;
  verificationChecklist?: string[] | unknown;
}

/**
 * Builds an engaging, Feynman-style lecture from a Research Canvas.
 */
export function generateResearchLecture(
  brief: ResearchBriefInput,
  resolved: ResearchPaperResolved,
  parsedObjectives: ObjectiveItem[] = [],
  studyQuestions: string[] = [],
  keyConcepts: ConceptItem[] = [],
  projectBoard?: ProjectBoardInput,
  actionPlan: string[] = []
): string {
  if (!brief || !brief.title) return "";

  const parts: string[] = [];

  // 1. Enthusiastic Warmup & Welcome Hook
  parts.push(
    `Hello and a very warm welcome! Today, we are stepping into an exciting deep dive on ${brief.title}.`
  );
  if (brief.researchQuestion) {
    const cleanQ = brief.researchQuestion.trim().replace(/\?+$/, "");
    parts.push(
      `Have you ever stopped to wonder: ${cleanQ}? That is our central inquiry for today's masterclass. By the time we finish, you won't just memorize the equations—you will understand the physical intuition like a true scholar.`
    );
  } else {
    parts.push(
      `Together, we are going to explore the core principles, intuitive mechanics, and real-world significance of this subject step-by-step.`
    );
  }

  // 2. The Big Picture & Intuitive Definition
  parts.push(`Let's start with the big picture: what is ${brief.title} really all about?`);
  if (resolved.definition) {
    parts.push(`In formal academic terms: ${resolved.definition}.`);
  }
  if (resolved.description) {
    parts.push(
      `Now, let's picture what that actually means in the real world: ${resolved.description}. Notice how powerful this concept is—it gives us the exact geometric and physical framework we need.`
    );
  }

  // 3. Operational Mechanics: How It Works Under The Hood
  if (resolved.howItWorks) {
    parts.push(
      `Now, you might be asking: how does this work under the hood? What are the governing mechanisms? Here is the operational architecture: ${resolved.howItWorks}. When you're solving homework or exam problems, keep this physical picture in mind—forces, vectors, and energy are all working in harmony here.`
    );
  }

  // 4. Historical Genesis, Current Pioneers & Future Horizon
  if (resolved.pastSummary || resolved.presentAndContributors || resolved.futureOutlook) {
    parts.push(`To truly appreciate this breakthrough, let's take a quick look at where it came from and where it is going.`);
    if (resolved.pastSummary) {
      parts.push(`Looking back into history: ${resolved.pastSummary}.`);
    }
    if (resolved.presentAndContributors) {
      parts.push(`In our current global landscape: ${resolved.presentAndContributors}.`);
    }
    if (resolved.futureOutlook) {
      parts.push(`And looking into the future? The horizon is incredibly promising: ${resolved.futureOutlook}.`);
    }
  }

  // 5. Research Objectives & Curious Questions
  if (parsedObjectives.length > 0 || studyQuestions.length > 0) {
    parts.push(`Here are the investigative goals you and I are exploring.`);
    if (parsedObjectives.length > 0) {
      const objHighlights = parsedObjectives
        .slice(0, 3)
        .map((obj, i) => `First, we focus on ${obj.title}${obj.description ? `—specifically ${obj.description}` : ""}.`)
        .join(" ");
      parts.push(`Our primary objectives: ${objHighlights}`);
    }
    if (studyQuestions.length > 0) {
      const qFirst = studyQuestions[0];
      const qSecond = studyQuestions[1];
      if (qFirst) {
        const cleanQ1 = qFirst.trim().replace(/\?+$/, "");
        parts.push(`Ask yourself this critical question: ${cleanQ1}?`);
      }
      if (qSecond) {
        const cleanQ2 = qSecond.trim().replace(/\?+$/, "");
        parts.push(`And another puzzle to consider: ${cleanQ2}? Keep these in mind as we analyze the core concepts!`);
      }
    }
  }

  // 6. Mastering The Key Concepts
  if (keyConcepts.length > 0) {
    parts.push(`Now, let's master the essential conceptual foundations you must have in your mental toolkit.`);
    keyConcepts.slice(0, 5).forEach((c, i) => {
      parts.push(`Concept ${i + 1}: ${c.name}. Here is how to think about it: ${c.explanation}.`);
    });
  }

  // 7. Applications, Methodology & Pitfalls to Avoid
  const asArray = (val: unknown): string[] => Array.isArray(val) ? val.filter(Boolean) : [];
  const apps = asArray(projectBoard?.applications);
  const misc = asArray(projectBoard?.misconceptions);
  const checks = asArray(projectBoard?.verificationChecklist);

  if (apps.length > 0) {
    parts.push(`Where does this touch real-world science and technology? ${apps.slice(0, 3).join(". ")}.`);
  }

  if (misc.length > 0) {
    parts.push(
      `Now, listen carefully to this vital professor tip—students often trip up on these common misconceptions! ${misc.slice(0, 3).join(". ")}. Don't make that mistake on your exams!`
    );
  }

  if (checks.length > 0) {
    parts.push(`Before submitting any work, always verify your steps using this checklist: ${checks.slice(0, 2).join(". ")}.`);
  }

  // 8. Inspiring Concluding Quote
  if (resolved.quote?.text) {
    parts.push(
      `To bring our lecture together, let me leave you with these inspiring words: "${resolved.quote.text}" by ${resolved.quote.author || "Scholarly Authority"}.${resolved.quote.context ? ` ${resolved.quote.context}.` : ""}`
    );
  }

  parts.push(
    `Remember: true scientific mastery isn't just about memorizing formulas—it's about understanding the beautiful principles behind them. Fantastic effort today, and keep your curiosity alive!`
  );

  return parts.filter(Boolean).join(" ");
}

/**
 * Builds an enthusiastic classroom lecture from Study Notes.
 */
export function generateNotesLecture(
  note: { title: string; scopeType?: string; scopeLabel?: string },
  content: {
    overview?: string;
    sections?: Array<{ heading?: string; explanation?: string; bullets?: string[] }>;
    revisionReminders?: string[];
  },
  stickyNotes: Array<{ content: string }> = []
): string {
  if (!note || !note.title) return "";

  const parts: string[] = [];

  parts.push(
    `Welcome to your personalized study masterclass on ${note.title}. Today, we are turning these notes into clear, lasting intuition.`
  );

  if (content.overview) {
    parts.push(`Let's start with our academic overview: ${content.overview}. Notice how every part builds on this foundation.`);
  }

  if (content.sections && content.sections.length > 0) {
    content.sections.forEach((sec, idx) => {
      parts.push(`Let's dive into Section ${idx + 1}: ${sec.heading || "Key Topic"}.`);
      if (sec.explanation) {
        parts.push(`Here is the core idea: ${sec.explanation}.`);
      }
      if (sec.bullets && sec.bullets.length > 0) {
        parts.push(`Pay close attention to these vital takeaways: ${sec.bullets.join(". ")}.`);
      }
    });
  }

  if (content.revisionReminders && content.revisionReminders.length > 0) {
    parts.push(
      `Now, for active recall and exam prep, make sure you remember these key reminders: ${content.revisionReminders.join(". ")}.`
    );
  }

  if (stickyNotes && stickyNotes.length > 0) {
    const notesText = stickyNotes.map((s) => s.content).filter(Boolean).join(". ");
    if (notesText) {
      parts.push(`And keeping your personal study notes in mind: ${notesText}.`);
    }
  }

  parts.push(
    `Review these principles today, practice the formulas with confidence, and you will ace this topic! Great job studying today.`
  );

  return parts.filter(Boolean).join(" ");
}

/**
 * Builds an enthusiastic review masterclass from a Revision Guide.
 */
export function generateRevisionLecture(
  revisionDoc: { title: string; scopeLabel?: string },
  revision: {
    oneLineSummary?: string;
    overview?: string;
    keyDefinitions?: Array<{ term: string; definition: string; memoryTip?: string }>;
    formulaBank?: Array<{ name: string; formula: string; variables?: string; whenToUse?: string }>;
    blocks?: Array<{
      title?: string;
      focus?: string;
      coreSummary?: string;
      keyFormula?: string;
      keyTakeaways?: string[];
      commonMistakes?: string[];
      mnemonic?: string;
    }>;
    selfCheck?: string[];
  }
): string {
  if (!revisionDoc || !revisionDoc.title) return "";

  const parts: string[] = [];

  parts.push(
    `Welcome to your high-yield revision session for ${revisionDoc.title}! Let's review the governing definitions, master formulas, and key memory aids so you can master this subject in minutes.`
  );

  if (revision.oneLineSummary) {
    parts.push(`In one line, here is the core takeaway: ${revision.oneLineSummary}.`);
  }

  if (revision.overview) {
    parts.push(`Academic overview: ${revision.overview}.`);
  }

  if (revision.keyDefinitions && revision.keyDefinitions.length > 0) {
    parts.push(`Let's lock in the essential definitions.`);
    revision.keyDefinitions.slice(0, 5).forEach((d) => {
      parts.push(`${d.term}: ${d.definition}.${d.memoryTip ? ` Memory tip: ${d.memoryTip}.` : ""}`);
    });
  }

  if (revision.formulaBank && revision.formulaBank.length > 0) {
    parts.push(`Now, for our master formula and equation bank.`);
    revision.formulaBank.slice(0, 4).forEach((f) => {
      parts.push(`${f.name}: ${f.formula}.${f.variables ? ` Variables: ${f.variables}.` : ""}${f.whenToUse ? ` Use when: ${f.whenToUse}.` : ""}`);
    });
  }

  if (revision.blocks && revision.blocks.length > 0) {
    revision.blocks.forEach((block, idx) => {
      parts.push(`Revision Block ${idx + 1}: ${block.title || "Core Law"}.`);
      if (block.focus) {
        parts.push(`Focus: ${block.focus}.`);
      }
      if (block.coreSummary) {
        parts.push(`High-yield mechanism: ${block.coreSummary}.`);
      }
      if (block.keyFormula) {
        parts.push(`Governing formula: ${block.keyFormula}.`);
      }
      if (block.keyTakeaways && block.keyTakeaways.length > 0) {
        parts.push(`Takeaways to memorize: ${block.keyTakeaways.join(". ")}.`);
      }
      if (block.commonMistakes && block.commonMistakes.length > 0) {
        parts.push(`Exam pitfalls to avoid: ${block.commonMistakes.join(". ")}.`);
      }
      if (block.mnemonic) {
        parts.push(`Memory trick: ${block.mnemonic}.`);
      }
    });
  }

  if (revision.selfCheck && revision.selfCheck.length > 0) {
    parts.push(
      `Before we conclude, test your recall: ${revision.selfCheck.join(". ")}.`
    );
  }

  parts.push(`You are thoroughly prepared. Trust your preparation, and good luck!`);

  return parts.filter(Boolean).join(" ");
}
