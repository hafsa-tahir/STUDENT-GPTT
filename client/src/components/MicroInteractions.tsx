import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Sparkles } from "lucide-react";
import { MouseEvent, ReactNode, useEffect, useState } from "react";

/**
 * MicroKit / UIAble Spotlight + 3D Hover Tilt Card
 * Tracks cursor position to render a soft radial plum/blush spotlight glow
 * and subtle spring lift on hover.
 */
export function SpotlightCard({
  children,
  className = "",
  onClick,
  spotlightColor = "rgba(160, 112, 161, 0.14)",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  spotlightColor?: string;
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(360px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 75%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/**
 * MicroKit MorphCopyButton
 * Morphs smoothly between a Copy icon and a spring-bounced Checkmark when clicked.
 */
export function MorphCopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors cursor-pointer select-none ${
        copied
          ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
          : "border-[#724060]/15 bg-[#FDF3F3] text-[#724060] hover:bg-[#F8E7E7]"
      } ${className}`}
      title="Copy to clipboard"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
            className="inline-flex items-center gap-1"
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{copiedLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="inline-flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            <span>{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/**
 * Uiverse / MicroKit Multi-Step AI Synthesis Loader
 * Shows animated concentric pulsing rings + cycling status steps during AI generation.
 */
export function AiSynthesisLoader({
  title = "Synthesizing with AI…",
  steps = [
    "Parsing document structure & headings…",
    "Extracting key definitions & LaTeX formulas…",
    "Verifying academic accuracy & exam traps…",
    "Formatting structured studio output…",
  ],
}: {
  title?: string;
  steps?: string[];
}) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx(prev => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-[26px] border border-[#724060]/15 bg-white p-8 text-center shadow-[0_14px_38px_rgba(114,64,96,0.08)]"
    >
      {/* Uiverse 3D Pulsing Concentric Orbs */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0.08, 0.35] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-[#A070A1]"
        />
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-2 rounded-full bg-[#724060]"
        />
        <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#522943] to-[#724060] text-white shadow-lg">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
      </div>

      <h3 className="mt-4 text-[17px] font-bold text-[#2D1826]">{title}</h3>

      <div className="mt-1.5 h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIdx}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[12.5px] font-medium text-[#724060]/80"
          >
            {steps[stepIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Animated Progress Shimmer Bar */}
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-[#F8E7E7]">
        <motion.div
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#724060] via-[#A070A1] to-[#724060]"
        />
      </div>
    </motion.div>
  );
}

/**
 * Floating 3D Illustration Showcase Badge for Page Hero Banners
 */
export function FloatingHeroIllustration({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      whileHover={{ scale: 1.04, rotate: -1 }}
      className="relative overflow-hidden rounded-[22px] border border-white/25 bg-white/15 p-2 shadow-[0_14px_34px_rgba(0,0,0,0.2)] backdrop-blur-md"
    >
      <img
        src={src}
        alt={alt}
        className="h-24 w-40 sm:h-28 sm:w-48 rounded-2xl object-cover"
      />
      {caption && (
        <span className="mt-1 block text-center text-[10px] font-bold uppercase tracking-wider text-[#FDF3F3]/90">
          {caption}
        </span>
      )}
    </motion.div>
  );
}
