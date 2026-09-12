import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { availableChatModels, createChatConversation, getChatConversation, listChatConversations, regenerateChatMessage, sendChatMessage } from "./chatService";
import { listPrivateDocuments } from "./documentService";
import { generateFlashcards, generateQuiz, getQuiz, listFlashcardReviewHistory, listFlashcards, listQuizAttemptHistory, reviewFlashcard, submitQuiz } from "./learningArtifactsService";
import { addResearchSource, createResearchBrief, createResearchBriefFromTopic, exportResearchBrief, getResearchBrief, getResearchExportDownload, listResearchBriefs, listResearchExports, synthesizeResearchBrief } from "./researchService";
import { searchResearchVideos } from "./youtubeService";
import { searchCommunityPerspectives } from "./serpapiService";
import { addStickyNote, generateRevisionGuide, generateStudyNotes, getStudyNote, listRevisionGuides, listStudyNotes } from "./notesService";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createCourse, createStudyPlan, createStudyPlanItem, createStudySession, createSubject, createTopic, deleteCourse, deleteStudyPlan, deleteSubject, deleteTopic, ensureProfile, getDashboardData, listCourses, listStudyPlans, listSubjects, listTopics, toggleStudyPlanItem, updateCourse, updateProfile, updateStudyPlan, updateStudyPlanItem, updateStudySession, updateSubject, updateTopic } from "./db";
import { chatConversationInput, chatMessageInput, courseInput, flashcardGenerationInput, learningModeInput, profileInput, quizGenerationInput, studyPlanInput, studyPlanItemInput, studySessionInput, subjectInput, topicInput } from "./validators";

