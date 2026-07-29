import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail, Sparkles, User as UserIcon } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { AuthResult } from "@/types/auth";

type Mode = "login" | "register";

export const AuthPage = () => {
  const { setAuth, isAuthenticated } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const auth = useMutation({
    mutationFn: (): Promise<AuthResult> =>
      mode === "login"
        ? api.login(email, password)
        : api.register(email, password, name),
    onSuccess: (result) => setAuth(result),
    onError: (err: Error) => setError(err.message),
  });

  if (isAuthenticated()) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    auth.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 shadow-glow">
            <Sparkles size={26} className="text-accent-soft" />
          </div>
          <h1 className="text-xl font-bold text-white">Multi-AI Decision Engine</h1>
          <p className="mt-1 text-xs text-slate-500">Multiple AI Models. One Intelligent Decision.</p>
        </div>

        <form onSubmit={submit} className="glass-strong space-y-3 rounded-2xl p-5 shadow-panel">
          <div className="mb-1 flex rounded-xl bg-white/5 p-1 text-xs">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-1.5 font-medium capitalize transition-colors ${
                  mode === m ? "bg-accent text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <Field icon={<UserIcon size={15} />}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </Field>
          )}

          <Field icon={<Mail size={15} />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </Field>

          <Field icon={<Lock size={15} />}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Password (min 8 chars)" : "Password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" disabled={auth.isPending} className="w-full">
            {auth.isPending && <Loader2 size={15} className="animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>

          {mode === "register" && (
            <p className="text-center text-[11px] text-slate-500">
              The first account created becomes an admin.
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
};

const Field = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 focus-within:border-accent/50">
    <span className="text-slate-500">{icon}</span>
    {children}
  </div>
);
