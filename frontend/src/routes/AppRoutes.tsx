import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/features/auth/AuthPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ChatPage } from "@/features/chat/ChatPage";

// Loaded on first visit so the chart-heavy dashboard stays out of the main bundle.
const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);

/** Route table. New top-level pages (dashboard, admin, settings) slot in here. */
export const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthPage />} />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/analytics"
      element={
        <ProtectedRoute>
          <Suspense fallback={<div className="min-h-screen" />}>
            <AnalyticsPage />
          </Suspense>
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
