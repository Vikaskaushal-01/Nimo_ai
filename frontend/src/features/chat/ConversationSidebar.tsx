import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  Library,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import { toast } from "@/stores/toast.store";
import { useUiStore } from "@/stores/ui.store";
import { UserMenu } from "@/features/auth/UserMenu";
import type { Conversation } from "@/types/engine";

/** Conversation list with search, rename and delete. Slides in on mobile. */
export const ConversationSidebar = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { conversationId, setConversation, newChat } = useChatStore();
  const useKnowledgeBase = useChatStore((s) => s.useKnowledgeBase);
  const openKnowledge = useUiStore((s) => s.setKnowledgeOpen);
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const [query, setQuery] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_d, id) => {
      qc.setQueryData<Conversation[]>(["conversations"], (old) => old?.filter((c) => c._id !== id));
      qc.removeQueries({ queryKey: ["messages", id] });
      if (conversationId === id) newChat();
      toast("Chat deleted");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { title?: string; pinned?: boolean } }) =>
      api.updateConversation(id, changes),
    onSuccess: (_d, { id, changes }) => {
      qc.setQueryData<Conversation[]>(["conversations"], (old) =>
        old?.map((c) => (c._id === id ? { ...c, ...changes } : c)),
      );
      if (changes.pinned !== undefined) toast(changes.pinned ? "Chat pinned" : "Chat unpinned");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Close the mobile drawer after any navigation action.
  const go = (fn: () => void) => {
    fn();
    setSidebarOpen(false);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? conversations?.filter((c) => c.title.toLowerCase().includes(q))
    : conversations;
  const groups = useMemo(() => groupByDate(filtered ?? []), [filtered]);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-white/10 bg-bg-soft/95 backdrop-blur-xl transition-transform duration-200",
          "md:static md:z-auto md:w-64 md:translate-x-0 md:bg-bg-soft/50",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent-soft">
            <MessageSquare size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Multi-AI</div>
            <div className="text-[10px] text-slate-500">Decision Engine</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5 px-3">
          <Button onClick={() => go(newChat)} variant="outline" className="w-full justify-start">
            <Plus size={15} /> New chat
          </Button>
          <Button
            onClick={() => go(() => openKnowledge(true))}
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
            onClick={() => go(() => navigate("/analytics"))}
            variant="ghost"
            className="w-full justify-start"
          >
            <BarChart3 size={15} /> Analytics
          </Button>
        </div>

        {(conversations?.length ?? 0) > 0 && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 focus-within:border-accent/50">
            <Search size={13} className="shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}

          {conversations?.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-slate-500">No conversations yet</p>
          )}
          {q && filtered?.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-slate-500">No chats match “{query}”</p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="pb-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {group.label}
              </div>
              {group.items.map((c) => (
                <ConversationRow
                  key={c._id}
                  conversation={c}
                  active={conversationId === c._id}
                  onOpen={() => go(() => setConversation(c._id))}
                  onRename={(title) => update.mutate({ id: c._id, changes: { title } })}
                  onTogglePin={() => update.mutate({ id: c._id, changes: { pinned: !c.pinned } })}
                  onDelete={() => del.mutate(c._id)}
                />
              ))}
            </div>
          ))}
        </div>

        <UserMenu />
      </aside>
    </>
  );
};

/** Buckets conversations as Pinned / Today / Yesterday / Previous 7 days / Older. */
const groupByDate = (items: Conversation[]): { label: string; items: Conversation[] }[] => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const order = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"];
  const buckets = new Map<string, Conversation[]>(order.map((l) => [l, []]));

  for (const c of items) {
    const t = new Date(c.updatedAt).getTime();
    const label = c.pinned
      ? "Pinned"
      : t >= startOfToday.getTime()
        ? "Today"
        : t >= startOfToday.getTime() - day
          ? "Yesterday"
          : t >= startOfToday.getTime() - 7 * day
            ? "Previous 7 days"
            : "Older";
    buckets.get(label)!.push(c);
  }
  return order.map((label) => ({ label, items: buckets.get(label)! })).filter((g) => g.items.length);
};

interface RowProps {
  conversation: Conversation;
  active: boolean;
  onOpen: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const ConversationRow = ({
  conversation,
  active,
  onOpen,
  onRename,
  onTogglePin,
  onDelete,
}: RowProps) => {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [draft, setDraft] = useState(conversation.title);

  const save = () => {
    const title = draft.trim();
    if (title && title !== conversation.title) onRename(title.slice(0, 200));
    setMode("view");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") {
      setDraft(conversation.title);
      setMode("view");
    }
  };

  const iconBtn = "shrink-0 rounded p-0.5 transition-colors";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      )}
    >
      {mode === "edit" ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={save}
            maxLength={200}
            className="min-w-0 flex-1 rounded bg-black/30 px-1.5 py-0.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent/60"
          />
          <button onMouseDown={(e) => e.preventDefault()} onClick={save} className={cn(iconBtn, "hover:text-emerald-400")} aria-label="Save name">
            <Check size={13} />
          </button>
        </>
      ) : mode === "confirm" ? (
        <>
          <span className="min-w-0 flex-1 truncate text-xs text-red-300">Delete this chat?</span>
          <button onClick={onDelete} className={cn(iconBtn, "text-red-400 hover:text-red-300")} aria-label="Confirm delete">
            <Check size={14} />
          </button>
          <button onClick={() => setMode("view")} className={cn(iconBtn, "hover:text-white")} aria-label="Cancel delete">
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onOpen}
            onDoubleClick={() => setMode("edit")}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title={conversation.title}
          >
            <MessageSquare size={13} className="shrink-0 opacity-60" />
            <span className="truncate">{conversation.title}</span>
          </button>
          {/* Always visible on touch screens; revealed on hover with a mouse. */}
          <div className="flex shrink-0 items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
            <button
              onClick={onTogglePin}
              className={cn(iconBtn, "hover:text-white")}
              aria-label={conversation.pinned ? "Unpin conversation" : "Pin conversation"}
              title={conversation.pinned ? "Unpin" : "Pin"}
            >
              {conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
            <button
              onClick={() => {
                setDraft(conversation.title);
                setMode("edit");
              }}
              className={cn(iconBtn, "hover:text-white")}
              aria-label="Rename conversation"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => setMode("confirm")}
              className={cn(iconBtn, "hover:text-red-400")}
              aria-label="Delete conversation"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
