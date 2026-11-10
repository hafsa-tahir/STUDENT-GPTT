import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { courses, documents, InsertUser, profiles, progressEvents, quizzes, researchBriefs, revisionGuides, studyNotes, studyPlanItems, studyPlans, studySessions, subjects, topics, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

import mysql from "mysql2";
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // node version compatibility
}

let _db: ReturnType<typeof drizzle> | null = null;

const DEFAULT_DATABASE_URL = "";

export async function getDb() {
  if (!_db) {
    try {
      const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
      const baseUrl = url.split("?")[0];
      const pool = mysql.createPool({
        uri: baseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
        connectTimeout: 20000,
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        maxIdle: 2,
        idleTimeout: 30000,
        queueLimit: 0,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
    }
  }
  return _db;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3500, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("The database connection is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const values: InsertUser = { openId: user.openId, lastSignedIn: now, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  const updateSet: Record<string, unknown> = { lastSignedIn: now };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  try {
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (err) {
    console.warn("[upsertUser warn, retrying]", err);
    try {
      await new Promise(r => setTimeout(r, 600));
      await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
    } catch (secondErr) {
      console.warn("[upsertUser retry failed]", secondErr);
    }
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function ensureProfile(userId: number, name?: string | null) {
  const db = requireDb(await getDb());
  const existing = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(profiles).values({ userId, preferredName: name?.trim() || null, timezone: "UTC" });
  const created = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return created[0]!;
}

export async function updateProfile(userId: number, input: { preferredName?: string | null; studyLevel?: string | null; timezone: string }) {
  const db = requireDb(await getDb());
  await ensureProfile(userId);
  await db.update(profiles).set(input).where(eq(profiles.userId, userId));
  const result = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return result[0]!;
}

export async function listSubjects(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(desc(subjects.updatedAt));
}

export async function createSubject(userId: number, input: { name: string; description?: string; color: string }) {
  const db = requireDb(await getDb());
  const result = await db.insert(subjects).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "subject_created", entityType: "subject", entityId: id });
  const created = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateSubject(userId: number, subjectId: number, input: { name?: string; description?: string | null; color?: string }) {
  const db = requireDb(await getDb());
  await db.update(subjects).set(input).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  const updated = await db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Subject not found.");
  return updated[0];
}

export async function deleteSubject(userId: number, subjectId: number) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Subject not found.");
  await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}

export async function assertOwnedSubject(userId: number, subjectId: number) {
  const db = requireDb(await getDb());
  const result = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).limit(1);
  if (!result[0]) throw new Error("Subject not found.");
}

export async function listCourses(userId: number, subjectId?: number) {
  const db = requireDb(await getDb());
  const condition = subjectId ? and(eq(courses.userId, userId), eq(courses.subjectId, subjectId)) : eq(courses.userId, userId);
  return db.select().from(courses).where(condition).orderBy(asc(courses.name));
}

export async function createCourse(userId: number, input: { subjectId: number; name: string; code?: string; description?: string }) {
  await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  const result = await db.insert(courses).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(courses).where(and(eq(courses.id, id), eq(courses.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateCourse(userId: number, courseId: number, input: { name?: string; code?: string | null; description?: string | null }) {
  const db = requireDb(await getDb());
  await db.update(courses).set(input).where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
  const updated = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Course not found.");
  return updated[0];
}

export async function deleteCourse(userId: number, courseId: number) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Course not found.");
  await db.delete(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
}

export async function listTopics(userId: number, subjectId?: number) {
  const db = requireDb(await getDb());
  const condition = subjectId ? and(eq(topics.userId, userId), eq(topics.subjectId, subjectId)) : eq(topics.userId, userId);
  return db.select().from(topics).where(condition).orderBy(desc(topics.updatedAt));
}

export async function createTopic(userId: number, input: { subjectId: number; courseId?: number | null; name: string; notes?: string }) {
  await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  if (input.courseId) {
    const course = await db.select({ id: courses.id, subjectId: courses.subjectId }).from(courses).where(and(eq(courses.id, input.courseId), eq(courses.userId, userId))).limit(1);
    if (!course[0] || course[0].subjectId !== input.subjectId) throw new Error("Course not found.");
  }
  const result = await db.insert(topics).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "topic_created", entityType: "topic", entityId: id });
  const created = await db.select().from(topics).where(and(eq(topics.id, id), eq(topics.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateTopic(userId: number, topicId: number, input: { name?: string; notes?: string | null }) {
  const db = requireDb(await getDb());
  await db.update(topics).set(input).where(and(eq(topics.id, topicId), eq(topics.userId, userId)));
  const updated = await db.select().from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Topic not found.");
  return updated[0];
}

export async function deleteTopic(userId: number, topicId: number) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Topic not found.");
  await db.delete(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId)));
}

export async function getDashboardData(userId: number) {
  const defaultProfile = { id: 1, userId, preferredName: "Student", studyLevel: "University", primaryExamGoal: null, timezone: "UTC", createdAt: new Date(), updatedAt: new Date() };
  const db = await getDb();
  if (!db) {
    return { profile: defaultProfile, subjects: [], todayItems: [], upcomingPlans: [], activity: [], recentSessions: [], sessionMinutesToday: 0 };
  }
  const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); const end = new Date(now); end.setHours(23, 59, 59, 999); const nextMonth = new Date(now); nextMonth.setDate(nextMonth.getDate() + 30);
  try {
    const [profile, subjectRows, todayItems, upcomingPlans, activity, recentSessions] = await Promise.all([
      withTimeout(ensureProfile(userId).catch(() => defaultProfile), 3000, defaultProfile),
      withTimeout(db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(desc(subjects.updatedAt)).catch(() => []), 3000, []),
      withTimeout(db.select({ id: studyPlanItems.id, title: studyPlanItems.title, scheduledFor: studyPlanItems.scheduledFor, estimatedMinutes: studyPlanItems.estimatedMinutes, completedAt: studyPlanItems.completedAt, planTitle: studyPlans.title }).from(studyPlanItems).innerJoin(studyPlans, eq(studyPlanItems.planId, studyPlans.id)).where(and(eq(studyPlanItems.userId, userId), gte(studyPlanItems.scheduledFor, start), lte(studyPlanItems.scheduledFor, end))).orderBy(asc(studyPlanItems.scheduledFor)).catch(() => []), 3000, []),
      withTimeout(db.select().from(studyPlans).where(and(eq(studyPlans.userId, userId), gte(studyPlans.examDate, now), lte(studyPlans.examDate, nextMonth))).orderBy(asc(studyPlans.examDate)).limit(5).catch(() => []), 3000, []),
      withTimeout(db.select().from(progressEvents).where(eq(progressEvents.userId, userId)).orderBy(desc(progressEvents.createdAt)).limit(6).catch(() => []), 3000, []),
      withTimeout(db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.startedAt)).limit(100).catch(() => []), 3000, []),
    ]);
    const sessionMinutesToday = (recentSessions || []).filter(session => session && session.startedAt && new Date(session.startedAt) >= start && new Date(session.startedAt) <= end).reduce((total, session) => total + (session.minutesStudied || 0), 0);
    return {
      profile: profile || defaultProfile,
      subjects: subjectRows || [],
      todayItems: todayItems || [],
      upcomingPlans: upcomingPlans || [],
      activity: activity || [],
      recentSessions: recentSessions || [],
      sessionMinutesToday,
    };
  } catch (err) {
    console.error("[DashboardData Error]", err);
    return { profile: defaultProfile, subjects: [], todayItems: [], upcomingPlans: [], activity: [], recentSessions: [], sessionMinutesToday: 0 };
  }
}

export async function listStudyPlans(userId: number) {
  const db = requireDb(await getDb());
  const plans = await db.select().from(studyPlans).where(eq(studyPlans.userId, userId)).orderBy(asc(studyPlans.examDate));
  const items = await db.select().from(studyPlanItems).where(eq(studyPlanItems.userId, userId)).orderBy(asc(studyPlanItems.scheduledFor));
  const sessions = await db.select().from(studySessions).where(eq(studySessions.userId, userId)).orderBy(desc(studySessions.startedAt)).limit(20);
  return plans.map(plan => ({ ...plan, items: items.filter(item => item.planId === plan.id), sessions: sessions.filter(session => session.planItemId && items.some(item => item.id === session.planItemId && item.planId === plan.id)) }));
}

export async function createStudyPlan(userId: number, input: { subjectId?: number | null; title: string; examDate?: Date | null }) {
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  const db = requireDb(await getDb());
  const result = await db.insert(studyPlans).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(studyPlans).where(and(eq(studyPlans.id, id), eq(studyPlans.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateStudyPlan(userId: number, planId: number, input: { title?: string; examDate?: Date | null }) {
  const db = requireDb(await getDb());
  await db.update(studyPlans).set(input).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
  const updated = await db.select().from(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan not found.");
  return updated[0];
}

export async function deleteStudyPlan(userId: number, planId: number) {
  const db = requireDb(await getDb());
  const owned = await db.select({ id: studyPlans.id }).from(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId))).limit(1);
  if (!owned[0]) throw new Error("Study plan not found.");
  await db.delete(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)));
}

export async function createStudyPlanItem(userId: number, input: { planId: number; title: string; notes?: string | null; scheduledFor?: Date | null; estimatedMinutes: number }) {
  const db = requireDb(await getDb());
  const plan = await db.select({ id: studyPlans.id }).from(studyPlans).where(and(eq(studyPlans.id, input.planId), eq(studyPlans.userId, userId))).limit(1);
  if (!plan[0]) throw new Error("Study plan not found.");
  const result = await db.insert(studyPlanItems).values({ ...input, userId });
  const id = Number(result[0].insertId);
  const created = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, id), eq(studyPlanItems.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateStudyPlanItem(userId: number, itemId: number, input: { title?: string; notes?: string | null; scheduledFor?: Date | null; estimatedMinutes?: number }) {
  const db = requireDb(await getDb());
  await db.update(studyPlanItems).set(input).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId)));
  const updated = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan item not found.");
  return updated[0];
}

export async function toggleStudyPlanItem(userId: number, itemId: number, completed: boolean) {
  const db = requireDb(await getDb());
  await db.update(studyPlanItems).set({ completedAt: completed ? new Date() : null }).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId)));
  const updated = await db.select().from(studyPlanItems).where(and(eq(studyPlanItems.id, itemId), eq(studyPlanItems.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study plan item not found.");
  if (completed) await db.insert(progressEvents).values({ userId, eventType: "plan_item_completed", entityType: "study_plan_item", entityId: itemId });
  return updated[0];
}

export async function createStudySession(userId: number, input: { subjectId?: number | null; planItemId?: number | null; startedAt: Date; endedAt?: Date | null; minutesStudied: number }) {
  const db = requireDb(await getDb());
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (input.planItemId) {
    const item = await db.select({ id: studyPlanItems.id }).from(studyPlanItems).where(and(eq(studyPlanItems.id, input.planItemId), eq(studyPlanItems.userId, userId))).limit(1);
    if (!item[0]) throw new Error("Study plan item not found.");
  }
  const result = await db.insert(studySessions).values({ ...input, userId });
  const id = Number(result[0].insertId);
  await db.insert(progressEvents).values({ userId, eventType: "session_completed", entityType: "study_session", entityId: id, metadata: { minutesStudied: input.minutesStudied } });
  const created = await db.select().from(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, userId))).limit(1);
  return created[0]!;
}