function toApiError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  if (message.endsWith("not found.")) throw new TRPCError({ code: "NOT_FOUND", message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We could not complete that action. Please try again." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    bootstrap: protectedProcedure.query(async ({ ctx }) => { try { return await ensureProfile(ctx.user.id, ctx.user.name); } catch (error) { return toApiError(error); } }),
    dashboard: protectedProcedure.query(async ({ ctx }) => { try { return await getDashboardData(ctx.user.id); } catch (error) { return toApiError(error); } }),
    updateProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => { try { return await updateProfile(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
  }),
  academic: router({
    listSubjects: protectedProcedure.query(async ({ ctx }) => { try { return await listSubjects(ctx.user.id); } catch (error) { return toApiError(error); } }),
    createSubject: protectedProcedure.input(subjectInput).mutation(async ({ ctx, input }) => { try { return await createSubject(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updateSubject: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: subjectInput.partial() })).mutation(async ({ ctx, input }) => { try { return await updateSubject(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
    deleteSubject: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { await deleteSubject(ctx.user.id, input.id); return { success: true } as const; } catch (error) { return toApiError(error); } }),
    listCourses: protectedProcedure.input(z.object({ subjectId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { try { return await listCourses(ctx.user.id, input?.subjectId); } catch (error) { return toApiError(error); } }),
    createCourse: protectedProcedure.input(courseInput).mutation(async ({ ctx, input }) => { try { return await createCourse(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updateCourse: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: courseInput.omit({ subjectId: true }).partial() })).mutation(async ({ ctx, input }) => { try { return await updateCourse(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
    deleteCourse: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { await deleteCourse(ctx.user.id, input.id); return { success: true } as const; } catch (error) { return toApiError(error); } }),
    listTopics: protectedProcedure.input(z.object({ subjectId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { try { return await listTopics(ctx.user.id, input?.subjectId); } catch (error) { return toApiError(error); } }),
    createTopic: protectedProcedure.input(topicInput).mutation(async ({ ctx, input }) => { try { return await createTopic(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updateTopic: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: topicInput.pick({ name: true, notes: true }).partial() })).mutation(async ({ ctx, input }) => { try { return await updateTopic(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
    deleteTopic: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { await deleteTopic(ctx.user.id, input.id); return { success: true } as const; } catch (error) { return toApiError(error); } }),
  }),
  planner: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listStudyPlans(ctx.user.id); } catch (error) { return toApiError(error); } }),
    createPlan: protectedProcedure.input(studyPlanInput).mutation(async ({ ctx, input }) => { try { return await createStudyPlan(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updatePlan: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: studyPlanInput.omit({ subjectId: true }).partial() })).mutation(async ({ ctx, input }) => { try { return await updateStudyPlan(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
    deletePlan: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { await deleteStudyPlan(ctx.user.id, input.id); return { success: true } as const; } catch (error) { return toApiError(error); } }),
    createItem: protectedProcedure.input(studyPlanItemInput).mutation(async ({ ctx, input }) => { try { return await createStudyPlanItem(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updateItem: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: studyPlanItemInput.omit({ planId: true }).partial() })).mutation(async ({ ctx, input }) => { try { return await updateStudyPlanItem(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
    setItemCompletion: protectedProcedure.input(z.object({ id: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => { try { return await toggleStudyPlanItem(ctx.user.id, input.id, input.completed); } catch (error) { return toApiError(error); } }),
    logSession: protectedProcedure.input(studySessionInput).mutation(async ({ ctx, input }) => { try { return await createStudySession(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    updateSession: protectedProcedure.input(z.object({ id: z.number().int().positive(), data: studySessionInput.partial() })).mutation(async ({ ctx, input }) => { try { return await updateStudySession(ctx.user.id, input.id, input.data); } catch (error) { return toApiError(error); } }),
  }),
  chat: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listChatConversations(ctx.user.id); } catch (error) { return toApiError(error); } }),
    models: protectedProcedure.query(async () => { try { return await availableChatModels(); } catch (error) { return toApiError(error); } }),
    create: protectedProcedure.input(chatConversationInput).mutation(async ({ ctx, input }) => { try { return await createChatConversation(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    get: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getChatConversation(ctx.user.id, input.conversationId); } catch (error) { return toApiError(error); } }),
    send: protectedProcedure.input(chatMessageInput).mutation(async ({ ctx, input }) => { try { return await sendChatMessage(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    regenerate: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await regenerateChatMessage(ctx.user.id, input.conversationId); } catch (error) { return toApiError(error); } }),
  }),
  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listPrivateDocuments(ctx.user.id); } catch (error) { return toApiError(error); } }),
  }),
  research: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listResearchBriefs(ctx.user.id); } catch (error) { return toApiError(error); } }),
    get: protectedProcedure.input(z.object({ briefId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getResearchBrief(ctx.user.id, input.briefId); } catch (error) { return toApiError(error); } }),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(220), researchQuestion: z.string().trim().min(10).max(6000), subjectId: z.number().int().positive().nullable().optional(), topicId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => { try { return await createResearchBrief(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    createFromTopic: protectedProcedure.input(z.object({ topic: z.string().trim().min(3).max(220), subjectId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => { try { return await createResearchBriefFromTopic(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    synthesize: protectedProcedure.input(z.object({ briefId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await synthesizeResearchBrief(ctx.user.id, input.briefId); } catch (error) { return toApiError(error); } }),
    addSource: protectedProcedure.input(z.object({ briefId: z.number().int().positive(), title: z.string().trim().min(3).max(300), url: z.string().url().max(2048).nullable().optional(), note: z.string().trim().max(12000).nullable().optional() })).mutation(async ({ ctx, input }) => { try { return await addResearchSource(ctx.user.id, input.briefId, input); } catch (error) { return toApiError(error); } }),
    videos: protectedProcedure.input(z.object({ query: z.string().trim().min(3).max(240) })).query(async ({ input }) => { try { return await searchResearchVideos(input.query); } catch (error) { return toApiError(error); } }),
    community: protectedProcedure.input(z.object({ query: z.string().trim().min(3).max(240) })).query(async ({ input }) => { try { return await searchCommunityPerspectives(input.query); } catch (error) { return toApiError(error); } }),
    exports: protectedProcedure.input(z.object({ briefId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listResearchExports(ctx.user.id, input.briefId); } catch (error) { return toApiError(error); } }),
    exportDocument: protectedProcedure.input(z.object({ briefId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await exportResearchBrief(ctx.user.id, input.briefId); } catch (error) { return toApiError(error); } }),
    downloadExport: protectedProcedure.input(z.object({ exportId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await getResearchExportDownload(ctx.user.id, input.exportId); } catch (error) { return toApiError(error); } }),
  }),
  notes: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listStudyNotes(ctx.user.id); } catch (error) { return toApiError(error); } }),
    get: protectedProcedure.input(z.object({ noteId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getStudyNote(ctx.user.id, input.noteId); } catch (error) { return toApiError(error); } }),
    generate: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(260), topic: z.string().trim().max(6000).nullable().optional(), subjectId: z.number().int().positive().nullable().optional(), documentId: z.number().int().positive().nullable().optional(), scopeType: z.enum(["topic", "chapter", "section", "range", "document"]), scopeLabel: z.string().trim().min(2).max(300) })).mutation(async ({ ctx, input }) => { try { return await generateStudyNotes(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    addSticky: protectedProcedure.input(z.object({ studyNoteId: z.number().int().positive(), content: z.string().trim().min(1).max(3000), color: z.enum(["yellow", "mint", "lavender", "peach"]) })).mutation(async ({ ctx, input }) => { try { return await addStickyNote(ctx.user.id, input.studyNoteId, input); } catch (error) { return toApiError(error); } }),
  }),
  revision: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listRevisionGuides(ctx.user.id); } catch (error) { return toApiError(error); } }),
    generate: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(260), topic: z.string().trim().max(6000).nullable().optional(), subjectId: z.number().int().positive().nullable().optional(), documentId: z.number().int().positive().nullable().optional(), scopeType: z.enum(["topic", "chapter", "section", "range", "document"]), scopeLabel: z.string().trim().min(2).max(300) })).mutation(async ({ ctx, input }) => { try { return await generateRevisionGuide(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
  }),
  quizzes: router({
    generate: protectedProcedure.input(quizGenerationInput).mutation(async ({ ctx, input }) => { try { return await generateQuiz(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    get: protectedProcedure.input(z.object({ quizId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getQuiz(ctx.user.id, input.quizId); } catch (error) { return toApiError(error); } }),
    submit: protectedProcedure.input(z.object({ quizId: z.number().int().positive(), answers: z.array(z.object({ questionId: z.number().int().positive(), answer: z.string().max(500) })) })).mutation(async ({ ctx, input }) => { try { return await submitQuiz(ctx.user.id, input.quizId, input.answers); } catch (error) { return toApiError(error); } }),
    attempts: protectedProcedure.query(async ({ ctx }) => { try { return await listQuizAttemptHistory(ctx.user.id); } catch (error) { return toApiError(error); } }),
  }),
  flashcards: router({
    list: protectedProcedure.query(async ({ ctx }) => { try { return await listFlashcards(ctx.user.id); } catch (error) { return toApiError(error); } }),
    generate: protectedProcedure.input(flashcardGenerationInput).mutation(async ({ ctx, input }) => { try { return await generateFlashcards(ctx.user.id, input); } catch (error) { return toApiError(error); } }),
    review: protectedProcedure.input(z.object({ flashcardId: z.number().int().positive(), outcome: z.enum(["again", "hard", "good", "easy"]) })).mutation(async ({ ctx, input }) => { try { return await reviewFlashcard(ctx.user.id, input.flashcardId, input.outcome); } catch (error) { return toApiError(error); } }),
    reviews: protectedProcedure.query(async ({ ctx }) => { try { return await listFlashcardReviewHistory(ctx.user.id); } catch (error) { return toApiError(error); } }),
  }),
});

export type AppRouter = typeof appRouter;
