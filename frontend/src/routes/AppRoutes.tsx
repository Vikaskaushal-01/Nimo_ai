import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/features/auth/AuthPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { ChatPage } from "@/features/chat/ChatPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";

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
          <AnalyticsPage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
