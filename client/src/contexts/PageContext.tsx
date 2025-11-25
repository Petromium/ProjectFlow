import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";

export type PageModule = 
  | "dashboard"
  | "wbs"
  | "gantt"
  | "kanban"
  | "calendar"
  | "stakeholders"
  | "resources"
  | "risks"
  | "issues"
  | "change-requests"
  | "cost"
  | "analytics"
  | "sop"
  | "reports"
  | "email-templates"
  | "ai-assistant"
  | "settings"
  | "admin"
  | "pmo";

export interface PageContextType {
  currentPage: PageModule;
  pageTitle: string;
  isScheduleRelated: boolean;
  isCostRelated: boolean;
  isRiskRelated: boolean;
  isResourceRelated: boolean;
  isDocumentRelated: boolean;
  showPortfolioSignals: boolean;
  showUpcomingEvents: boolean;
  showCadencePlaybook: boolean;
  showResourceSnapshot: boolean;
  showRiskSnapshot: boolean;
  showCostSnapshot: boolean;
  showWBSLinkage: boolean;
  showAIAssistantGuide: boolean;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

const PAGE_CONFIG: Record<PageModule, { 
  title: string; 
  schedule?: boolean; 
  cost?: boolean; 
  risk?: boolean; 
  resource?: boolean;
  document?: boolean;
}> = {
  "dashboard": { title: "Dashboard", schedule: true, cost: true, risk: true, resource: true },
  "wbs": { title: "Work Breakdown Structure", schedule: true },
  "gantt": { title: "Gantt Chart", schedule: true },
  "kanban": { title: "Kanban Board", schedule: true },
  "calendar": { title: "Calendar", schedule: true },
  "stakeholders": { title: "Stakeholders" },
  "resources": { title: "Resources", resource: true },
  "risks": { title: "Risk Register", risk: true },
  "issues": { title: "Issue Log", risk: true },
  "change-requests": { title: "Change Requests" },
  "cost": { title: "Cost Management", cost: true },
  "analytics": { title: "Analytics", cost: true, schedule: true },
  "sop": { title: "Documents", document: true },
  "reports": { title: "Reports" },
  "email-templates": { title: "Email Templates" },
  "ai-assistant": { title: "AI Assistant" },
  "settings": { title: "Settings" },
  "admin": { title: "Admin Dashboard" },
  "pmo": { title: "PMO" },
};

function getPageModuleFromPath(path: string): PageModule {
  const segment = path.split("/")[1] || "dashboard";
  
  if (segment === "" || segment === "/") return "dashboard";
  if (segment.startsWith("pmo")) return "pmo";
  
  const validPages: PageModule[] = [
    "dashboard", "wbs", "gantt", "kanban", "calendar", "stakeholders",
    "resources", "risks", "issues", "change-requests", "cost", "analytics",
    "sop", "reports", "email-templates", "ai-assistant", "settings", "admin"
  ];
  
  return validPages.includes(segment as PageModule) ? (segment as PageModule) : "dashboard";
}

export function PageProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [currentPage, setCurrentPage] = useState<PageModule>("dashboard");

  useEffect(() => {
    const page = getPageModuleFromPath(location);
    setCurrentPage(page);
  }, [location]);

  const config = PAGE_CONFIG[currentPage] || PAGE_CONFIG.dashboard;

  const value: PageContextType = {
    currentPage,
    pageTitle: config.title,
    isScheduleRelated: !!config.schedule,
    isCostRelated: !!config.cost,
    isRiskRelated: !!config.risk,
    isResourceRelated: !!config.resource,
    isDocumentRelated: !!config.document,
    showPortfolioSignals: currentPage === "dashboard" || currentPage === "analytics",
    showUpcomingEvents: ["dashboard", "calendar", "gantt", "wbs"].includes(currentPage),
    showCadencePlaybook: ["dashboard", "reports"].includes(currentPage),
    showResourceSnapshot: ["dashboard", "resources", "wbs", "gantt"].includes(currentPage),
    showRiskSnapshot: ["dashboard", "risks", "issues"].includes(currentPage),
    showCostSnapshot: ["dashboard", "cost", "analytics"].includes(currentPage),
    showWBSLinkage: ["wbs", "gantt", "kanban", "risks", "issues", "stakeholders"].includes(currentPage),
    showAIAssistantGuide: currentPage === "ai-assistant",
  };

  return (
    <PageContext.Provider value={value}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error("usePage must be used within a PageProvider");
  }
  return context;
}
