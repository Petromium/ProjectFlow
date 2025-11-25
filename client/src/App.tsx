import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { RightSidebar } from "@/components/RightSidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import WBSPage from "@/pages/WBSPage";
import GanttPage from "@/pages/GanttPage";
import KanbanPage from "@/pages/KanbanPage";
import CalendarPage from "@/pages/CalendarPage";
import StakeholdersPage from "@/pages/StakeholdersPage";
import RisksPage from "@/pages/RisksPage";
import IssuesPage from "@/pages/IssuesPage";
import CostPage from "@/pages/CostPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import ReportsPage from "@/pages/ReportsPage";
import EmailTemplatesPage from "@/pages/EmailTemplatesPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/wbs" component={WBSPage} />
      <Route path="/gantt" component={GanttPage} />
      <Route path="/kanban" component={KanbanPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/stakeholders" component={StakeholdersPage} />
      <Route path="/resources">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Resources</h1>
          <p className="text-muted-foreground">Resource management coming soon</p>
        </div>
      </Route>
      <Route path="/risks" component={RisksPage} />
      <Route path="/issues" component={IssuesPage} />
      <Route path="/change-requests">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Change Requests</h1>
          <p className="text-muted-foreground">Change request management coming soon</p>
        </div>
      </Route>
      <Route path="/cost" component={CostPage} />
      <Route path="/sop">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Standard Operating Procedures</h1>
          <p className="text-muted-foreground">SOP documentation coming soon</p>
        </div>
      </Route>
      <Route path="/analytics">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground">Advanced analytics coming soon</p>
        </div>
      </Route>
      <Route path="/reports" component={ReportsPage} />
      <Route path="/email-templates" component={EmailTemplatesPage} />
      <Route path="/ai-assistant" component={AIAssistantPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/pmo/dashboard">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">PMO Dashboard</h1>
          <p className="text-muted-foreground">PMO-level dashboard coming soon</p>
        </div>
      </Route>
      <Route path="/pmo/calendar">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">PMO Calendar</h1>
          <p className="text-muted-foreground">Multi-project calendar coming soon</p>
        </div>
      </Route>
      <Route path="/pmo/inventory">
        <div className="p-6">
          <h1 className="text-3xl font-semibold">Inventory Management</h1>
          <p className="text-muted-foreground">Inventory tracking coming soon</p>
        </div>
      </Route>
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
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <div className="flex flex-1 overflow-hidden">
              <main className="flex-1 overflow-y-auto bg-background">
                <Router />
              </main>
              <RightSidebar />
            </div>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
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

  return isAuthenticated ? <AuthenticatedApp /> : <LandingPage />;
}

export default function App() {
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
