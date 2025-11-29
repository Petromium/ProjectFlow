import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { MetricCard } from "@/components/MetricCard";
import { ProjectModal } from "@/components/ProjectModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, AlertTriangle, Clock, DollarSign, FolderKanban, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SCurveChart, PerformanceGauges, DisciplineProgress, RiskExposureSummary } from "@/components/epc";
import type { Task, Risk, Issue, CostItem, Project } from "@shared/schema";

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  completionRate: number;
  openRisks: number;
  openIssues: number;
  totalBudget: number;
  actualCost: number;
  budgetUsed: number;
}

function calculateDashboardStats(
  tasks: Task[],
  risks: Risk[],
  issues: Issue[],
  costItems: CostItem[]
): DashboardStats {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const openRisks = risks.filter(r => r.status !== 'closed').length;
  const openIssues = issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
  
  const totalBudget = costItems.reduce((sum, c) => sum + Number(c.budgeted || 0), 0);
  const actualCost = costItems.reduce((sum, c) => sum + Number(c.actual || 0), 0);
  const budgetUsed = totalBudget > 0 ? Math.round((actualCost / totalBudget) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    completionRate,
    openRisks,
    openIssues,
    totalBudget,
    actualCost,
    budgetUsed
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Extracts the level-1 WBS code number from a WBS code string.
 * Examples: "1.2.3" → "1", "2.0" → "2", "1" → "1"
 */
function extractLevel1WbsCode(wbsCode: string): string {
  const parts = wbsCode.split('.');
  return parts[0];
}

/**
 * Filters tasks to get top-level tasks (tasks where parentId is null or wbsCode is level-1).
 * Returns tasks sorted by wbsCode (numeric sort).
 */
function getTopLevelTasks(tasks: Task[]): Task[] {
  return tasks
    .filter(task => {
      // Top-level task: either has no parent OR wbsCode is level-1 (single number or "X.0")
      if (task.parentId === null) return true;
      
    const parts = task.wbsCode.split('.');
      // Level-1 pattern: single number or "X.0"
      return parts.length === 1 || (parts.length === 2 && parts[1] === '0');
    })
    .sort((a, b) => {
      // Numeric sort on level-1 WBS code
      const aLevel1 = extractLevel1WbsCode(a.wbsCode);
      const bLevel1 = extractLevel1WbsCode(b.wbsCode);
      return aLevel1.localeCompare(bLevel1, undefined, { numeric: true });
    });
}

function safeDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

function formatTimeAgo(dateValue: string | Date | null | undefined): string {
  const date = safeDate(dateValue);
  if (!date) return 'Recently';
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function Dashboard() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-project") {
      setProjectModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useQuery<Task[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    }
  });


  const { data: risks = [], isLoading: risksLoading } = useQuery<Risk[]>({
    queryKey: ['/api/projects', projectId, 'risks'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/risks`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch risks');
      return res.json();
    }
  });

  const { data: issues = [], isLoading: issuesLoading } = useQuery<Issue[]>({
    queryKey: ['/api/projects', projectId, 'issues'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/issues`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch issues');
      return res.json();
    }
  });

  const { data: costItems = [], isLoading: costsLoading } = useQuery<CostItem[]>({
    queryKey: ['/api/projects', projectId, 'costs'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/costs`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    }
  });

  const isLoading = tasksLoading || risksLoading || issuesLoading || costsLoading;
  
  const topLevelTasks = getTopLevelTasks(tasks);

  if (!selectedProject) {
    return (
      <div className="p-6">
        <Alert>
          <FolderKanban className="h-4 w-4" />
          <AlertDescription>
            Please select a project to view the dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const stats = calculateDashboardStats(tasks, risks, issues, costItems);
  
  const recentItems: Array<{ id: string; type: 'risk' | 'issue'; title: string; date: Date | null }> = [
    ...risks.map(r => ({
      id: `risk-${r.id}`,
      type: 'risk' as const,
      title: r.title,
      date: safeDate(r.createdAt)
    })),
    ...issues.map(i => ({
      id: `issue-${i.id}`,
      type: 'issue' as const,
      title: i.title,
      date: safeDate(i.createdAt)
    }))
  ].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  }).slice(0, 5);

  const criticalTasks = tasks
    .filter(t => t.status !== 'completed' && (t.priority === 'critical' || t.priority === 'high'))
    .slice(0, 4);

  const projectStartDate = selectedProject?.startDate ? new Date(selectedProject.startDate) : new Date();
  const projectEndDate = selectedProject?.endDate ? new Date(selectedProject.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-semibold mb-1 md:mb-2" data-testid="text-dashboard-title">Project Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground" data-testid="text-project-name">
            {selectedProject.name} - {selectedProject.code}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 md:h-32" />
          <Skeleton className="h-24 md:h-32" />
          <Skeleton className="h-24 md:h-32" />
          <Skeleton className="h-24 md:h-32" />
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Tasks"
            value={stats.totalTasks.toString()}
            change={stats.totalTasks > 0 ? Math.round((stats.inProgressTasks / stats.totalTasks) * 100) : 0}
            icon={BarChart3}
            data-testid="metric-total-tasks"
          />
          <MetricCard
            title="Completion Rate"
            value={`${stats.completionRate}%`}
            change={stats.completionRate > 50 ? 10 : -5}
            icon={TrendingUp}
            data-testid="metric-completion-rate"
          />
          <MetricCard
            title="Budget Used"
            value={formatCurrency(stats.actualCost)}
            change={stats.budgetUsed > 80 ? 5 : -3}
            icon={DollarSign}
            data-testid="metric-budget-used"
          />
          <MetricCard
            title="Open Risks"
            value={stats.openRisks.toString()}
            change={stats.openRisks > 5 ? 10 : -15}
            icon={AlertTriangle}
            data-testid="metric-open-risks"
          />
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="eva" data-testid="tab-eva">
            <Activity className="h-4 w-4 mr-2" />
            S-Curve & EVA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work Breakdown Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : topLevelTasks.length > 0 ? (
              topLevelTasks.map((task) => {
                const level1Code = extractLevel1WbsCode(task.wbsCode);
                return (
                  <div key={task.id}>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {task.name}
                        </span>
                        <Badge variant="outline" className="font-mono">{level1Code}</Badge>
                      </div>
                      <span className="text-sm font-semibold">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No top-level tasks found. Add tasks to see progress.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : recentItems.length > 0 ? (
              recentItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  {item.type === 'risk' ? (
                    <AlertTriangle className="h-5 w-5 text-chart-2 mt-0.5" />
                  ) : (
                    <Clock className="h-5 w-5 text-chart-1 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.type === 'risk' ? 'Risk: ' : 'Issue: '}{item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(item.date)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity to display.
              </p>
            )}
          </CardContent>
        </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Critical & High Priority Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : criticalTasks.length > 0 ? (
                <div className="space-y-3">
                  {criticalTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-4 flex-wrap" data-testid={`critical-task-${task.id}`}>
                      <Badge variant="outline" className="font-mono">{task.wbsCode}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium truncate">{task.name}</span>
                          <Badge 
                            variant={task.priority === 'critical' ? 'destructive' : 'secondary'}
                          >
                            {task.status === 'not-started' ? 'Not Started' : 
                             task.status === 'in-progress' ? 'In Progress' : 
                             task.status}
                          </Badge>
                        </div>
                        <Progress value={task.progress} className="h-1.5" />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{task.progress}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No critical or high priority tasks pending.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eva" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[400px]" />
            </div>
          ) : (
            <>
              <SCurveChart 
                tasks={tasks} 
                projectStartDate={projectStartDate}
                projectEndDate={projectEndDate}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <PerformanceGauges tasks={tasks} costItems={costItems} />
                <DisciplineProgress tasks={tasks} />
              </div>

              <RiskExposureSummary risks={risks} totalBudget={stats.totalBudget} />
            </>
          )}
        </TabsContent>
      </Tabs>

      <ProjectModal open={projectModalOpen} onOpenChange={setProjectModalOpen} />
    </div>
  );
}
