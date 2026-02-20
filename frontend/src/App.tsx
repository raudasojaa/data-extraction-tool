import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ArticleWorkspacePage } from "./pages/ArticleWorkspacePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectWorkspacePage } from "./pages/ProjectWorkspacePage";
import { TrainingPage } from "./pages/TrainingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useAuthStore } from "./store/authStore";

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/articles/:articleId" element={<ArticleWorkspacePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route
          path="/projects/:projectId"
          element={<ProjectWorkspacePage />}
        />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