export async function updateStudySession(userId: number, sessionId: number, input: { subjectId?: number | null; planItemId?: number | null; startedAt?: Date; endedAt?: Date | null; minutesStudied?: number }) {
  const db = requireDb(await getDb());
  if (input.subjectId) await assertOwnedSubject(userId, input.subjectId);
  if (input.planItemId) {
    const item = await db.select({ id: studyPlanItems.id }).from(studyPlanItems).where(and(eq(studyPlanItems.id, input.planItemId), eq(studyPlanItems.userId, userId))).limit(1);
    if (!item[0]) throw new Error("Study plan item not found.");
  }
  await db.update(studySessions).set(input).where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
  const updated = await db.select().from(studySessions).where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId))).limit(1);
  if (!updated[0]) throw new Error("Study session not found.");
  return updated[0];
}

export async function recordActiveStudyTime(
  userId: number,
  input: { minutes: number; subjectId?: number | null }
) {
  const db = requireDb(await getDb());
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Check if there is already an active session recorded today for this user
  const existing = await db
    .select()
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        gte(studySessions.startedAt, startOfDay)
      )
    )
    .orderBy(desc(studySessions.startedAt))
    .limit(1);

  if (existing[0]) {
    const updatedMinutes = (existing[0].minutesStudied || 0) + input.minutes;
    await db
      .update(studySessions)
      .set({
        minutesStudied: updatedMinutes,
        endedAt: now,
        ...(input.subjectId ? { subjectId: input.subjectId } : {})
      })
      .where(eq(studySessions.id, existing[0].id));
    return { sessionId: existing[0].id, minutesStudied: updatedMinutes };
  } else {
    const result = await db.insert(studySessions).values({
      userId,
      subjectId: input.subjectId ?? null,
      planItemId: null,
      startedAt: now,
      endedAt: now,
      minutesStudied: input.minutes
    });
    const id = Number(result[0].insertId);
    return { sessionId: id, minutesStudied: input.minutes };
  }
}

