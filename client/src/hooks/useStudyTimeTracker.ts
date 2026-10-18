import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

export function useStudyTimeTracker() {
  const { user } = useSupabaseAuth();
  const utils = trpc.useUtils();
  const recordActiveTime = trpc.workspace.recordActiveTime.useMutation({
    onSuccess: () => {
      utils.workspace.dashboard.invalidate();
    }
  });

  const [isActive, setIsActive] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);

  const lastActivityTimeRef = useRef<number>(Date.now());
  const unsavedSecondsRef = useRef<number>(0);
  const totalSessionSecondsRef = useRef<number>(0);
  const recordMutationRef = useRef(recordActiveTime);
  recordMutationRef.current = recordActiveTime;

  // Track user interaction to detect genuine activity
  useEffect(() => {
    if (!user) return;

    function recordActivity() {
      lastActivityTimeRef.current = Date.now();
      setIsActive(true);
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, recordActivity, { passive: true }));

    // Heartbeat ticker every second
    const interval = window.setInterval(() => {
      const now = Date.now();
      const isWindowVisible = document.visibilityState === "visible";
      // Considered active if an interaction happened within the last 60 seconds and tab is visible
      const currentlyEngaged = isWindowVisible && (now - lastActivityTimeRef.current <= 60000);

      setIsActive(currentlyEngaged);

      if (currentlyEngaged) {
        unsavedSecondsRef.current += 1;
        totalSessionSecondsRef.current += 1;
        setSessionMinutes(Math.floor(totalSessionSecondsRef.current / 60));

        // Flush to backend every 60 seconds of active engagement
        if (unsavedSecondsRef.current >= 60) {
          const minutesToRecord = Math.round((unsavedSecondsRef.current / 60) * 10) / 10;
          unsavedSecondsRef.current = 0;
          recordMutationRef.current.mutate({ minutes: Math.max(0.5, minutesToRecord) });
        }
      }
    }, 1000);

    // Flush any remaining active time on tab hide or window unload
    const handleFlush = () => {
      if (unsavedSecondsRef.current >= 20) {
        const minutesToRecord = Math.round((unsavedSecondsRef.current / 60) * 10) / 10;
        unsavedSecondsRef.current = 0;
        recordMutationRef.current.mutate({ minutes: Math.max(0.5, minutesToRecord) });
      }
    };

    window.addEventListener("beforeunload", handleFlush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        handleFlush();
      }
    });

    return () => {
      events.forEach(event => window.removeEventListener(event, recordActivity));
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", handleFlush);
    };
  }, [user]);

  return {
    isActive,
    sessionMinutes,
    recordInstantTime: (minutes: number, subjectId?: number | null) => {
      if (!user) return;
      recordMutationRef.current.mutate({ minutes, subjectId });
    }
  };
}
