# StudentGPT

StudentGPT is an authenticated, full-stack academic workspace and AI study platform designed for rigorous university and college learning. Built with a user-owned data model, StudentGPT integrates structured document analysis, comprehensive note synthesis, active-recall practice engines, publication-grade research canvases, and dual-mode pedagogical voice narration into a unified scholarly environment.

---

## Architectural Overview

StudentGPT is engineered as an end-to-end TypeScript application combining a React SPA frontend with an Express and tRPC backend, backed by MySQL/TiDB via Drizzle ORM and Supabase Cloud Storage and Authentication.


---

## Core Features

### 1. Academic Dashboard & Learning Analytics
- **Curriculum & Subject Organizer:** Create courses and track study units with persistent metadata, exam target dates, and color-coded subject tags.
- **Study Session Time Tracker:** Log study duration and track real-time study volume across subjects.
- **Recent Academic Activity:** View interactive history logs for generated notes, scored quiz assessments, flashcard reviews, and document uploads.
- **Direct Curriculum Access:** Seamlessly transition between subjects and generate scoped study materials from unified subject action menus.

### 2. Comprehensive Note Maker & Synthesizer
- **Exhaustive 5-Part Document Breakdown:** Synthesize course materials into comprehensive, textbook-quality notes featuring formal definitions, physical/theoretical explanations, step-by-step mathematical formulations, worked examples, and key takeaways.
- **Native LaTeX Formula Rendering:** Powered by KaTeX to render inline and block-level mathematical equations, physics notations, and engineering formulations with full typographic fidelity.
- **Context-Bound Synthesis:** Directly processes uploaded course PDFs or syllabus topic titles with strict fidelity rules to eliminate hallucinated claims.
- **Interactive Margin Sticky Notes:** Add persistent, color-coded annotations and study memos to specific sections of any generated note.

### 3. High-Yield Revision Guide Engine
- **Master Formula Bank:** Centralizes essential equations, variable definitions, standard SI units, and exam-relevant contexts into an easily scannable reference table.
- **Key Definition Dictionary:** Precise, formal academic definitions for critical concepts.
- **Complete Worked Derivations:** Step-by-step problem solutions and mathematical proofs formatted with explicit line-by-line justification.
- **Exam Traps & Pitfalls:** Highlights high-frequency student misconceptions, boundary condition errors, and algebraic traps to avoid in examinations.

### 4. Dual-Mode Voice Reader & Narration Bar
- **Professor Lecture Mode:** An enthusiastic, pedagogical lecture experience that teaches concepts using intuitive real-world analogies, conceptual scaffolding, and exam-focused commentary.
- **Read Verbatim Mode:** Word-for-word scholarly narration for precise textual review.
- **Audio Subtitle Tracking:** Real-time synchronized sentence display, playback rate controls (0.75x to 1.5x), sentence scrubbing, and browser SpeechSynthesis integration.

### 5. Practice Studio (Active Recall & Spaced Repetition)
- **Scoped Self-Assessment Quizzes:** Generates scoped multiple-choice questions tailored to specific chapters, sections, or topics with configurable difficulty tiers (Easy, Medium, Hard).
- **Automated Scoring & Detailed Rationale:** Instant scoring with comprehensive explanations and step-by-step solutions for every question.
- **Spaced Flashcards:** Active recall card deck with Leitner/SM-2-style retention scheduling. Supports card flipping and self-rating (Again, Hard, Good, Easy) to schedule future review intervals.
- **Assessment History:** Persistent tracking of previous quiz scores and card retention outcomes.

### 6. Academic Research Board & Publication Canvas
- **Continuous Learning Synthesis:** Generates multi-section academic research preprints structured into formal definitions, operational architectures, historical discovery timelines, and future breakthrough trajectories.
- **Strict Accuracy Governance:** Anti-hallucination prompt rules prohibit invented facts, fabricated dates, or generic institution dumps.
- **Multimedia Research Appendix:** Automatically integrates scholarly video recommendations via the YouTube Data API and community perspectives via SerpAPI.
- **Export Options:** Download research briefs as high-resolution publication canvas images (PNG) or structured academic markdown documents (.md).

### 7. Grounded Study Chat Assistant
- **8 Dedicated Learning Modes:** Scaffolded dialogue modes including Teach, Explain, Simplify, Step-by-Step, Worked Examples, Socratic Quiz Me, Practice, and Exam Prep.
- **Private Document Grounding:** Query uploaded course textbooks or lecture slide decks; assistant retrieves relevant chunks and provides cited responses.
- **Professional Markdown Formatting:** Zero decorative emojis or casual filler; clean mathematical layout with KaTeX equations and code syntax blocks.

### 8. Private Document Vault & Cloud Storage
- **Multi-Cloud Asset Pipeline:** Upload and store course PDFs in Supabase Cloud Storage with presigned private CDN URLs and local fallback.
- **Automated PDF Parsing & Chunking:** Extracts document text, computes page boundaries, calculates token counts, and indexes chunks for semantic retrieval.

