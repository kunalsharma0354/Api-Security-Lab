import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiLabsPage } from "./pages/ApiLabsPage";
import { RequestLogsPage } from "./pages/RequestLogsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ApiDocsPage } from "./pages/ApiDocsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GetApiKeyPage } from "./pages/GetApiKeyPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="labs" element={<ApiLabsPage />} />
          <Route path="get-api-key" element={<GetApiKeyPage />} />
          <Route path="logs" element={<RequestLogsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="docs" element={<ApiDocsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
