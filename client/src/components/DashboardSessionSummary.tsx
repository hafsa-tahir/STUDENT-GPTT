type StudySession = { id: number; startedAt: Date | string; minutesStudied: number };

export function DashboardSessionSummary({ minutesToday, sessions }: { minutesToday: number; sessions: StudySession[] }) {
  return (
    <section className="mx-auto mt-9 sm:mt-12 max-w-[1380px] pb-8">
      <div className="rounded-[28px] border border-[#724060]/12 bg-white p-6 sm:p-8 shadow-[0_12px_28px_rgba(114,64,96,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-[#2D1826]">
              Study sessions
            </h2>
            <p className="mt-1 text-[13px] text-[#724060]/80">
              Logged time from your actual completed study sessions.
            </p>
          </div>
          <p className="text-[24px] font-bold tracking-tight text-[#724060]">
            {minutesToday}{" "}
            <span className="text-[12px] font-medium text-[#724060]/80">
              minutes today
            </span>
          </p>
        </div>
        {sessions.length ? (
          <div className="mt-6 divide-y divide-[#724060]/12">
            {sessions.slice(0, 4).map(session => (
              <div
                key={session.id}
                className="flex items-center justify-between py-3.5 text-[13px]"
              >
                <span className="font-medium text-[#2D1826]">
                  {new Date(session.startedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="font-semibold text-[#724060]">
                  {session.minutesStudied} minutes
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-[#FDF3F3] p-4.5 text-[13px] text-[#724060]">
            Log a session from the study planner to see your focused time here.
          </p>
        )}
      </div>
    </section>
  );
}
