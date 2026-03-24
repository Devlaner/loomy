import { Suspense, lazy } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout";

const LandingPage = lazy(() =>
  import("@/pages/Landing").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.RegisterPage })),
);
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth").then((m) => ({ default: m.AuthCallbackPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const RecentPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.RecentPage })),
);
const StarredPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({ default: m.StarredPage })),
);
const WorkspaceSettingsPage = lazy(() =>
  import("@/pages/dashboard").then((m) => ({
    default: m.WorkspaceSettingsPage,
  })),
);
const BoardPage = lazy(() =>
  import("@/pages/board").then((m) => ({ default: m.BoardPage })),
);

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/login",
    element: (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/register",
    element: (
      <Suspense fallback={null}>
        <RegisterPage />
      </Suspense>
    ),
  },
  {
    path: "/auth/callback",
    element: (
      <Suspense fallback={null}>
        <AuthCallbackPage />
      </Suspense>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={null}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: "recent",
        element: (
          <Suspense fallback={null}>
            <RecentPage />
          </Suspense>
        ),
      },
      {
        path: "starred",
        element: (
          <Suspense fallback={null}>
            <StarredPage />
          </Suspense>
        ),
      },
      {
        path: "workspace-settings",
        element: (
          <Suspense fallback={null}>
            <WorkspaceSettingsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "/boards/:boardId",
    element: (
      <ProtectedRoute>
        <Suspense fallback={null}>
          <BoardPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
