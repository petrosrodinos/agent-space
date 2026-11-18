import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes as RouterRoutes } from "react-router-dom";
import { Routes } from "@/routes/routes";
import { RedirectIfAuthed, RequireAuth, SplashSkeleton } from "@/components/layout/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import AppShell from "@/components/layout/app-shell";

const SignInPage = lazy(() => import("@/pages/auth/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/auth/pages/sign-up"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/pages/reset-password"));
const InvitePage = lazy(() => import("@/pages/invite"));
const ChatHomePage = lazy(() => import("@/pages/chat"));
const ConversationPage = lazy(() => import("@/pages/chat/pages/conversation"));
const BotsPage = lazy(() => import("@/pages/bots"));
const NewBotPage = lazy(() => import("@/pages/bots/pages/new-bot"));
const BotDetailPage = lazy(() => import("@/pages/bots/pages/bot-detail"));
const SkillsPage = lazy(() => import("@/pages/skills"));
const SkillDetailPage = lazy(() => import("@/pages/skills/pages/skill-detail"));
const ConnectionsPage = lazy(() => import("@/pages/connections"));
const ConnectionCallbackPage = lazy(() => import("@/pages/connections/pages/callback"));
const ToolServerCallbackPage = lazy(() => import("@/pages/connections/pages/mcp-callback"));
const SecretsPage = lazy(() => import("@/pages/secrets"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const TaskDetailPage = lazy(() => import("@/pages/tasks/pages/task-detail"));
const ArtifactsPage = lazy(() => import("@/pages/artifacts"));
const ArtifactDetailPage = lazy(() => import("@/pages/artifacts/pages/artifact-detail"));
const AutomationsPage = lazy(() => import("@/pages/automations"));
const AutomationDetailPage = lazy(() => import("@/pages/automations/pages/automation-detail"));
const ApprovalsPage = lazy(() => import("@/pages/approvals"));
const ApprovalDetailPage = lazy(() => import("@/pages/approvals/pages/approval-detail"));
const SettingsPage = lazy(() => import("@/pages/settings"));

const PageFallback = () => (
  <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 py-8 sm:px-8">
    <Skeleton className="h-9 w-56" />
    <Skeleton className="h-4 w-80" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-[20px]" />
      ))}
    </div>
  </div>
);

const page = (el: ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;
const authPage = (el: ReactNode) => (
  <RedirectIfAuthed>
    <Suspense fallback={<SplashSkeleton />}>{el}</Suspense>
  </RedirectIfAuthed>
);

export default function AppRoutes() {
  return (
    <RouterRoutes>
      <Route path={Routes.auth.sign_in} element={authPage(<SignInPage />)} />
      <Route path={Routes.auth.sign_up} element={authPage(<SignUpPage />)} />
      <Route path={Routes.auth.forgot_password} element={authPage(<ForgotPasswordPage />)} />
      <Route path={Routes.auth.reset_password} element={<Suspense fallback={<SplashSkeleton />}><ResetPasswordPage /></Suspense>} />
      <Route path={Routes.invite_pattern} element={<Suspense fallback={<SplashSkeleton />}><InvitePage /></Suspense>} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={Routes.chat.root} replace />} />
        <Route path={Routes.chat.root} element={page(<ChatHomePage />)} />
        <Route path={Routes.chat.pattern} element={page(<ConversationPage />)} />
        <Route path={Routes.bots.root} element={page(<BotsPage />)} />
        <Route path={Routes.bots.new} element={page(<NewBotPage />)} />
        <Route path={Routes.bots.pattern} element={page(<BotDetailPage />)} />
        <Route path={Routes.skills.root} element={page(<SkillsPage />)} />
        <Route path={Routes.skills.pattern} element={page(<SkillDetailPage />)} />
        <Route path={Routes.connections.root} element={page(<ConnectionsPage />)} />
        <Route path={Routes.connections.callback} element={page(<ConnectionCallbackPage />)} />
        <Route path={Routes.connections.mcp_callback} element={page(<ToolServerCallbackPage />)} />
        <Route path={Routes.connections.legacy_callback} element={page(<ConnectionCallbackPage />)} />
        <Route path={Routes.secrets} element={page(<SecretsPage />)} />
        <Route path={Routes.tasks.root} element={page(<TasksPage />)} />
        <Route path={Routes.tasks.pattern} element={page(<TaskDetailPage />)} />
        <Route path={Routes.artifacts.root} element={page(<ArtifactsPage />)} />
        <Route path={Routes.artifacts.pattern} element={page(<ArtifactDetailPage />)} />
        <Route path={Routes.automations.root} element={page(<AutomationsPage />)} />
        <Route path={Routes.automations.pattern} element={page(<AutomationDetailPage />)} />
        <Route path={Routes.approvals.root} element={page(<ApprovalsPage />)} />
        <Route path={Routes.approvals.pattern} element={page(<ApprovalDetailPage />)} />
        <Route path={`${Routes.settings.root}/:section?`} element={page(<SettingsPage />)} />
      </Route>

      <Route path="*" element={<Navigate to={Routes.home} replace />} />
    </RouterRoutes>
  );
}
