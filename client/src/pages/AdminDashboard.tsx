import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MetricCard } from "@/components/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  FolderKanban, 
  CreditCard, 
  TrendingUp, 
  HardDrive,
  Mail,
  Brain,
  Shield,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface PlatformStats {
  organizations: number;
  users: number;
  projects: number;
  tasks: number;
  activeSubscriptions: {
    free: number;
    pro: number;
    enterprise: number;
  };
  storageUsed: number;
  aiTokensUsed: number;
  emailsSent: number;
}

interface OrganizationSummary {
  id: number;
  name: string;
  tier: string;
  userCount: number;
  projectCount: number;
  storageUsedMB: number;
  storageLimitMB: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getTierColor(tier: string): "default" | "secondary" | "outline" {
  switch (tier) {
    case 'enterprise': return 'default';
    case 'pro': return 'secondary';
    default: return 'outline';
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<PlatformStats>({
    queryKey: ['/api/admin/stats'],
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (res.status === 401) throw new Error('Unauthorized');
      if (res.status === 403) throw new Error('Admin access required');
      if (!res.ok) throw new Error('Failed to fetch platform stats');
      return res.json();
    }
  });

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<OrganizationSummary[]>({
    queryKey: ['/api/admin/organizations'],
    retry: 1,
    queryFn: async () => {
      const res = await fetch('/api/admin/organizations', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) return [];
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    }
  });

  if (statsError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            {(statsError as Error).message === 'Admin access required' 
              ? 'You do not have admin access to view this dashboard.'
              : 'Unable to load admin dashboard. Please try again later.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalSubscriptions = stats 
    ? (stats.activeSubscriptions.free + stats.activeSubscriptions.pro + stats.activeSubscriptions.enterprise)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide analytics and management</p>
        </div>
        <Badge variant="default" className="uppercase tracking-wide">
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Organizations"
            value={formatNumber(stats.organizations)}
            icon={Building2}
            data-testid="metric-organizations"
          />
          <MetricCard
            title="Total Users"
            value={formatNumber(stats.users)}
            icon={Users}
            data-testid="metric-users"
          />
          <MetricCard
            title="Active Projects"
            value={formatNumber(stats.projects)}
            icon={FolderKanban}
            data-testid="metric-projects"
          />
          <MetricCard
            title="Total Tasks"
            value={formatNumber(stats.tasks)}
            icon={TrendingUp}
            data-testid="metric-tasks"
          />
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
          <TabsTrigger value="organizations" data-testid="tab-organizations">Organizations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Distribution</CardTitle>
                <CardDescription>Active subscriptions by tier</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {statsLoading ? (
                  <Skeleton className="h-32" />
                ) : stats ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enterprise</span>
                        <span className="font-mono text-sm">{stats.activeSubscriptions.enterprise}</span>
                      </div>
                      <Progress 
                        value={totalSubscriptions > 0 ? (stats.activeSubscriptions.enterprise / totalSubscriptions) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Pro</span>
                        <span className="font-mono text-sm">{stats.activeSubscriptions.pro}</span>
                      </div>
                      <Progress 
                        value={totalSubscriptions > 0 ? (stats.activeSubscriptions.pro / totalSubscriptions) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Free</span>
                        <span className="font-mono text-sm">{stats.activeSubscriptions.free}</span>
                      </div>
                      <Progress 
                        value={totalSubscriptions > 0 ? (stats.activeSubscriptions.free / totalSubscriptions) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Health</CardTitle>
                <CardDescription>System status and resource usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Storage Used</span>
                  </div>
                  <span className="font-mono text-sm">{formatBytes(stats?.storageUsed || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">AI Tokens Used</span>
                  </div>
                  <span className="font-mono text-sm">{formatNumber(stats?.aiTokensUsed || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Emails Sent</span>
                  </div>
                  <span className="font-mono text-sm">{formatNumber(stats?.emailsSent || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Free Tier</CardTitle>
                  <Badge variant="outline">Basic</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeSubscriptions.free || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Organizations</p>
                <div className="mt-4 text-xs space-y-1 text-muted-foreground">
                  <p>5 projects, 100 tasks/project</p>
                  <p>100K AI tokens, 1GB storage</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Pro Tier</CardTitle>
                  <Badge variant="secondary">Popular</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeSubscriptions.pro || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Organizations</p>
                <div className="mt-4 text-xs space-y-1 text-muted-foreground">
                  <p>50 projects, 1K tasks/project</p>
                  <p>1M AI tokens, 10GB storage</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Enterprise</CardTitle>
                  <Badge>Premium</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeSubscriptions.enterprise || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Organizations</p>
                <div className="mt-4 text-xs space-y-1 text-muted-foreground">
                  <p>100 projects, 10K tasks/project</p>
                  <p>10M AI tokens, 100GB storage</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage Summary</CardTitle>
              <CardDescription>Platform-wide resource consumption</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Storage</h3>
                    </div>
                    <div className="text-2xl font-bold font-mono">{formatBytes(stats?.storageUsed || 0)}</div>
                    <p className="text-sm text-muted-foreground">Total storage consumed across all organizations</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">AI Tokens</h3>
                    </div>
                    <div className="text-2xl font-bold font-mono">{formatNumber(stats?.aiTokensUsed || 0)}</div>
                    <p className="text-sm text-muted-foreground">Total AI tokens used for assistant queries</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Emails</h3>
                    </div>
                    <div className="text-2xl font-bold font-mono">{formatNumber(stats?.emailsSent || 0)}</div>
                    <p className="text-sm text-muted-foreground">Total emails sent via notification system</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>All registered organizations on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {orgsLoading ? (
                <Skeleton className="h-48" />
              ) : organizations.length > 0 ? (
                <div className="space-y-2">
                  {organizations.map((org) => {
                    const storagePercent = org.storageLimitMB > 0 
                      ? (org.storageUsedMB / org.storageLimitMB) * 100 
                      : 0;
                    return (
                      <div
                        key={org.id}
                        className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover-elevate"
                        data-testid={`org-row-${org.id}`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{org.name}</span>
                              <Badge variant={getTierColor(org.tier)} className="capitalize">
                                {org.tier}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {org.userCount} users, {org.projectCount} projects
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-mono">
                            {org.storageUsedMB.toFixed(1)}MB / {org.storageLimitMB}MB
                          </div>
                          <Progress value={Math.min(storagePercent, 100)} className="h-1 w-24 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No organizations found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
