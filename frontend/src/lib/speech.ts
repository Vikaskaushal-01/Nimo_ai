import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const recognitionCtor = (): SpeechRecognitionCtor | undefined => {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/**
 * Voice dictation via the browser's speech recognition (Chrome, Edge, Safari).
 * `onText` receives each finalized phrase; `supported` is false elsewhere.
 */
export const useDictation = (onText: (text: string) => void, onError?: (message: string) => void) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = typeof window !== "undefined" && !!recognitionCtor();
  // Latest callbacks without restarting an active session.
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cb.current.onText(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        cb.current.onError?.("Microphone access was blocked. Allow it in the browser to use voice input.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        cb.current.onError?.(`Voice input stopped (${e.error}).`);
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  // Stop listening when the component unmounts.
  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, start, stop };
};

/** Strips markdown syntax so read-aloud doesn't pronounce asterisks and fences. */
const toSpeech = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, " (code block omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~|]/g, "")
    .replace(/\n{2,}/g, ". ")
    .trim();

/** Read-aloud for one piece of text via the browser's speech synthesis. */
export const useReadAloud = (markdown: string) => {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(() => {
    window.speechSynthesis.cancel(); // only one answer reads at a time
    const u = new SpeechSynthesisUtterance(toSpeech(markdown));
    u.lang = navigator.language || "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, [markdown]);

  // Cancel speech when the answer leaves the screen (chat switched, etc.).
  useEffect(() => () => {
    if (speaking) window.speechSynthesis.cancel();
  }, [speaking]);

  return { supported, speaking, speak, stop };
};
