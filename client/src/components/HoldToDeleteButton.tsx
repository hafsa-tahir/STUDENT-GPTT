import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

export function HoldToDeleteButton({
  onConfirm,
  label = "Hold to delete",
  compact = false,
  disabled = false,
  title = "Press and hold to delete",
}: {
  onConfirm: () => void;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  function startHold(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    if (disabled) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    let current = 0;
    timerRef.current = window.setInterval(() => {
      current += 10;
      setProgress(current);
      if (current >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setProgress(0);
        onConfirm();
      }
    }, 55);
  }

  function cancelHold(e?: React.MouseEvent | React.TouchEvent) {
    if (e) e.stopPropagation();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onClick={e => e.stopPropagation()}
      className={`relative overflow-hidden inline-flex items-center gap-1.5 rounded-full border border-rose-300/80 bg-rose-50/70 text-rose-700 font-semibold transition select-none hover:border-rose-400 hover:bg-rose-100/70 disabled:opacity-50 cursor-pointer ${
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"
      }`}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-rose-500/25 transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
      <Trash2 className="relative z-10 h-3.5 w-3.5 text-rose-600" />
      <span className="relative z-10">
        {progress > 0 ? `Hold ${Math.min(100, progress)}%` : label}
      </span>
    </button>
  );
}