### 9. Multi-Provider AI Fallback Engine
- **Fault-Tolerant AI Architecture:** Seamlessly routes prompts across Groq (qwen/qwen3.8-27b), Google Gemini, and OpenRouter (gemma-4, gpt-oss, nemotron).
- **Automated Rate-Limit Handling:** Transparently retries and falls back to alternate models on HTTP 429 status codes, ensuring uninterrupted generation.
- **Strict Schema Enforcement:** Validates JSON payloads before persisting artifacts to prevent corrupt database entries.

---

## Design System & Palette

StudentGPT uses a disciplined academic aesthetic tailored to long study sessions:

| Token | Hex Code | Purpose |
| :--- | :--- | :--- |
| Deep Plum | `#724060` | Primary brand color, headers, primary buttons |
| Lavender Plum | `#A070A1` | Secondary accents, active borders, section subtitles |
| Soft Blush | `#F8E7E7` | Card backgrounds, badge fills, subtle dividing lines |
| Off-White Canvas | `#FDF3F3` | Surface background, paper canvases, input fields |

All icons use Lucide SVG vector glyphs. Childish, decorative emojis are excluded from both UI components and system prompt instructions.

---

## Technology Stack

- **Client:** React 19, TypeScript, Vite, Tailwind CSS, Radix UI primitives, KaTeX, Lucide React, html-to-image
- **Server:** Node.js, Express, tRPC v11, SuperJSON, serverless-http
- **Database:** MySQL / TiDB cloud clusters managed via Drizzle ORM
- **Authentication:** Supabase Auth (JWT session management with local developer fallback)
- **Object Storage:** Supabase Cloud Storage (S3-compatible public and presigned private buckets)
- **AI Infrastructure:** Multi-tier client routing through Groq, Google Gemini, and OpenRouter APIs
- **External APIs:** SerpAPI (Academic Web Perspectives), YouTube Data API v3 (Educational Video Appendix)

---

## Database Schema

StudentGPT manages a normalized schema spanning 16 relational tables:

- `users`: Authenticated user profiles, OpenID references, and roles.
- `subjects`: Academic subjects, curriculum metadata, and theme identifiers.
- `courses` & `topics`: Course hierarchies and topic nodes.
- `documents` & `documentChunks`: Uploaded student files, text extractions, page indices, and content hashes.
- `studyNotes` & `stickyNotes`: Dynamic study notes, synthesized sections, and user margin memos.
- `revisionGuides`: High-yield revision assets, formula banks, and derivations.
- `quizzes`, `quizQuestions`, `quizAttempts`, `attemptAnswers`: Active recall assessments and answer scoring.
- `flashcards` & `flashcardReviews`: Spaced repetition flashcards and review schedule logs.
- `researchBriefs`, `researchSources`, `researchExports`: Deep research syntheses, citations, and export records.
- `conversations` & `messages`: Study chat threads, message roles, citations, and status flags.
- `studyPlans`, `studyPlanItems`, `studySessions`: Study schedule planner and minute tracking.

---

## Environment Variables

Copy the provided `.env.example` template to `.env` in the project root:

```bash
cp .env.example .env
```

Configure the following credentials:

```env
# Database Connection (MySQL / TiDB)
DATABASE_URL="mysql://user:password@host:4000/studentgpt?ssl={\"rejectUnauthorized\":true}"

# Session Security
JWT_SECRET="your-secure-random-jwt-secret"

# Supabase (Authentication & Storage)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# AI Model Providers (Configure at least one)
GROQ_API_KEYS="gsk_key1,gsk_key2"
GEMINI_API_KEYS="AIzaSyKey1,AIzaSyKey2"
OPENROUTER_API_KEY="sk-or-v1-key"

# External Research Services (Optional)
SERPAPI_KEY="your-serpapi-key"
YOUTUBE_DATA_API_KEY="your-youtube-data-api-key"

# Application Settings
VITE_APP_TITLE="StudentGPT"
```

> Note: The real `.env` file containing secrets is strictly ignored by Git and must never be committed to public repositories.

---

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Push Database Schema
```bash
npm run db:push
```

### 3. Start Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:3000`.

### 4. Run Automated Test Suite
```bash
npx tsx scratch/test_comprehensive_suite.ts
```

### 5. Build for Production
```bash
npm run build
```

---

## Deployment & Hosting

### Deploying to Vercel (Recommended)

StudentGPT is pre-configured for seamless full-stack deployment on Vercel:

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Add New... -> Project** and import `STUDENT-GPTT`.
3. Under **Build and Output Settings**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
4. Under **Environment Variables**, paste the keys defined in your `.env` file (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEYS`, `GEMINI_API_KEYS`, `OPENROUTER_API_KEY`, etc.).
5. Click **Deploy**. Vercel will build the frontend assets into `dist/public` and mount the Express API handler via `api/index.ts`.

### Deploying to Netlify

StudentGPT includes native Netlify serverless configurations in `netlify.toml`:
1. Link your GitHub repository in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist/public`
4. Functions directory: `netlify/functions`
5. Configure environment variables in Netlify Site Settings.

### Deploying to Render / Railway / Docker
For persistent Node.js servers, start the pre-compiled server:
```bash
npm run build
npm start
```
The production server listens on the port defined by `PORT` (default `3000`).

---

## License

This project is open-source software licensed under the [MIT License](LICENSE).
