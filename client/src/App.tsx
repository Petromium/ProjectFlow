import { Switch, Route, Redirect } from "wouter";
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
import { AIContextProvider } from "@/contexts/AIContextContext";
import { useAuth } from "@/hooks/useAuth";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommandPalette } from "@/components/CommandPalette";
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
import ProjectsPage from "@/pages/ProjectsPage";
import ChatPage from "@/pages/ChatPage";
import ContactsPage from "@/pages/ContactsPage";
import ChangeRequestsPage from "@/pages/ChangeRequestsPage";
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
      <Route path="/change-requests" component={ChangeRequestsPage} />
      <Route path="/cost" component={CostPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/email-templates" component={() => {
        window.location.href = "/settings?tab=email-templates";
        return null;
      }} />
      <Route path="/ai-assistant" component={AIAssistantPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/users" component={() => {
        window.location.href = "/settings?tab=users";
        return null;
      }} />
      <Route path="/pmo/dashboard" component={PMODashboardPage} />
      <Route path="/pmo/projects" component={ProjectsPage} />
      <Route path="/pmo/contacts" component={ContactsPage} />
      <Route path="/pmo/calendar" component={PMOCalendarPage} />
      <Route path="/pmo/inventory" component={PMOInventoryPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/login" component={() => <Redirect to="/" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  // Global keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  
  // localStorage key for persisting sidebar width
  const SIDEBAR_WIDTH_KEY = "rightSidebarWidth";
  const COLLAPSED_SIZE = 2;
  
  // Optimal default width: 320px (typical widget width + padding) converted to percentage
  // Calculate dynamically based on viewport, with fallback to 25% (320px on 1280px screen)
  const calculateOptimalDefault = (): number => {
    if (typeof window === "undefined") return 25;
    const viewportWidth = window.innerWidth;
    const optimalPixels = 320; // Optimal widget width
    const percentage = (optimalPixels / viewportWidth) * 100;
    // Clamp between 20% and 35% for reasonable bounds
    return Math.max(20, Math.min(35, percentage));
  };

  // Read saved width from localStorage on mount
  const getSavedWidth = (): number | null => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      // Validate saved value is reasonable (between min and max allowed)
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 40) {
        return parsed;
      }
    }
    return null;
  };

  // Calculate initial default size (used for both state and ResizablePanel defaultSize)
  const initialDefaultSize = (() => {
    const saved = getSavedWidth();
    return saved || calculateOptimalDefault();
  })();

  // Initialize state with saved width or optimal default
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [rightSize, setRightSize] = useState(initialDefaultSize);
  const [previousRightSize, setPreviousRightSize] = useState(initialDefaultSize);

  // Save width to localStorage when it changes (but not when collapsed)
  useEffect(() => {
    if (!isRightCollapsed && rightSize > COLLAPSED_SIZE) {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, rightSize.toString());
    }
  }, [rightSize, isRightCollapsed]);

  const handleCollapseRight = () => {
    setPreviousRightSize(rightSize);
    setIsRightCollapsed(true);
    // Shrink the right panel to a compact size
    rightPanelRef.current?.resize(COLLAPSED_SIZE);
  };

  const handleExpandRight = () => {
    setIsRightCollapsed(false);
    // Restore to saved width, or previous size, or optimal default
    const savedWidth = getSavedWidth();
    const targetSize = savedWidth || previousRightSize || calculateOptimalDefault();
    // Use setTimeout to ensure panel is ready for resize
    setTimeout(() => {
      rightPanelRef.current?.resize(targetSize);
    }, 10);
  };

  return (
    <ProjectProvider>
      <PageProvider>
        <AIContextProvider>
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
                      defaultSize={initialDefaultSize}
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
        </AIContextProvider>
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
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
