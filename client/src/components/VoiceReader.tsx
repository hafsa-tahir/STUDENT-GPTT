import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  SkipBack,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  BookOpen
} from "lucide-react";

interface VoiceReaderProps {
  /** The text content to read aloud (can be markdown, notes, research paper) */
  text: string;
  /** Optional enthusiastic pedagogical professor lecture script */
  lectureText?: string;
  /** Title or label of the section being read */
  title?: string;
  /** Optional custom CSS classes */
  className?: string;
  /** Compact mode flag for smaller inline areas */
  compact?: boolean;
  /** Initial mode: 'lecture' or 'verbatim' */
  initialMode?: "lecture" | "verbatim";
}

// Module-level reference to prevent V8 garbage collection of utterances
const globalUtteranceRegistry = new Set<SpeechSynthesisUtterance>();

/**
 * Prepares mathematical and markdown text for natural speech synthesis:
 * - Converts LaTeX expressions to spoken English
 * - Strips code blocks, brackets, and markdown tags
 */
function cleanTextForSpeech(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    // Code blocks & markdown headers
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    // Mathematical symbols and fractions to spoken words
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2")
    .replace(/\\vec\{([^}]+)\}/g, "$1 vector")
    .replace(/\\hat\{([^}]+)\}/g, "unit vector $1")
    .replace(/\\tau/g, "tau")
    .replace(/\\varepsilon_0|\\epsilon_0/g, "epsilon naught")
    .replace(/\\pi/g, "pi")
    .replace(/\\theta/g, "theta")
    .replace(/\\approx/g, " approximately ")
    .replace(/\\rightarrow|\\to/g, " approaches ")
    .replace(/\\infty/g, "infinity")
    .replace(/\\int/g, "integral of ")
    .replace(/\\sum/g, "sum of ")
    .replace(/\\sqrt\{([^}]+)\}/g, "square root of $1")
    .replace(/\^3/g, " cubed")
    .replace(/\^2/g, " squared")
    .replace(/\^\{([^}]+)\}/g, " to the power of $1")
    .replace(/\^([0-9a-zA-Z])/g, " to the power of $1")
    .replace(/_\{([^}]+)\}/g, " sub $1")
    .replace(/_([0-9a-zA-Z])/g, " sub $1")
    // Operators & comparison signs to natural spoken words (prevents SAPI parser crashes)
    .replace(/&/g, " and ")
    .replace(/\\times/g, " times ")
    .replace(/\\cdot/g, " dot ")
    .replace(/>>/g, " is much greater than ")
    .replace(/<</g, " is much less than ")
    .replace(/>=/g, " is greater than or equal to ")
    .replace(/<=/g, " is less than or equal to ")
    .replace(/>/g, " is greater than ")
    .replace(/</g, " is less than ")
    .replace(/=/g, " equals ")
    .replace(/\+/g, " plus ")
    .replace(/(?<=\s)-(?=\s|[a-zA-Z0-9])/g, " minus ")
    .replace(/·|•/g, ", ")
    // Strip leftover LaTeX commands, brackets, and math delimiters
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.slice(2, -2))
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}\\]/g, "")
    // Turn parentheses into soft pauses
    .replace(/[()\[\]]/g, ", ")
    // Deduplicate and clean punctuation
    .replace(/\.{2,}/g, ".")
    .replace(/[,;]{2,}/g, ",")
    .replace(/\s*,\s*\./g, ".")
    .replace(/\s*([.,!?;])\s*/g, "$1 ")
    // Cleanup whitespace
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Splits cleaned text into short sentence chunks (<140 chars).
 * Critical for Chromium / Windows SAPI which fails on utterances >250 chars.
 */
