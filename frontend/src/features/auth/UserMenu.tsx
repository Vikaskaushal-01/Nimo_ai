import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/auth.store";

/** Shows the signed-in user with a logout action. */
export const UserMenu = () => {
  const qc = useQueryClient();
  const { user, refreshToken, clear } = useAuthStore();
  if (!user) return null;

  const logout = async () => {
    if (refreshToken) await api.logout(refreshToken).catch(() => undefined);
    clear();
    qc.clear();
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5 border-t border-white/10 px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/25 text-xs font-semibold text-accent-soft">
        {initials || "U"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-white">{user.name}</span>
          {user.role === "admin" && (
            <Badge className="bg-accent/15 text-accent-soft">
              <ShieldCheck size={10} /> admin
            </Badge>
          )}
        </div>
        <div className="truncate text-[10px] text-slate-500">{user.email}</div>
      </div>
      <button
        onClick={logout}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-red-300"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
};