export async function getSubjectActivities(userId: number, subjectId: number) {
  const db = requireDb(await getDb());
  await assertOwnedSubject(userId, subjectId);

  const [
    notesList,
    revisionsList,
    quizzesList,
    researchList,
    docsList,
    courseList,
    topicList,
    sessionList
  ] = await Promise.all([
    db.select().from(studyNotes).where(and(eq(studyNotes.userId, userId), eq(studyNotes.subjectId, subjectId))).orderBy(desc(studyNotes.updatedAt)),
    db.select().from(revisionGuides).where(and(eq(revisionGuides.userId, userId), eq(revisionGuides.subjectId, subjectId))).orderBy(desc(revisionGuides.createdAt)),
    db.select().from(quizzes).where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subjectId))).orderBy(desc(quizzes.createdAt)),
    db.select().from(researchBriefs).where(and(eq(researchBriefs.userId, userId), eq(researchBriefs.subjectId, subjectId))).orderBy(desc(researchBriefs.updatedAt)),
    db.select().from(documents).where(and(eq(documents.userId, userId), eq(documents.subjectId, subjectId))).orderBy(desc(documents.createdAt)),
    db.select().from(courses).where(and(eq(courses.userId, userId), eq(courses.subjectId, subjectId))).orderBy(desc(courses.createdAt)),
    db.select().from(topics).where(and(eq(topics.userId, userId), eq(topics.subjectId, subjectId))).orderBy(desc(topics.createdAt)),
    db.select().from(studySessions).where(and(eq(studySessions.userId, userId), eq(studySessions.subjectId, subjectId))).orderBy(desc(studySessions.startedAt))
  ]);

  const totalMinutes = sessionList.reduce((acc, s) => acc + (s.minutesStudied || 0), 0);

  return {
    notes: notesList,
    revisions: revisionsList,
    quizzes: quizzesList,
    research: researchList,
    documents: docsList,
    courses: courseList,
    topics: topicList,
    totalMinutes,
    sessionCount: sessionList.length
  };
}


