import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ContextAwareRightRail } from "@/components/widgets/ContextAwareRightRail";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { PageProvider } from "@/contexts/PageContext";
import { AIPromptProvider } from "@/contexts/AIPromptContext";
import { useAuth } from "@/hooks/useAuth";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import WBSPage from "@/pages/WBSPage";
import GanttPage from "@/pages/GanttPage";
import KanbanPage from "@/pages/KanbanPage";
import CalendarPage from "@/pages/CalendarPage";
import StakeholdersPage from "@/pages/StakeholdersPage";
import RACIMatrixPage from "@/pages/RACIMatrixPage";
import RisksPage from "@/pages/RisksPage";
import IssuesPage from "@/pages/IssuesPage";
import CostPage from "@/pages/CostPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import ReportsPage from "@/pages/ReportsPage";
import EmailTemplatesPage from "@/pages/EmailTemplatesPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminDashboard from "@/pages/AdminDashboard";
import ResourcesPage from "@/pages/ResourcesPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import DocumentsPage from "@/pages/DocumentsPage";
import PMODashboardPage from "@/pages/PMODashboardPage";
import PMOCalendarPage from "@/pages/PMOCalendarPage";
import PMOInventoryPage from "@/pages/PMOInventoryPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/not-found";

function Router() {
  // Track page views when routes change
  useAnalytics();

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/wbs" component={WBSPage} />
      <Route path="/gantt" component={GanttPage} />
      <Route path="/kanban" component={KanbanPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/stakeholders" component={StakeholdersPage} />
      <Route path="/raci-matrix" component={RACIMatrixPage} />
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/risks" component={RisksPage} />
      <Route path="/issues" component={IssuesPage} />
      <Route path="/change-requests">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Change Requests</h1>
          <p className="text-muted-foreground">Change request management coming soon</p>
        </div>
      </Route>
      <Route path="/cost" component={CostPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/email-templates" component={EmailTemplatesPage} />
      <Route path="/ai-assistant" component={AIAssistantPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/pmo/dashboard" component={PMODashboardPage} />
      <Route path="/pmo/calendar" component={PMOCalendarPage} />
      <Route path="/pmo/inventory" component={PMOInventoryPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <ProjectProvider>
      <PageProvider>
        <AIPromptProvider>
          <SidebarProvider style={sidebarStyle} defaultOpen={false}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <TopBar />
                <div className="flex flex-1 overflow-hidden">
                  <main className="flex-1 overflow-y-auto bg-background">
                    <Router />
                  </main>
                  <div className="hidden lg:block">
                    <ContextAwareRightRail />
                  </div>
                </div>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </AIPromptProvider>
      </PageProvider>
    </ProjectProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

export default function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing Google Analytics Measurement ID: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
