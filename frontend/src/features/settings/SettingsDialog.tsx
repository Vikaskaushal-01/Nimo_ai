import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Loader2, Lock, Trash2, User as UserIcon, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import { toast } from "@/stores/toast.store";
import { useUiStore } from "@/stores/ui.store";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/50 focus:outline-none";

/** Account settings: profile, password, data. Opened from the user menu. */
export const SettingsDialog = () => {
  const { settingsOpen, setSettingsOpen } = useUiStore();
  const close = () => setSettingsOpen(false);

  // Esc closes the dialog.
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="glass-strong max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl shadow-panel"
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Settings</h2>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close settings">
                <X size={16} />
              </Button>
            </header>
            <div className="space-y-6 px-5 py-5">
              <ProfileSection />
              <PasswordSection />
              <ShortcutsSection />
              <DataSection onDone={close} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Section = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {icon} {title}
    </h3>
    {children}
  </section>
);

const ProfileSection = () => {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");

  const save = useMutation({
    mutationFn: () => api.updateProfile(name.trim()),
    onSuccess: (u) => {
      setUser(u);
      toast("Name updated");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== user?.name) save.mutate();
  };

  return (
    <Section icon={<UserIcon size={13} />} title="Profile">
      <form onSubmit={submit} className="space-y-2">
        <div className="text-[11px] text-slate-500">{user?.email}</div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Your name"
            aria-label="Name"
            className={inputCls}
          />
          <Button
            type="submit"
            size="sm"
            className="h-auto"
            disabled={save.isPending || !name.trim() || name.trim() === user?.name}
          >
            {save.isPending && <Loader2 size={13} className="animate-spin" />} Save
          </Button>
        </div>
      </form>
    </Section>
  );
};

const PasswordSection = () => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: (result) => {
      // The server revoked every other session and issued this one fresh tokens.
      setAuth(result);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password changed — other devices were signed out");
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    change.mutate();
  };

  return (
    <Section icon={<Lock size={13} />} title="Password">
      <form onSubmit={submit} className="space-y-2">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (min 8 chars)"
          autoComplete="new-password"
          required
          className={inputCls}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
          className={inputCls}
        />
        {error && <p className="text-[11px] text-red-300">{error}</p>}
        <Button type="submit" size="sm" disabled={change.isPending}>
          {change.isPending && <Loader2 size={13} className="animate-spin" />} Change password
        </Button>
      </form>
    </Section>
  );
};

const SHORTCUTS: [string, string][] = [
  ["Enter", "Send prompt"],
  ["Shift + Enter", "New line"],
  ["Esc", "Stop generating"],
  ["Ctrl + Shift + O", "New chat"],
];

const ShortcutsSection = () => (
  <Section icon={<Keyboard size={13} />} title="Keyboard shortcuts">
    <ul className="space-y-1.5 text-xs">
      {SHORTCUTS.map(([keys, action]) => (
        <li key={keys} className="flex items-center justify-between">
          <span className="text-slate-400">{action}</span>
          <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            {keys}
          </kbd>
        </li>
      ))}
    </ul>
  </Section>
);

const DataSection = ({ onDone }: { onDone: () => void }) => {
  const qc = useQueryClient();
  const newChat = useChatStore((s) => s.newChat);
  const [confirming, setConfirming] = useState(false);

  const wipe = useMutation({
    mutationFn: api.deleteAllConversations,
    onSuccess: ({ deleted }) => {
      newChat();
      qc.removeQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast(deleted === 1 ? "Deleted 1 chat" : `Deleted ${deleted} chats`);
      setConfirming(false);
      onDone();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <Section icon={<Trash2 size={13} />} title="Data">
      {confirming ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-200">
            Permanently delete all your chats? This can&apos;t be undone.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              className="bg-red-500 shadow-none hover:bg-red-400"
              disabled={wipe.isPending}
              onClick={() => wipe.mutate()}
            >
              {wipe.isPending && <Loader2 size={13} className="animate-spin" />} Delete everything
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
          <Trash2 size={13} /> Delete all chats
        </Button>
      )}
    </Section>
  );
};
