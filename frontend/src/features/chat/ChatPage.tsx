import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDown, Download, Menu, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { conversationToMarkdown, downloadText, slugify } from "@/lib/export";
import type { StreamDecisionPayload } from "@/lib/stream";
import { toast } from "@/stores/toast.store";
import { useUiStore } from "@/stores/ui.store";
import { useChatStore } from "@/stores/chat.store";
import type { DecisionResult, StoredMessage } from "@/types/engine";
import { KnowledgeDrawer } from "@/features/knowledge/KnowledgeDrawer";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { ConversationSidebar } from "./ConversationSidebar";
import { MessageItem, type MessageData } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { StreamingDecision } from "./StreamingDecision";
import { useDecisionStream } from "./useDecisionStream";

export const ChatPage = () => {
  const qc = useQueryClient();
  const {
    conversationId,
    selectedModels,
    setConversation,
    newChat,
    useKnowledgeBase,
    selectedDocumentIds,
    answerStyle,
  } = useChatStore();
  // Whether the user is reading near the bottom; only then do we auto-follow output.
  const [atBottom, setAtBottom] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setSidebarOpen, setPrefill } = useUiStore();
  // Last request sent, so a failed one can be retried in one click.
  const lastPayloadRef = useRef<StreamDecisionPayload | null>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
  });
  const title = conversations?.find((c) => c._id === conversationId)?.title ?? "New chat";

  const { data: messages = [], isError: messagesFailed } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.listMessages(conversationId as string),
    enabled: !!conversationId,
    retry: false,
  });

  // The open conversation vanished (deleted in another tab): start fresh
  // instead of failing every send against a missing conversation.
  useEffect(() => {
    if (messagesFailed) setConversation(null);
  }, [messagesFailed, setConversation]);

  const onDone = useCallback(
    (result: DecisionResult) => {
      // Show the finished answer immediately instead of flashing an empty
      // thread while the messages query refetches.
      const { conversationId: convId, messageId, ...rest } = result;
      const stored: StoredMessage = {
        ...rest,
        _id: messageId,
        conversationId: convId,
        requestedModels: result.meta.requestedModels,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<StoredMessage[]>(["messages", convId], (old) =>
        old?.some((m) => m._id === messageId) ? old : [...(old ?? []), stored],
      );
      if (!conversationId) setConversation(convId);
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    [conversationId, qc, setConversation],
  );

  const onError = useCallback((message: string) => setError(message), []);

  const { state, start, reset } = useDecisionStream(onDone, onError);

  // Conversation the in-flight stream belongs to. Switching to another one
  // cancels the stream rather than rendering it in the wrong thread.
  const streamConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.active && conversationId !== streamConvRef.current) reset();
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const send = (payload: StreamDecisionPayload) => {
    setError(null);
    lastPayloadRef.current = payload;
    streamConvRef.current = conversationId;
    start(payload);
  };

  const onSubmit = (prompt: string) =>
    send({
      prompt,
      models: selectedModels,
      conversationId: conversationId ?? undefined,
      useKnowledgeBase: useKnowledgeBase || selectedDocumentIds.length > 0,
      documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
      style: answerStyle,
    });

  const retry = () => {
    const last = lastPayloadRef.current;
    if (last) send({ ...last, conversationId: conversationId ?? undefined });
  };

  // Cancel generation and hand the prompt back so it can be edited and resent.
  const stop = () => {
    reset();
    if (lastPayloadRef.current) setPrefill(lastPayloadRef.current.prompt);
  };

  const exportChat = () => {
    downloadText(`${slugify(title)}.md`, conversationToMarkdown(title, messages));
    toast("Conversation exported");
  };

  // Shortcuts: Ctrl/Cmd+Shift+O → new chat, Esc → stop generating.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (e.key === "Escape" && state.active) {
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  // Follow new content (also while streaming) unless the user scrolled up to read.
  useEffect(() => {
    if (atBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, state.models, state.stage]);

  // Opening a conversation or sending a prompt always jumps to the latest content.
  useEffect(() => {
    setAtBottom(true);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [conversationId, state.active]);

  const isEmpty = messages.length === 0 && !state.active;

  return (
    <div className="flex h-screen overflow-hidden">
      <KnowledgeDrawer />
      <SettingsDialog />
      <ConversationSidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2 md:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{title}</h2>
          {messages.length > 0 && (
            <button
              onClick={exportChat}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
              title="Download this conversation as Markdown"
            >
              <Download size={13} /> Export
            </button>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6">
            {isEmpty ? (
              <EmptyState onPick={setPrefill} />
            ) : (
              <div className="space-y-8">
                {messages.map((m) => (
                  <MessageItem key={m._id} message={m as unknown as MessageData} />
                ))}
                {state.active && <StreamingDecision state={state} />}
              </div>
            )}
          </div>
        </div>
        {!atBottom && !isEmpty && (
          <button
            onClick={() => scrollToBottom()}
            className="glass-strong absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-200 shadow-panel hover:text-white"
            aria-label="Scroll to latest"
          >
            <ArrowDown size={13} /> Latest
          </button>
        )}
        </div>

        <div className="border-t border-white/10 bg-bg/60 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-4xl px-4 py-3">
            {error && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <TriangleAlert size={13} className="shrink-0" />
                <span className="min-w-0 flex-1">{error}</span>
                {lastPayloadRef.current && (
                  <button
                    onClick={retry}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-medium text-red-200 hover:bg-red-500/20"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                )}
              </div>
            )}
            <PromptInput onSubmit={onSubmit} onStop={stop} isPending={state.active} />
          </div>
        </div>
      </main>
    </div>
  );
};

const EXAMPLE_PROMPTS = [
  "Explain the CAP theorem with a real-world example",
  "Compare PostgreSQL and MongoDB for a new SaaS app",
  "Write a Python function to deduplicate a list while keeping order",
  "What are the pros and cons of remote work for startups?",
];

const EmptyState = ({ onPick }: { onPick: (prompt: string) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex min-h-[60vh] flex-col items-center justify-center text-center"
  >
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 shadow-glow">
      <Sparkles size={28} className="text-accent-soft" />
    </div>
    <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent">
      Multiple AI Models. One Intelligent Decision.
    </h1>
    <p className="mt-3 max-w-md text-sm text-slate-400">
      Send one prompt to several models at once. Watch them stream in real time, then
      we score, rank, and fuse their answers into a single optimized response.
    </p>
    <div className="mt-6 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
      {EXAMPLE_PROMPTS.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="glass rounded-xl px-3.5 py-2.5 text-xs text-slate-300 transition-colors hover:border-accent/40 hover:bg-white/[0.06] hover:text-white"
        >
          {p}
        </button>
      ))}
    </div>
    <p className="mt-4 text-[11px] text-slate-600">
      Pick an example or type your own · choose models below
    </p>
  </motion.div>
);
