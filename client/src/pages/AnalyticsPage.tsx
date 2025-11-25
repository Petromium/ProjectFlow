import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useProject } from "@/contexts/ProjectContext";
import { 
  AlertTriangle, Loader2, TrendingUp, TrendingDown, Minus,
  CheckCircle2, Clock, AlertCircle, BarChart3, Activity
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import type { Task, Risk, Issue, CostItem } from "@shared/schema";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function AnalyticsPage() {
  const { selectedProjectId } = useProject();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId,
  });

  const { data: risks = [], isLoading: risksLoading } = useQuery<Risk[]>({
    queryKey: [`/api/projects/${selectedProjectId}/risks`],
    enabled: !!selectedProjectId,
  });

  const { data: issues = [], isLoading: issuesLoading } = useQuery<Issue[]>({
    queryKey: [`/api/projects/${selectedProjectId}/issues`],
    enabled: !!selectedProjectId,
  });

  const { data: costs = [], isLoading: costsLoading } = useQuery<CostItem[]>({
    queryKey: [`/api/projects/${selectedProjectId}/costs`],
    enabled: !!selectedProjectId,
  });

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const inProgress = tasks.filter(t => t.status === "in-progress").length;
    const notStarted = tasks.filter(t => t.status === "not-started").length;
    const onHold = tasks.filter(t => t.status === "on-hold").length;
    const review = tasks.filter(t => t.status === "review").length;
    
    const avgProgress = total > 0 
      ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total)
      : 0;

    const byPriority = {
      critical: tasks.filter(t => t.priority === "critical").length,
      high: tasks.filter(t => t.priority === "high").length,
      medium: tasks.filter(t => t.priority === "medium").length,
      low: tasks.filter(t => t.priority === "low").length,
    };

    return { total, completed, inProgress, notStarted, onHold, review, avgProgress, byPriority };
  }, [tasks]);

  const riskStats = useMemo(() => {
    const total = risks.length;
    const open = risks.filter(r => r.status !== "closed").length;
    
    const byImpact = {
      critical: risks.filter(r => r.impact === "critical").length,
      high: risks.filter(r => r.impact === "high").length,
      medium: risks.filter(r => r.impact === "medium").length,
      low: risks.filter(r => r.impact === "low").length,
    };

    return { total, open, byImpact };
  }, [risks]);

  const issueStats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter(i => i.status === "open").length;
    const resolved = issues.filter(i => i.status === "resolved").length;
    
    const byPriority = {
      critical: issues.filter(i => i.priority === "critical").length,
      high: issues.filter(i => i.priority === "high").length,
      medium: issues.filter(i => i.priority === "medium").length,
      low: issues.filter(i => i.priority === "low").length,
    };

    return { total, open, resolved, byPriority };
  }, [issues]);

  const costStats = useMemo(() => {
    const totalBudget = costs.reduce((sum, c) => sum + parseFloat(c.budgeted || "0"), 0);
    const totalActual = costs.reduce((sum, c) => sum + parseFloat(c.actual || "0"), 0);
    const variance = totalBudget - totalActual;
    const variancePercent = totalBudget > 0 ? ((variance / totalBudget) * 100) : 0;

    return { totalBudget, totalActual, variance, variancePercent };
  }, [costs]);

  const statusPieData = [
    { name: "Completed", value: taskStats.completed, color: "#22c55e" },
    { name: "In Progress", value: taskStats.inProgress, color: "#3b82f6" },
    { name: "Not Started", value: taskStats.notStarted, color: "#9ca3af" },
    { name: "On Hold", value: taskStats.onHold, color: "#f59e0b" },
    { name: "Review", value: taskStats.review, color: "#a855f7" },
  ].filter(d => d.value > 0);

  const priorityBarData = [
    { name: "Critical", tasks: taskStats.byPriority.critical, risks: riskStats.byImpact.critical, issues: issueStats.byPriority.critical },
    { name: "High", tasks: taskStats.byPriority.high, risks: riskStats.byImpact.high, issues: issueStats.byPriority.high },
    { name: "Medium", tasks: taskStats.byPriority.medium, risks: riskStats.byImpact.medium, issues: issueStats.byPriority.medium },
    { name: "Low", tasks: taskStats.byPriority.low, risks: riskStats.byImpact.low, issues: issueStats.byPriority.low },
  ];

  const isLoading = tasksLoading || risksLoading || issuesLoading || costsLoading;

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view analytics.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="page-title-analytics">Analytics</h1>
        <p className="text-muted-foreground">Project performance and trends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{taskStats.avgProgress}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
            <Progress value={taskStats.avgProgress} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">
                  {taskStats.completed}/{taskStats.total}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Risks</p>
                <p className="text-2xl font-bold">{riskStats.open}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              {riskStats.byImpact.critical > 0 && (
                <Badge variant="destructive" className="text-xs">{riskStats.byImpact.critical} Critical</Badge>
              )}
              {riskStats.byImpact.high > 0 && (
                <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">{riskStats.byImpact.high} High</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Variance</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  {costStats.variancePercent >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  {Math.abs(costStats.variancePercent).toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              ${costStats.variance.toLocaleString()} {costStats.variance >= 0 ? "under" : "over"} budget
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No tasks to display
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Priority Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBarData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="tasks" name="Tasks" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="risks" name="Risks" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="issues" name="Issues" fill="hsl(var(--chart-3))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Task Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Not Started</span>
              <Badge variant="secondary">{taskStats.notStarted}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">In Progress</span>
              <Badge>{taskStats.inProgress}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">In Review</span>
              <Badge variant="outline">{taskStats.review}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Completed</span>
              <Badge className="bg-green-500">{taskStats.completed}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">On Hold</span>
              <Badge variant="destructive">{taskStats.onHold}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Total Risks</span>
              <Badge variant="secondary">{riskStats.total}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Open Risks</span>
              <Badge variant="destructive">{riskStats.open}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Critical Impact</span>
              <Badge variant="destructive">{riskStats.byImpact.critical}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">High Impact</span>
              <Badge className="bg-orange-500">{riskStats.byImpact.high}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Medium Impact</span>
              <Badge className="bg-amber-500">{riskStats.byImpact.medium}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Issue Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Total Issues</span>
              <Badge variant="secondary">{issueStats.total}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Open Issues</span>
              <Badge variant="destructive">{issueStats.open}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Resolved</span>
              <Badge className="bg-green-500">{issueStats.resolved}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">Critical Priority</span>
              <Badge variant="destructive">{issueStats.byPriority.critical}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-sm">High Priority</span>
              <Badge className="bg-orange-500">{issueStats.byPriority.high}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
