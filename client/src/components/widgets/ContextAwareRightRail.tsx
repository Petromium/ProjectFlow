import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, ChevronRight, PanelRightClose, 
  PanelRight, Maximize2, Minimize2 
} from "lucide-react";
import { usePage } from "@/contexts/PageContext";
import { useProject } from "@/contexts/ProjectContext";
import { useIsMobile } from "@/hooks/use-mobile";

import { PortfolioSignals } from "./PortfolioSignals";
import { UpcomingEvents, EventLegend } from "./UpcomingEvents";
import { CadencePlaybook, ReviewsWidget } from "./CadencePlaybook";
import { ResourceSnapshot } from "./ResourceSnapshot";
import { RiskSnapshot } from "./RiskSnapshot";
import { CostSnapshot } from "./CostSnapshot";
import { WBSLinkage } from "./WBSLinkage";
import { AIAssistantGuide } from "./AIAssistantGuide";
import { DocumentStats } from "./DocumentStats";

interface ContextAwareRightRailProps {
  className?: string;
}

export function ContextAwareRightRail({ className }: ContextAwareRightRailProps) {
  const { selectedProjectId } = useProject();
  const {
    currentPage,
    showPortfolioSignals,
    showUpcomingEvents,
    showCadencePlaybook,
    showResourceSnapshot,
    showRiskSnapshot,
    showCostSnapshot,
    showWBSLinkage,
    showAIAssistantGuide,
    showDocumentStats,
  } = usePage();

  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  }, [isMobile]);

  if (!selectedProjectId) {
    return (
      <aside 
        className={`w-80 border-l bg-background p-4 ${className}`}
        data-testid="sidebar-right"
        aria-label="Context sidebar"
      >
        <div className="flex items-center justify-center h-32 text-center">
          <p className="text-sm text-muted-foreground">
            Select a project to view insights
          </p>
        </div>
      </aside>
    );
  }

  if (isCollapsed) {
    return (
      <aside 
        className="w-12 border-l bg-background flex flex-col items-center py-4"
        data-testid="sidebar-right-collapsed"
        aria-label="Context sidebar (collapsed)"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
          aria-label="Expand sidebar"
          data-testid="button-expand-sidebar"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  const railWidth = isExpanded ? "w-96" : "w-80";

  return (
    <motion.aside
      initial={{ width: 320 }}
      animate={{ width: isExpanded ? 384 : 320 }}
      transition={{ duration: 0.2 }}
      className={`border-l bg-background flex flex-col ${className}`}
      data-testid="sidebar-right"
      aria-label="Context sidebar"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {currentPage === "dashboard" ? "Overview" : currentPage.replace("-", " ")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Minimize sidebar" : "Maximize sidebar"}
            data-testid="button-toggle-sidebar-size"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse sidebar"
            data-testid="button-collapse-sidebar"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {showPortfolioSignals && (
              <motion.div
                key="portfolio-signals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <PortfolioSignals />
              </motion.div>
            )}

            {showCostSnapshot && (
              <motion.div
                key="cost-snapshot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                <CostSnapshot />
              </motion.div>
            )}

            {showResourceSnapshot && (
              <motion.div
                key="resource-snapshot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <ResourceSnapshot />
              </motion.div>
            )}

            {showRiskSnapshot && (
              <motion.div
                key="risk-snapshot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.15 }}
              >
                <RiskSnapshot />
              </motion.div>
            )}

            {showWBSLinkage && (
              <motion.div
                key="wbs-linkage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.2 }}
              >
                <WBSLinkage />
              </motion.div>
            )}

            {showUpcomingEvents && (
              <motion.div
                key="upcoming-events"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.25 }}
              >
                <UpcomingEvents />
              </motion.div>
            )}

            {showUpcomingEvents && (
              <motion.div
                key="event-legend"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.3 }}
              >
                <EventLegend />
              </motion.div>
            )}

            {showCadencePlaybook && (
              <motion.div
                key="cadence-playbook"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.35 }}
              >
                <CadencePlaybook />
              </motion.div>
            )}

            {showCadencePlaybook && (
              <motion.div
                key="reviews"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                <ReviewsWidget />
              </motion.div>
            )}

            {showAIAssistantGuide && (
              <motion.div
                key="ai-assistant-guide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AIAssistantGuide />
              </motion.div>
            )}

            {showDocumentStats && (
              <motion.div
                key="document-stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentStats />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </motion.aside>
  );
}
