import { Switch, Route } from "wouter";
import { useEffect, useRef, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ContextAwareRightRail } from "@/components/widgets/ContextAwareRightRail";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
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
import ChatPage from "@/pages/ChatPage";
import ContactsPage from "@/pages/ContactsPage";
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
      <Route path="/chat" component={ChatPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/pmo/dashboard" component={PMODashboardPage} />
      <Route path="/pmo/contacts" component={ContactsPage} />
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

  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [rightSize, setRightSize] = useState(30);
  const [previousRightSize, setPreviousRightSize] = useState(30);
  const COLLAPSED_SIZE = 2;

  const handleCollapseRight = () => {
    setPreviousRightSize(rightSize);
    setIsRightCollapsed(true);
    // Shrink the right panel to a compact size (~1/3 of the previous 10% collapsed width)
    rightPanelRef.current?.resize(COLLAPSED_SIZE);
  };

  const handleExpandRight = () => {
    setIsRightCollapsed(false);
    // Restore to the previous size (or a sensible default)
    rightPanelRef.current?.resize(previousRightSize || 30);
  };

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
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="flex flex-1 overflow-hidden"
                  >
                    <ResizablePanel defaultSize={70} minSize={55}>
                      <main className="flex-1 h-full overflow-y-auto bg-background">
                        <Router />
                      </main>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="hidden lg:flex" />
                    <ResizablePanel
                      ref={rightPanelRef}
                      defaultSize={30}
                      minSize={COLLAPSED_SIZE}
                      maxSize={40}
                      className="hidden lg:flex"
                      onResize={(size) => setRightSize(size)}
                    >
                      <ContextAwareRightRail
                        className="h-full"
                        isCollapsed={isRightCollapsed}
                        onCollapse={handleCollapseRight}
                        onExpand={handleExpandRight}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
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
