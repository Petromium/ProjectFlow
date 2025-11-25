import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, DollarSign, FolderKanban, Activity, Loader2, Building2, Users, FileWarning, CircleDot } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface PMODashboardData {
  projectCount: number;
  projects: Array<{ id: number; name: string; status: string }>;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    onHold: number;
  };
  riskStats: {
    total: number;
    open: number;
    mitigated: number;
    closed: number;
    highRisks: number;
  };
  issueStats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    critical: number;
  };
  budgetStats: {
    totalBudget: number;
    actualCost: number;
    variance: number;
    utilizationPercent: number;
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

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  className 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            "flex items-center text-xs mt-1",
            trend.positive ? "text-green-500" : "text-red-500"
          )}>
            <TrendingUp className={cn("h-3 w-3 mr-1", !trend.positive && "rotate-180")} />
            {trend.value}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; label: string }> = {
    'planning': { color: 'bg-blue-500', label: 'Planning' },
    'active': { color: 'bg-green-500', label: 'Active' },
    'on-hold': { color: 'bg-amber-500', label: 'On Hold' },
    'completed': { color: 'bg-gray-500', label: 'Completed' },
    'cancelled': { color: 'bg-red-500', label: 'Cancelled' },
  };
  const variant = variants[status] || { color: 'bg-gray-400', label: status };
  
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", variant.color)} />
      {variant.label}
    </Badge>
  );
}

export default function PMODashboardPage() {
  const { selectedOrgId, selectedOrg, isLoadingOrgs } = useProject();

  const { data, isLoading, error } = useQuery<PMODashboardData>({
    queryKey: [`/api/organizations/${selectedOrgId}/pmo/dashboard`],
    enabled: !!selectedOrgId,
  });

  if (!selectedOrgId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select an organization to view the PMO dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || isLoadingOrgs) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load PMO dashboard data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const completionRate = data?.taskStats.total ? 
    Math.round((data.taskStats.completed / data.taskStats.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="page-title-pmo-dashboard">PMO Dashboard</h1>
        <p className="text-muted-foreground">
          Organization-wide project portfolio overview for {selectedOrg?.name || 'All Projects'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={data?.projectCount || 0}
          subtitle={`${data?.projects.filter(p => p.status === 'active').length || 0} active`}
          icon={FolderKanban}
          data-testid="stat-total-projects"
        />
        <StatCard
          title="Total Tasks"
          value={data?.taskStats.total || 0}
          subtitle={`${completionRate}% completion rate`}
          icon={Activity}
          data-testid="stat-total-tasks"
        />
        <StatCard
          title="Open Risks"
          value={data?.riskStats.open || 0}
          subtitle={`${data?.riskStats.highRisks || 0} high priority`}
          icon={AlertTriangle}
          data-testid="stat-open-risks"
        />
        <StatCard
          title="Open Issues"
          value={data?.issueStats.open || 0}
          subtitle={`${data?.issueStats.critical || 0} critical`}
          icon={FileWarning}
          data-testid="stat-open-issues"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Task Status Overview
            </CardTitle>
            <CardDescription>Aggregated task status across all projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  Completed
                </span>
                <span className="font-medium">{data?.taskStats.completed || 0}</span>
              </div>
              <Progress value={data?.taskStats.total ? (data.taskStats.completed / data.taskStats.total) * 100 : 0} className="h-2 bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  In Progress
                </span>
                <span className="font-medium">{data?.taskStats.inProgress || 0}</span>
              </div>
              <Progress value={data?.taskStats.total ? (data.taskStats.inProgress / data.taskStats.total) * 100 : 0} className="h-2 bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-400" />
                  Not Started
                </span>
                <span className="font-medium">{data?.taskStats.notStarted || 0}</span>
              </div>
              <Progress value={data?.taskStats.total ? (data.taskStats.notStarted / data.taskStats.total) * 100 : 0} className="h-2 bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  On Hold
                </span>
                <span className="font-medium">{data?.taskStats.onHold || 0}</span>
              </div>
              <Progress value={data?.taskStats.total ? (data.taskStats.onHold / data.taskStats.total) * 100 : 0} className="h-2 bg-muted" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget Overview
            </CardTitle>
            <CardDescription>Organization-wide budget utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.budgetStats.totalBudget || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.budgetStats.actualCost || 0)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Budget Utilization</span>
                <span className="font-medium">{data?.budgetStats.utilizationPercent || 0}%</span>
              </div>
              <Progress 
                value={data?.budgetStats.utilizationPercent || 0} 
                className={cn(
                  "h-3",
                  (data?.budgetStats.utilizationPercent || 0) > 90 ? "bg-red-100" : "bg-muted"
                )}
              />
            </div>
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              (data?.budgetStats.variance || 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10"
            )}>
              <span className="text-sm font-medium">Variance</span>
              <span className={cn(
                "font-bold",
                (data?.budgetStats.variance || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {(data?.budgetStats.variance || 0) >= 0 ? '+' : ''}{formatCurrency(data?.budgetStats.variance || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Risk Summary
            </CardTitle>
            <CardDescription>Risk distribution across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-600">{data?.riskStats.open || 0}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10">
                <p className="text-3xl font-bold text-blue-600">{data?.riskStats.mitigated || 0}</p>
                <p className="text-sm text-muted-foreground">Mitigated</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-3xl font-bold text-green-600">{data?.riskStats.closed || 0}</p>
                <p className="text-sm text-muted-foreground">Closed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <p className="text-3xl font-bold text-red-600">{data?.riskStats.highRisks || 0}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5" />
              Issue Summary
            </CardTitle>
            <CardDescription>Issue distribution across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-600">{data?.issueStats.open || 0}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10">
                <p className="text-3xl font-bold text-blue-600">{data?.issueStats.inProgress || 0}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-3xl font-bold text-green-600">{data?.issueStats.resolved || 0}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <p className="text-3xl font-bold text-red-600">{data?.issueStats.critical || 0}</p>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Project Portfolio
          </CardTitle>
          <CardDescription>All projects in this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No projects found in this organization.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`project-card-${project.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{project.name}</p>
                    </div>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
