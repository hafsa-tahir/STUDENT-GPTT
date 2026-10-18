import { DashboardSessionSummary } from "@/components/DashboardSessionSummary";
import { AppLoading, AuthError, StudentAppShell } from "@/components/StudentAppShell";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  Flame,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

function eventLabel(event: string) {
  return event.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export default function Dashboard() {
  const { user, loading, authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  const dashboard = trpc.workspace.dashboard.useQuery(undefined, {
    enabled: Boolean(user),
    retry: 1,
    refetchInterval: 30000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!loading && !authError && !user) setLocation("/login");
  }, [authError, loading, setLocation, user]);

  if (loading) return <AppLoading />;
  if (authError) return <AuthError message={authError} />;
  if (!user) return <AppLoading />;

  const userDisplayName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Student";

  const fallbackProfile = {
    id: 1,
    userId: 1,
    preferredName: userDisplayName,
    studyLevel: "University",
    primaryExamGoal: null,
    timezone: "UTC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const data = dashboard.data || {
    profile: fallbackProfile,
    subjects: [],
    todayItems: [],
    upcomingPlans: [],
    activity: [],
    recentSessions: [],
    sessionMinutesToday: 0,
  };

  const name =
    data.profile?.preferredName ||
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    "there";

  const completed = data.todayItems.filter(item => item.completedAt).length;
  const completion = data.todayItems.length
    ? Math.round((completed / data.todayItems.length) * 100)
    : 0;

  // Compute 7-day Monday through Sunday schedule
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday ...
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const mondayDate = new Date(today);
  mondayDate.setDate(today.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekTrend = daysOfWeek.map((dayName, index) => {
    const dayStart = new Date(mondayDate);
    dayStart.setDate(mondayDate.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const isToday =
      today.getFullYear() === dayStart.getFullYear() &&
      today.getMonth() === dayStart.getMonth() &&
      today.getDate() === dayStart.getDate();

    let minutes = (data.recentSessions || [])
      .filter(session => {
        const sDate = new Date(session.startedAt);
        return sDate >= dayStart && sDate < dayEnd;
      })
      .reduce((sum, session) => sum + (session.minutesStudied || 0), 0);

    // If it's today, ensure live sessionMinutesToday is accurately matched if higher
    if (isToday && data.sessionMinutesToday > minutes) {
      minutes = data.sessionMinutesToday;
    }

    const formattedTime =
      minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim()
        : minutes > 0
        ? `${minutes}m`
        : "0m";

    return {
      dayName,
      fullDate: dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      minutes,
      formattedTime,
      isToday,
      isPastOrToday: dayStart <= today,
    };
  });

  const totalWeekMinutes = weekTrend.reduce((acc, d) => acc + d.minutes, 0);
  const maxMinutes = Math.max(...weekTrend.map(point => point.minutes), 30);
  const todayFocus = data.todayItems[0];

  return (
    <StudentAppShell>
      <div className="min-h-screen bg-[#FDF3F3] px-4 py-5 sm:px-7 sm:py-8 lg:px-9">
        <div className="mx-auto max-w-[1380px]">
          {/* Top Quick Search & Actions Banner */}
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#F8E7E7] bg-white/95 px-5 py-3.5 shadow-[0_12px_32px_rgba(114,64,96,.08)] sm:px-6">
            <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-xl bg-[#FDF3F3] px-3.5 py-2.5 text-[#A070A1]">
              <Search className="h-4 w-4 text-[#A070A1]" />
              <span className="text-[12px] font-medium text-[#724060]/80">Search your study space, subjects, or notes</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLocation("/research")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-4 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(114,64,96,.15)] hover:bg-[#5a334c] transition"
              >
                <Compass className="h-4 w-4" /> Research
              </button>
              <button
                onClick={() => setLocation("/subjects?create=1")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 text-[12px] font-semibold text-[#724060] hover:bg-[#F8E7E7] transition"
              >
                <Plus className="h-4 w-4" /> Add subject
              </button>
            </div>
          </header>

          {/* Hero Greeting Section */}
          <section className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#A070A1]">
                StudentGPT overview
              </p>
              <h1 className="mt-2 text-[34px] font-semibold tracking-[-.06em] text-[#724060] sm:text-[42px]">
                Good to see you, {name}.
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#724060]/75">
                A calm, structured view of your academic momentum, study rhythm, and subject activity.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F8E7E7] bg-white px-4 py-2 text-[12px] font-semibold text-[#724060] shadow-xs">
              <Flame className="h-4 w-4 text-[#A070A1]" />
              <span>{data.sessionMinutesToday} focused minutes today</span>
            </div>
          </section>

          {/* Main Grid Content */}
          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,.75fr)]">
            <div className="space-y-5">
              {/* Metric Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-[24px] bg-[#724060] p-5 text-white shadow-[0_16px_35px_rgba(114,64,96,.2)]">
                  <div className="flex items-start justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#A070A1] text-white">
                      <Target className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-semibold text-[#F8E7E7]">TODAY</span>
                  </div>
                  <p className="mt-7 text-[34px] font-semibold tracking-[-.06em]">{completion}%</p>
                  <p className="mt-1 text-[12px] text-[#F8E7E7]">Focus completion</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#A070A1]">
                    <div className="h-full rounded-full bg-white" style={{ width: `${completion}%` }} />
                  </div>
                </article>

                <article className="rounded-[24px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)]">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <p className="mt-7 text-[34px] font-semibold tracking-[-.06em] text-[#724060]">
                    {data.subjects.length}
                  </p>
                  <p className="mt-1 text-[12px] text-[#724060]/70">Active subjects</p>
                  <button
                    onClick={() => setLocation("/subjects")}
                    className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#A070A1] hover:text-[#724060]"
                  >
                    View subjects <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>

                <article className="rounded-[24px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)]">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FDF3F3] text-[#724060]">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <p className="mt-7 text-[34px] font-semibold tracking-[-.06em] text-[#724060]">
                    {data.upcomingPlans.length}
                  </p>
                  <p className="mt-1 text-[12px] text-[#724060]/70">Upcoming exam plans</p>
                  <button
                    onClick={() => setLocation("/planner")}
                    className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-[#A070A1] hover:text-[#724060]"
                  >
                    Open planner <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              </div>

              {/* 7-Day Monday Through Sunday Study Chart */}
              <article className="rounded-[26px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#A070A1]">
                      Study activity
                    </p>
                    <h2 className="mt-2 text-[20px] font-semibold tracking-[-.04em] text-[#724060]">
                      Your focused minutes this week
                    </h2>
                    <p className="mt-1 text-[12px] text-[#724060]/70">
                      {totalWeekMinutes > 0 ? (
                        <>
                          Total{" "}
                          <span className="font-bold text-[#724060]">
                            {totalWeekMinutes >= 60
                              ? `${Math.floor(totalWeekMinutes / 60)}h ${totalWeekMinutes % 60}m`
                              : `${totalWeekMinutes}m`}
                          </span>{" "}
                          focused study recorded this week
                        </>
                      ) : (
                        "Active study time is automatically logged as you read, practice, and research."
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F8E7E7] bg-[#FDF3F3] px-3 py-1.5 text-[11px] font-semibold text-[#724060]">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live tracking active
                    </span>
                  </div>
                </div>

                {/* 7-day Monday through Sunday chart */}
                <div className="mt-7 grid grid-cols-7 items-end gap-2 sm:gap-3 border-b border-[#F8E7E7] pb-3">
                  {weekTrend.map(point => {
                    const heightPercent = Math.max(8, Math.round((point.minutes / maxMinutes) * 100));
                    return (
                      <div key={point.dayName} className="flex flex-col items-center justify-end gap-2 group">
                        {/* Exact minutes pill */}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${
                            point.isToday
                              ? "bg-[#724060] text-white shadow-xs"
                              : point.minutes > 0
                              ? "bg-[#F8E7E7] text-[#724060]"
                              : "text-[#A070A1]/60"
                          }`}
                        >
                          {point.formattedTime}
                        </span>

                        {/* Bar groove + fill */}
                        <div className="relative flex h-36 w-full max-w-12 items-end justify-center rounded-xl bg-[#FDF3F3] p-1">
                          <div
                            className={`w-full rounded-lg transition-all duration-500 ${
                              point.isToday
                                ? "bg-gradient-to-t from-[#724060] to-[#A070A1] shadow-[0_4px_12px_rgba(114,64,96,0.3)] ring-2 ring-[#724060]/30"
                                : point.minutes > 0
                                ? "bg-[#A070A1] hover:bg-[#724060]"
                                : "bg-[#F8E7E7]/80"
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>

                        {/* Day Label & Date */}
                        <div className="text-center">
                          <span
                            className={`block text-[11px] font-bold ${
                              point.isToday
                                ? "text-[#724060] underline underline-offset-4 decoration-2 decoration-[#724060]"
                                : "text-[#724060]/80"
                            }`}
                          >
                            {point.dayName}
                          </span>
                          <span className="block text-[9px] font-medium text-[#A070A1]">
                            {point.fullDate}
                          </span>
                          {point.isToday && (
                            <span className="mt-0.5 inline-block rounded-full bg-[#724060] px-1.5 py-0.2 text-[8px] font-bold text-white uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              {/* Bottom Cards: Today's focus & Research Studio */}
              <div className="grid gap-5 md:grid-cols-[1.2fr_.8fr]">
                <article className="rounded-[26px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#A070A1]">
                        Today’s focus
                      </p>
                      <h2 className="mt-2 text-[19px] font-semibold tracking-[-.04em] text-[#724060]">
                        One useful next step.
                      </h2>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-[#A070A1]" />
                  </div>
                  {todayFocus ? (
                    <div className="mt-5 rounded-2xl bg-[#F8E7E7] p-4">
                      <p className="text-[14px] font-semibold text-[#724060]">{todayFocus.title}</p>
                      <p className="mt-1 text-[12px] text-[#724060]/70">
                        {todayFocus.planTitle} · {todayFocus.estimatedMinutes} minute session
                      </p>
                      <button
                        onClick={() => setLocation("/planner")}
                        className="mt-4 text-[12px] font-semibold text-[#724060] hover:underline"
                      >
                        Continue in planner
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-[#F8E7E7] p-4">
                      <p className="text-[14px] font-semibold text-[#724060]">Your day is open.</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#724060]/70">
                        Add a plan to turn your next deadline into a focused session.
                      </p>
                      <button
                        onClick={() => setLocation("/planner")}
                        className="mt-4 text-[12px] font-semibold text-[#724060] hover:underline"
                      >
                        Plan a session
                      </button>
                    </div>
                  )}
                </article>

                <article className="rounded-[26px] bg-[#A070A1] p-5 text-white shadow-[0_12px_28px_rgba(114,64,96,.16)]">
                  <Sparkles className="h-5 w-5" />
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[.16em] text-[#F8E7E7]">
                    Research studio
                  </p>
                  <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-[-.04em]">
                    Turn a topic into a study board.
                  </h2>
                  <button
                    onClick={() => setLocation("/research")}
                    className="mt-5 inline-flex items-center gap-1 text-[12px] font-semibold text-white hover:underline"
                  >
                    Open research <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              </div>
            </div>

            {/* Sidebar Columns */}
            <aside className="space-y-5">
              <article className="rounded-[26px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#A070A1]">
                      Study signals
                    </p>
                    <h2 className="mt-2 text-[19px] font-semibold tracking-[-.04em] text-[#724060]">
                      Recent activity
                    </h2>
                  </div>
                  <Activity className="h-5 w-5 text-[#A070A1]" />
                </div>
                <div className="mt-5 space-y-3">
                  {data.activity.length ? (
                    data.activity.slice(0, 5).map(event => (
                      <div key={event.id} className="flex gap-3">
                        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#F8E7E7] text-[#724060]">
                          <Activity className="h-3 w-3" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-[#724060]">
                            {eventLabel(event.eventType)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#A070A1]">
                            {new Date(event.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[#F8E7E7] p-4 text-[12px] leading-5 text-[#724060]/70">
                      Your genuine study actions will collect here.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-[26px] border border-[#F8E7E7] bg-white p-5 shadow-[0_12px_28px_rgba(114,64,96,.07)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#A070A1]">
                      Academic spaces
                    </p>
                    <h2 className="mt-2 text-[19px] font-semibold tracking-[-.04em] text-[#724060]">
                      Your study map
                    </h2>
                  </div>
                  <Layers3 className="h-5 w-5 text-[#A070A1]" />
                </div>
                <div className="mt-5 space-y-2">
                  {data.subjects.length ? (
                    data.subjects.slice(0, 4).map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => setLocation(`/subjects?subjectId=${subject.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl bg-[#FDF3F3] px-3 py-3 text-left hover:bg-[#F8E7E7] transition"
                      >
                        <span
                          className="h-8 w-1.5 rounded-full"
                          style={{ backgroundColor: subject.color || "#A070A1" }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-[#724060]">
                            {subject.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#A070A1]">
                            Open subject activity hub
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#A070A1]" />
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => setLocation("/subjects?create=1")}
                      className="w-full rounded-xl bg-[#FDF3F3] p-4 text-left text-[12px] font-semibold text-[#724060]"
                    >
                      Create your first subject
                    </button>
                  )}
                </div>
              </article>
            </aside>
          </section>
        </div>
        <DashboardSessionSummary
          minutesToday={data.sessionMinutesToday}
          sessions={data.recentSessions}
        />
      </div>
    </StudentAppShell>
  );
}