function chunkTextForSpeech(text: string, maxLen: number = 140): string[] {
  if (!text) return [];

  // Split on sentence terminators: . ! ? ; or newlines
  const sentences = text
    .split(/(?<=[.!?;\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[,.\s;]+$/.test(s));

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // Break long sentence by commas, colons or dashes
        const parts = sentence.split(/(?<=[,:\-])\s+/);
        for (const p of parts) {
          if ((current + " " + p).trim().length <= maxLen) {
            current = (current + " " + p).trim();
          } else {
            if (current && !/^[,.\s;]+$/.test(current)) chunks.push(current);
            current = p.trim();
          }
        }
      }
    } else if ((current + " " + sentence).length <= maxLen) {
      current += " " + sentence;
    } else {
      if (current && !/^[,.\s;]+$/.test(current)) chunks.push(current);
      current = sentence;
    }
  }

  if (current.trim() && !/^[,.\s;]+$/.test(current)) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

/**
 * Plays an immediate, pleasant 150ms audio chime via Web Audio API.
 * This ensures the browser's audio subsystem is unmuted and unlocked by user click.
 */
function playAudioChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export const VoiceReader: React.FC<VoiceReaderProps> = ({
  text,
  lectureText,
  title = "Audio Study Reader",
  className = "",
  compact = false,
  initialMode
}) => {
  const [mode, setMode] = useState<"lecture" | "verbatim">(
    initialMode || (lectureText ? "lecture" : "verbatim")
  );

  useEffect(() => {
    if (lectureText && !initialMode) {
      setMode("lecture");
    }
  }, [lectureText, initialMode]);

  const activeText = mode === "lecture" && lectureText ? lectureText : text;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chunks = useMemo(() => {
    const cleaned = cleanTextForSpeech(activeText);
    return chunkTextForSpeech(cleaned);
  }, [activeText]);

  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const currentChunkIndexRef = useRef(0);
  currentChunkIndexRef.current = currentChunkIndex;

  const rateRef = useRef(rate);
  rateRef.current = rate;

  const selectedVoiceURIRef = useRef(selectedVoiceURI);
  selectedVoiceURIRef.current = selectedVoiceURI;

  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const useCloudAudioRef = useRef<boolean>(false);

  // Load available speech synthesis voices (or fall back to Cloud TTS for Android WebView / APK)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      useCloudAudioRef.current = true;
      return;
    }

    const updateVoices = () => {
      try {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          useCloudAudioRef.current = false;
          setVoices(available);

          // Find default preferred voice
          const preferred =
            available.find(
              (v) =>
                v.lang.startsWith("en") &&
                (v.name.includes("Natural") ||
                  v.name.includes("Google") ||
                  v.name.includes("Jenny") ||
                  v.name.includes("Guy") ||
                  v.name.includes("Samantha") ||
                  v.name.includes("David") ||
                  v.name.includes("Zira"))
            ) ||
            available.find((v) => v.lang.startsWith("en")) ||
            available[0];

          if (preferred && !selectedVoiceURIRef.current) {
            setSelectedVoiceURI(preferred.voiceURI);
          }
        }
      } catch (err) {
        console.warn("Could not retrieve speech voices:", err);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch {}
      }
    };
  }, []);

  // Heartbeat to prevent Chromium from silently sleeping after 14s of speech
  useEffect(() => {
    if (!isPlaying || useCloudAudioRef.current) return;

    const interval = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          try {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } catch {}
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Core function to speak a specific chunk by index (supports both Web Speech API & Cloud Audio for Android APK)
  const speakChunk = useCallback((index: number) => {
    const chunkList = chunksRef.current;
    if (!chunkList || index < 0 || index >= chunkList.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentChunkIndex(0);
      return;
    }

    setCurrentChunkIndex(index);
    const textToSpeak = chunkList[index];

    const hasWebSpeech =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined" &&
      !useCloudAudioRef.current;

    if (!hasWebSpeech) {
      // Cloud TTS Audio Engine for Android APK WebView & unsupported mobile browsers
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(`/api/tts?text=${encodeURIComponent(textToSpeak)}`);
        audio.playbackRate = rateRef.current;
        audioRef.current = audio;

        audio.onplay = () => {
          setIsPlaying(true);
          setIsPaused(false);
          setErrorMessage(null);
        };

        audio.onended = () => {
          if (!isPlayingRef.current) return;
          const nextIndex = index + 1;
          if (nextIndex < chunkList.length) {
            setTimeout(() => {
              if (isPlayingRef.current) speakChunk(nextIndex);
            }, 50);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentChunkIndex(0);
          }
        };

        audio.onerror = () => {
          if (!isPlayingRef.current) return;
          const nextIndex = index + 1;
          if (nextIndex < chunkList.length) {
            setTimeout(() => {
              if (isPlayingRef.current) speakChunk(nextIndex);
            }, 80);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        };

        audio.play().catch(() => {
          setIsPlaying(false);
        });
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    // Unpause in case Chromium was stuck
    try {
      window.speechSynthesis.resume();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rateRef.current;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;

    // Pick voice - prefer local offline English voice if possible
    const currentVoices = window.speechSynthesis.getVoices();
    const voice =
      currentVoices.find((v) => v.voiceURI === selectedVoiceURIRef.current) ||
      currentVoices.find((v) => v.lang.startsWith("en") && (v as any).localService) ||
      currentVoices.find((v) => v.lang.startsWith("en")) ||
      currentVoices[0];

    if (voice) {
      try {
        utterance.voice = voice;
        utterance.lang = voice.lang || "en-US";
      } catch {}
    } else {
      utterance.lang = "en-US";
    }

    // Keep reference in global registry to prevent GC
    globalUtteranceRegistry.add(utterance);

    let isHandled = false;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setErrorMessage(null);
    };

    utterance.onend = () => {
      if (isHandled) return;
      isHandled = true;
      globalUtteranceRegistry.delete(utterance);
      if (!isPlayingRef.current) return;

      // Speak next chunk
      const nextIndex = index + 1;
      if (nextIndex < chunkList.length) {
        // Slight delay between sentences for natural pacing
        setTimeout(() => {
          if (isPlayingRef.current) {
            speakChunk(nextIndex);
          }
        }, 65);
      } else {
        // Completed
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentChunkIndex(0);
      }
    };

    utterance.onerror = (e) => {
      if (isHandled) return;
      isHandled = true;
      globalUtteranceRegistry.delete(utterance);
      if (!isPlayingRef.current || e.error === "canceled" || e.error === "interrupted") return;

      console.warn("Speech synthesis chunk error:", e);
      // Skip cleanly to next chunk if one fails
      const nextIndex = index + 1;
      if (nextIndex < chunkList.length) {
        setTimeout(() => {
          if (isPlayingRef.current) {
            speakChunk(nextIndex);
          }
        }, 90);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("speechSynthesis.speak failed:", err);
      setIsPlaying(false);
      setErrorMessage("Could not play audio. Please ensure browser audio is permitted.");
    }
  }, []);

  const handlePlay = () => {
    if (typeof window === "undefined") return;

    setErrorMessage(null);

    if (!chunks.length) {
      setErrorMessage("No text content available to read yet.");
      return;
    }

    // Play subtle wake-up chime to ensure audio output is unlocked
    playAudioChime();

    // If currently paused, resume directly
    if (isPaused) {
      if (useCloudAudioRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.resume();
          if (window.speechSynthesis.speaking) {
            setIsPaused(false);
            setIsPlaying(true);
            return;
          }
        } catch {}
      }
    }

    // Immediate UI feedback
    setIsPlaying(true);
    setIsPaused(false);

    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch {}
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }

    const startIndex = currentChunkIndexRef.current >= chunks.length ? 0 : currentChunkIndexRef.current;

    setTimeout(() => {
      speakChunk(startIndex);
    }, 70);
  };

  const handlePause = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    globalUtteranceRegistry.clear();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentChunkIndex(0);
  };

  const handleSkipForward = () => {
    const nextIdx = Math.min(chunks.length - 1, currentChunkIndex + 1);
    handleStop();
    setCurrentChunkIndex(nextIdx);
    setTimeout(() => {
      speakChunk(nextIdx);
    }, 100);
  };

  const handleSkipBack = () => {
    const prevIdx = Math.max(0, currentChunkIndex - 1);
    handleStop();
    setCurrentChunkIndex(prevIdx);
    setTimeout(() => {
      speakChunk(prevIdx);
    }, 100);
  };

  const handleSwitchMode = (newMode: "lecture" | "verbatim") => {
    if (newMode === mode) return;
    const wasPlaying = isPlaying;
    handleStop();
    setMode(newMode);
    if (wasPlaying) {
      setTimeout(() => {
        handlePlay();
      }, 120);
    }
  };

  const cycleRate = () => {
    const rates = [0.85, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(rate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setRate(nextRate);
    rateRef.current = nextRate;

    if (useCloudAudioRef.current && audioRef.current) {
      try {
        audioRef.current.playbackRate = nextRate;
      } catch {}
      return;
    }

    // If currently playing, restart current chunk with new rate
    if (isPlaying) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      setTimeout(() => {
        speakChunk(currentChunkIndexRef.current);
      }, 70);
    }
  };

  // Compact Mode (for Chat or inline widgets)
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-2.5 py-1 text-xs text-[#724060] ${className}`}>
        {isPlaying ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex items-center gap-1 rounded-lg bg-[#724060] px-2.5 py-1 font-semibold text-[#FDF3F3] hover:bg-[#5b324c] shadow-xs"
            title="Pause Voice Mode"
          >
            <Pause className="h-3 w-3 fill-current" /> Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center gap-1 rounded-lg bg-[#724060] px-2.5 py-1 font-semibold text-[#FDF3F3] hover:bg-[#5b324c] shadow-xs"
            title="Listen to Explanation"
          >
            <Play className="h-3 w-3 fill-current" /> {isPaused ? "Resume" : "Listen"}
          </button>
        )}
        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded p-1 text-[#724060] hover:bg-[#F8E7E7]"
            title="Stop audio"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        )}
      </div>
    );
  }

  const progressPercent = chunks.length > 0 ? Math.round(((currentChunkIndex + 1) / chunks.length) * 100) : 0;
  const currentSentence = chunks[currentChunkIndex] || "";

  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-[#A070A1]/30 bg-gradient-to-r from-[#FDF3F3] via-white to-[#F8E7E7] p-3.5 sm:p-4 shadow-sm transition ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3">
          <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl bg-[#724060] text-[#FDF3F3] shadow-xs">
            <Volume2 className={`h-5 w-5 ${isPlaying ? "animate-bounce" : ""}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h4 className="break-words text-[13px] sm:text-[13.5px] font-bold text-[#724060]">{title}</h4>
              {mode === "lecture" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#724060] px-2.5 py-0.5 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-[#FDF3F3] shadow-xs">
                  <GraduationCap className="h-3 w-3" /> Professor Lecture
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F8E7E7] px-2.5 py-0.5 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-[#724060]">
                  <BookOpen className="h-3 w-3" /> Verbatim Reading
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] sm:text-[11.5px] text-[#A070A1]">
              {isPlaying
                ? `Reading sentence ${currentChunkIndex + 1} of ${chunks.length}...`
                : isPaused
                  ? "Paused — click resume to continue"
                  : mode === "lecture"
                    ? `Enthusiastic pedagogical lecture · ${chunks.length} sentences ready`
                    : `Verbatim scholarly text · ${chunks.length} sections ready`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Animated Audio Equalizer Bars when active */}
          {isPlaying && (
            <div className="hidden sm:flex items-center gap-1 px-2">
              <span className="h-4 w-1 animate-pulse rounded-full bg-[#A070A1]" style={{ animationDelay: "0ms" }} />
              <span className="h-6 w-1 animate-pulse rounded-full bg-[#724060]" style={{ animationDelay: "150ms" }} />
              <span className="h-3 w-1 animate-pulse rounded-full bg-[#A070A1]" style={{ animationDelay: "300ms" }} />
              <span className="h-5 w-1 animate-pulse rounded-full bg-[#724060]" style={{ animationDelay: "450ms" }} />
            </div>
          )}

          {/* Previous Sentence Button */}
          <button
            type="button"
            onClick={handleSkipBack}
            disabled={currentChunkIndex === 0}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#F8E7E7] bg-white text-[#724060] shadow-2xs hover:bg-[#FDF3F3] disabled:opacity-30"
            title="Previous sentence"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          {/* Primary Play / Pause Button */}
          {isPlaying ? (
            <button
              type="button"
              onClick={handlePause}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-4 text-[13px] font-bold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c]"
            >
              <Pause className="h-4 w-4 fill-current" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#724060] px-4 text-[13px] font-bold text-[#FDF3F3] shadow-md transition hover:bg-[#5b324c]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{isPaused ? "Resume Audio" : "Listen Now"}</span>
            </button>
          )}

          {/* Next Sentence Button */}
          <button
            type="button"
            onClick={handleSkipForward}
            disabled={currentChunkIndex >= chunks.length - 1}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#F8E7E7] bg-white text-[#724060] shadow-2xs hover:bg-[#FDF3F3] disabled:opacity-30"
            title="Next sentence"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          {/* Stop / Reset Button */}
          {(isPlaying || isPaused || currentChunkIndex > 0) && (
            <button
              type="button"
              onClick={handleStop}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#F8E7E7] bg-white text-[#724060] shadow-2xs hover:bg-[#F8E7E7]"
              title="Stop & Reset"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          )}

          {/* Speed Selector */}
          <button
            type="button"
            onClick={cycleRate}
            className="flex h-9 items-center gap-1 rounded-xl border border-[#F8E7E7] bg-white px-2.5 text-[12px] font-bold text-[#724060] shadow-2xs hover:bg-[#FDF3F3]"
            title="Adjust playback speed"
          >
            <Gauge className="h-3.5 w-3.5 text-[#A070A1]" />
            <span>{rate}x</span>
          </button>

          {/* Voice Selector Dropdown (if multiple voices available) */}
          {voices.length > 1 && (
            <select
              value={selectedVoiceURI}
              onChange={(e) => {
                setSelectedVoiceURI(e.target.value);
                selectedVoiceURIRef.current = e.target.value;
                if (isPlaying) {
                  try { window.speechSynthesis.cancel(); } catch {}
                  setTimeout(() => speakChunk(currentChunkIndexRef.current), 70);
                }
              }}
              className="hidden lg:block h-9 max-w-[140px] rounded-xl border border-[#F8E7E7] bg-white px-2 text-[11px] font-semibold text-[#724060] outline-none shadow-2xs"
              title="Select speech voice"
            >
              {voices
                .filter((v: SpeechSynthesisVoice) => v.lang.startsWith("en"))
                .map((v: SpeechSynthesisVoice) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name.replace(/Microsoft |Google /g, "").slice(0, 16)}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* Mode Selector Tabs (Professor Lecture vs Read Verbatim) */}
      {lectureText && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#F8E7E7] pt-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#A070A1]/20 bg-white/95 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSwitchMode("lecture")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                mode === "lecture"
                  ? "bg-[#724060] text-[#FDF3F3] shadow-xs"
                  : "text-[#724060] hover:bg-[#FDF3F3]"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Professor Lecture</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode("verbatim")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                mode === "verbatim"
                  ? "bg-[#724060] text-[#FDF3F3] shadow-xs"
                  : "text-[#724060] hover:bg-[#FDF3F3]"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Read Verbatim</span>
            </button>
          </div>
          <span className="text-[11.5px] font-medium text-[#724060]/80 italic">
            {mode === "lecture"
              ? "Teaches concepts with structured explanations, intuitive analogies and exam preparation"
              : "Reads the exact paper sections word-for-word"}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {chunks.length > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F8E7E7]">
            <div
              className="h-full bg-gradient-to-r from-[#A070A1] to-[#724060] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Spoken Sentence Subtitle Box */}
      {(isPlaying || isPaused) && currentSentence && (
        <div className="mt-3 rounded-xl border border-[#A070A1]/20 bg-white/90 p-3 text-[12.5px] leading-5 text-[#724060] shadow-2xs">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#A070A1] mb-1">
            <span>Currently Speaking</span>
            <span>{currentChunkIndex + 1} / {chunks.length}</span>
          </div>
          <p className="font-medium italic">"{currentSentence}"</p>
        </div>
      )}

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-[12px] text-amber-900 border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceReader;
