# 🎓 StudentGPT

**StudentGPT** is an authenticated, AI-powered academic workspace designed exclusively for students. It empowers users with private, user-owned study data rather than relying on static dashboard content. Whether you need help with research, creating flashcards, or summarizing complex documents, StudentGPT is your ultimate AI study companion.

## 🚀 Features

- **🔐 Secure Authentication:** Real email/password sign-in flow powered by Supabase Auth with robust session verification.
- **🤖 AI Study Assistant:** Built-in chat, research tools, automated notes generation, revision materials, quizzes, and flashcards—all generated dynamically using OpenRouter AI.
- **📂 Private Document Storage:** Securely upload and manage study materials (PDFs). Documents are stored in an S3-compatible private bucket with strict ownership verification.
- **📱 Cross-Platform Ready:** Built with web technologies and mobile-ready using Capacitor for Android and iOS.
- **⚡ Real-time Data Sync:** Normalized workspace data model with a persistent MySQL/TiDB database using Drizzle ORM.
- **🎨 Modern UI/UX:** Responsive, accessible, and stunning user interface crafted with React, Tailwind CSS, Radix UI, and Framer Motion.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion
- **Backend:** Node.js, Express, tRPC, TypeScript
- **Database:** MySQL/TiDB managed via Drizzle ORM
- **Authentication:** Supabase Auth
- **AI Integration:** OpenRouter (gemma-4, gpt-oss, nemotron)
- **Mobile App:** Capacitor (Android)
- **Storage:** S3-compatible Storage

## 📸 Screenshots

*(Add screenshots of your application here to showcase the UI on LinkedIn)*
- Dashboard View
- AI Chat Interface
- Flashcards & Quiz Generation

## 💻 Local Development Setup

To run this project locally, follow these steps:

### 1. Clone the repository

```bash
git clone https://github.com/hafsa-tahir/STUDENT-GPTT.git
cd STUDENT-GPTT
```

### 2. Install Dependencies

Ensure you have `pnpm` installed, then run:

```bash
pnpm install
```

### 3. Environment Variables

Copy the `.env.example` file to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Ensure you have the following keys configured:
- **Supabase:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Database:** `DATABASE_URL`
- **OpenRouter (AI):** `OPENROUTER_API_KEY`

### 4. Run the Development Server

```bash
pnpm dev
```
The application will be available on your local development server.

### 5. Database Migrations

To apply database schema changes, run:
```bash
pnpm db:push
```

## 🤝 Contributing
Feel free to fork the repository, create a feature branch, and submit a pull request!

## 📄 License
This project is licensed under the MIT License.
