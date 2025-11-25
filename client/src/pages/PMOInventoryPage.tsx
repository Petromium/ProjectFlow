import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Package, 
  AlertTriangle, 
  Loader2, 
  HardHat,
  Wrench,
  Truck,
  DollarSign,
  Clock
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";
import type { Resource } from "@shared/schema";

type OrgResource = Resource & { projectName: string };

const getResourceTypeIcon = (type: string) => {
  switch (type) {
    case "labor": return HardHat;
    case "equipment": return Wrench;
    case "material": return Package;
    default: return Users;
  }
};

const getResourceTypeColor = (type: string) => {
  switch (type) {
    case "labor": return "bg-blue-500";
    case "equipment": return "bg-purple-500";
    case "material": return "bg-amber-500";
    default: return "bg-gray-400";
  }
};

const getProjectColor = (projectId: number): string => {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", 
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"
  ];
  return colors[projectId % colors.length];
};

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
  className 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
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
      </CardContent>
    </Card>
  );
}

export default function PMOInventoryPage() {
  const { selectedOrgId, selectedOrg, isLoadingOrgs } = useProject();

  const { data: resources = [], isLoading, error } = useQuery<OrgResource[]>({
    queryKey: [`/api/organizations/${selectedOrgId}/pmo/inventory`],
    enabled: !!selectedOrgId,
  });

  const stats = useMemo(() => {
    const laborResources = resources.filter(r => r.type === 'labor');
    const equipmentResources = resources.filter(r => r.type === 'equipment');
    const materialResources = resources.filter(r => r.type === 'material');
    
    const totalCost = resources.reduce((sum, r) => sum + (Number(r.rate) || 0) * (Number(r.quantity) || 1), 0);
    const laborCost = laborResources.reduce((sum, r) => sum + (Number(r.rate) || 0) * (Number(r.quantity) || 1), 0);
    const equipmentCost = equipmentResources.reduce((sum, r) => sum + (Number(r.rate) || 0) * (Number(r.quantity) || 1), 0);
    const materialCost = materialResources.reduce((sum, r) => sum + (Number(r.rate) || 0) * (Number(r.quantity) || 1), 0);

    return {
      total: resources.length,
      labor: laborResources.length,
      equipment: equipmentResources.length,
      material: materialResources.length,
      totalCost,
      laborCost,
      equipmentCost,
      materialCost,
    };
  }, [resources]);

  const projectBreakdown = useMemo(() => {
    const breakdown = new Map<string, { 
      projectId: number;
      labor: number; 
      equipment: number; 
      material: number;
      totalCost: number;
    }>();
    
    resources.forEach(resource => {
      if (!breakdown.has(resource.projectName)) {
        breakdown.set(resource.projectName, { 
          projectId: resource.projectId,
          labor: 0, 
          equipment: 0, 
          material: 0,
          totalCost: 0
        });
      }
      const stats = breakdown.get(resource.projectName)!;
      const cost = (Number(resource.rate) || 0) * (Number(resource.quantity) || 1);
      stats.totalCost += cost;
      
      if (resource.type === 'labor') stats.labor++;
      else if (resource.type === 'equipment') stats.equipment++;
      else if (resource.type === 'material') stats.material++;
    });
    
    return Array.from(breakdown.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }, [resources]);

  if (!selectedOrgId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select an organization to view the inventory.
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
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load inventory data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="page-title-pmo-inventory">Inventory Management</h1>
        <p className="text-muted-foreground">
          Organization-wide resource inventory for {selectedOrg?.name || 'All Projects'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Resources"
          value={stats.total}
          subtitle={`Across ${projectBreakdown.length} projects`}
          icon={Package}
          data-testid="stat-total-resources"
        />
        <StatCard
          title="Labor Resources"
          value={stats.labor}
          subtitle={formatCurrency(stats.laborCost)}
          icon={HardHat}
          data-testid="stat-labor-resources"
        />
        <StatCard
          title="Equipment"
          value={stats.equipment}
          subtitle={formatCurrency(stats.equipmentCost)}
          icon={Wrench}
          data-testid="stat-equipment"
        />
        <StatCard
          title="Materials"
          value={stats.material}
          subtitle={formatCurrency(stats.materialCost)}
          icon={Truck}
          data-testid="stat-materials"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resource Cost Distribution
            </CardTitle>
            <CardDescription>Cost breakdown by resource type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Labor
                </span>
                <span className="font-medium">{formatCurrency(stats.laborCost)}</span>
              </div>
              <Progress 
                value={stats.totalCost > 0 ? (stats.laborCost / stats.totalCost) * 100 : 0} 
                className="h-2 bg-muted" 
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  Equipment
                </span>
                <span className="font-medium">{formatCurrency(stats.equipmentCost)}</span>
              </div>
              <Progress 
                value={stats.totalCost > 0 ? (stats.equipmentCost / stats.totalCost) * 100 : 0} 
                className="h-2 bg-muted" 
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  Materials
                </span>
                <span className="font-medium">{formatCurrency(stats.materialCost)}</span>
              </div>
              <Progress 
                value={stats.totalCost > 0 ? (stats.materialCost / stats.totalCost) * 100 : 0} 
                className="h-2 bg-muted" 
              />
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total Resource Value</span>
                <span>{formatCurrency(stats.totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Resources by Project
            </CardTitle>
            <CardDescription>Resource distribution across projects</CardDescription>
          </CardHeader>
          <CardContent>
            {projectBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No resources found in any project.
              </div>
            ) : (
              <div className="space-y-4">
                {projectBreakdown.map(({ name, projectId, labor, equipment, material, totalCost }) => (
                  <div key={projectId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", getProjectColor(projectId))} />
                        <span className="font-medium truncate max-w-[200px]">{name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {labor > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <HardHat className="h-3 w-3" /> {labor}
                        </Badge>
                      )}
                      {equipment > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Wrench className="h-3 w-3" /> {equipment}
                        </Badge>
                      )}
                      {material > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Truck className="h-3 w-3" /> {material}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Resources
          </CardTitle>
          <CardDescription>Complete resource inventory across organization</CardDescription>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No resources found in this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Resource</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                    <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Project</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Rate</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Quantity</th>
                    <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => {
                    const TypeIcon = getResourceTypeIcon(resource.type);
                    const total = (Number(resource.rate) || 0) * (Number(resource.quantity) || 1);
                    return (
                      <tr 
                        key={resource.id} 
                        className="border-b hover-elevate"
                        data-testid={`resource-row-${resource.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              getResourceTypeColor(resource.type) + "/10"
                            )}>
                              <TypeIcon className={cn(
                                "h-4 w-4",
                                resource.type === 'labor' && "text-blue-500",
                                resource.type === 'equipment' && "text-purple-500",
                                resource.type === 'material' && "text-amber-500",
                              )} />
                            </div>
                            <div>
                              <p className="font-medium">{resource.name}</p>
                              {resource.role && (
                                <p className="text-xs text-muted-foreground">{resource.role}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">
                            {resource.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", getProjectColor(resource.projectId))} />
                            <span className="text-sm truncate max-w-[150px]">{resource.projectName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          {formatCurrency(Number(resource.rate) || 0)}
                          {resource.unit && <span className="text-muted-foreground">/{resource.unit}</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          {resource.quantity || 1}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-medium">
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
