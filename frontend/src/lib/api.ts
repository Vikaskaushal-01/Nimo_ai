import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  Conversation,
  DecisionResult,
  ModelInfo,
  StoredMessage,
} from "@/types/engine";
import type { AuthResult, User } from "@/types/auth";
import type { KbDocument, SearchHit } from "@/types/knowledge";
import type { AnalyticsOverview } from "@/types/analytics";
import { useAuthStore } from "@/stores/auth.store";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const http = axios.create({ baseURL, timeout: 120_000 });

// ── Attach the access token to every request ────────────────────────────────
http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Transparent refresh-on-401 with single-flight de-duplication ─────────────
let refreshing: Promise<string | null> | null = null;

/** Refreshes the access token once, de-duplicating concurrent callers. */
export const refreshAccessToken = (): Promise<string | null> => {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

const doRefresh = async (): Promise<string | null> => {
  const { refreshToken, setAuth, clear } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<{ data: AuthResult }>(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    setAuth(data.data);
    return data.data.accessToken;
  } catch {
    clear();
    return null;
  }
};

export const apiBaseUrl = baseURL;

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const isAuthCall = original?.url?.includes("/auth/");

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Unwraps the backend's { success, data } envelope and normalizes errors. */
const unwrap = <T>(promise: Promise<{ data: { data: T } }>): Promise<T> =>
  promise.then((res) => res.data.data).catch((err: unknown) => {
    if (err instanceof AxiosError) {
      const message =
        (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message ??
        err.message;
      throw new Error(message);
    }
    throw err;
  });

export interface DecisionPayload {
  prompt: string;
  models: string[];
  conversationId?: string;
}

export const api = {
  // --- Auth ---
  register: (email: string, password: string, name: string): Promise<AuthResult> =>
    unwrap(http.post("/auth/register", { email, password, name })),

  login: (email: string, password: string): Promise<AuthResult> =>
    unwrap(http.post("/auth/login", { email, password })),

  logout: (refreshToken: string): Promise<{ loggedOut: boolean }> =>
    unwrap(http.post("/auth/logout", { refreshToken })),

  me: (): Promise<User> => unwrap(http.get("/auth/me")),

  // --- Engine ---
  listModels: (): Promise<ModelInfo[]> => unwrap(http.get("/models")),

  createDecision: (payload: DecisionPayload): Promise<DecisionResult> =>
    unwrap(http.post("/decision", payload)),

  // --- Chat ---
  listConversations: (): Promise<Conversation[]> => unwrap(http.get("/conversations")),

  createConversation: (title?: string): Promise<Conversation> =>
    unwrap(http.post("/conversations", title ? { title } : {})),

  renameConversation: (id: string, title: string): Promise<Conversation> =>
    unwrap(http.patch(`/conversations/${id}`, { title })),

  deleteConversation: (id: string): Promise<{ deleted: boolean }> =>
    unwrap(http.delete(`/conversations/${id}`)),

  listMessages: (conversationId: string): Promise<StoredMessage[]> =>
    unwrap(http.get(`/conversations/${conversationId}/messages`)),

  // --- Knowledge base ---
  listDocuments: (): Promise<KbDocument[]> => unwrap(http.get("/knowledge/documents")),

  uploadDocument: (file: File, onProgress?: (pct: number) => void): Promise<KbDocument> => {
    const form = new FormData();
    form.append("file", file);
    return unwrap(
      http.post("/knowledge/documents", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      }),
    );
  },

  deleteDocument: (id: string): Promise<{ deleted: boolean }> =>
    unwrap(http.delete(`/knowledge/documents/${id}`)),

  searchKnowledge: (query: string, documentIds?: string[]): Promise<SearchHit[]> =>
    unwrap(http.post("/knowledge/search", { query, documentIds })),

  // --- Analytics ---
  getAnalytics: (days = 30): Promise<AnalyticsOverview> =>
    unwrap(http.get("/analytics/overview", { params: { days } })),
};
