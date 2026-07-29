import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Library, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import { useUiStore } from "@/stores/ui.store";
import { UserMenu } from "@/features/auth/UserMenu";

/** Collapsible-ready conversation list with new/delete actions. */
export const ConversationSidebar = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { conversationId, setConversation, newChat } = useChatStore();
  const openKnowledge = useUiStore((s) => s.setKnowledgeOpen);
  const useKnowledgeBase = useChatStore((s) => s.useKnowledgeBase);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId === id) newChat();
    },
  });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-bg-soft/50 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent-soft">
          <MessageSquare size={16} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Multi-AI</div>
          <div className="text-[10px] text-slate-500">Decision Engine</div>
        </div>
      </div>

      <div className="space-y-1.5 px-3">
        <Button onClick={newChat} variant="outline" className="w-full justify-start">
          <Plus size={15} /> New chat
        </Button>
        <Button
          onClick={() => openKnowledge(true)}
          variant="ghost"
          className="w-full justify-start"
        >
          <Library size={15} className={cn(useKnowledgeBase && "text-accent-soft")} />
          Knowledge Base
          {useKnowledgeBase && (
            <span className="ml-auto rounded-full bg-accent/20 px-1.5 text-[10px] text-accent-soft">
              on
            </span>
          )}
        </Button>
        <Button
          onClick={() => navigate("/analytics")}
          variant="ghost"
          className="w-full justify-start"
        >
          <BarChart3 size={15} /> Analytics
        </Button>
      </div>

      <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}

        {conversations?.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-slate-500">No conversations yet</p>
        )}

        {conversations?.map((c) => (
          <div
            key={c._id}
            className={cn(
              "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
              conversationId === c._id
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            <button
              onClick={() => setConversation(c._id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="truncate">{c.title}</span>
            </button>
            <button
              onClick={() => del.mutate(c._id)}
              className="shrink-0 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <UserMenu />
    </aside>
  );
};
