import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import type { DecisionResult } from "@/types/engine";
import { KnowledgeDrawer } from "@/features/knowledge/KnowledgeDrawer";
import { ConversationSidebar } from "./ConversationSidebar";
import { MessageItem, type MessageData } from "./MessageItem";
import { PromptInput } from "./PromptInput";
import { StreamingDecision } from "./StreamingDecision";
import { useDecisionStream } from "./useDecisionStream";

export const ChatPage = () => {
  const qc = useQueryClient();
  const { conversationId, selectedModels, setConversation, useKnowledgeBase, selectedDocumentIds } =
    useChatStore();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.listMessages(conversationId as string),
    enabled: !!conversationId,
  });

  const onDone = useCallback(
    (result: DecisionResult) => {
      if (!conversationId) setConversation(result.conversationId);
      qc.invalidateQueries({ queryKey: ["messages", result.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    [conversationId, qc, setConversation],
  );

  const onError = useCallback((message: string) => setError(message), []);

  const { state, start } = useDecisionStream(onDone, onError);

  const onSubmit = (prompt: string) => {
    setError(null);
    start({
      prompt,
      models: selectedModels,
      conversationId: conversationId ?? undefined,
      useKnowledgeBase: useKnowledgeBase || selectedDocumentIds.length > 0,
      documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
    });
  };

  // Auto-scroll to the newest content (also while streaming).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, state.models, state.stage]);

  const isEmpty = messages.length === 0 && !state.active;

  return (
    <div className="flex h-screen overflow-hidden">
      <KnowledgeDrawer />
      <ConversationSidebar />

      <main className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6">
            {isEmpty ? (
              <EmptyState />
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

        <div className="border-t border-white/10 bg-bg/60 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-4xl px-4 py-3">
            {error && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <TriangleAlert size={13} /> {error}
              </div>
            )}
            <PromptInput onSubmit={onSubmit} isPending={state.active} />
          </div>
        </div>
      </main>
    </div>
  );
};

const EmptyState = () => (
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
    <div className="mt-6 grid gap-2 text-left text-xs text-slate-500 sm:grid-cols-3">
      {[
        "Live parallel streaming",
        "Weighted quality evaluation",
        "Fused optimized answer",
      ].map((t) => (
        <div key={t} className="glass rounded-xl px-3 py-2">
          {t}
        </div>
      ))}
    </div>
  </motion.div>
);
