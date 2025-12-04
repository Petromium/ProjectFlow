import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Plus, AlertTriangle, Loader2, User, Wrench, Package, 
  DollarSign, Percent, MoreHorizontal, Pencil, Trash2, Eye,
  BarChart3, List, Users
} from "lucide-react";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { useSelection } from "@/contexts/SelectionContext";
import { registerBulkActionHandler } from "@/components/BottomSelectionToolbar";
import React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResourceDetailsModal } from "@/components/modals/ResourceDetailsModal";
import { EditResourceModal } from "@/components/modals/EditResourceModal";
import { ResourceUtilizationChart } from "@/components/ResourceUtilizationChart";
import { ResourceMaterialsTab } from "@/components/ResourceMaterialsTab";
import { ResourceGroupModal } from "@/components/ResourceGroupModal";
import { ResourceEfficiencyMetrics } from "@/components/ResourceEfficiencyMetrics";
import type { Resource, ResourceGroup } from "@shared/schema";

const RESOURCE_TYPES = [
  { value: "human", label: "Human Resource", icon: User },
  { value: "equipment", label: "Equipment", icon: Wrench },
  { value: "material", label: "Material", icon: Package },
];

const DISCIPLINES = [
  { value: "general", label: "General" },
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "piping", label: "Piping" },
  { value: "electrical", label: "Electrical" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "hse", label: "HSE" },
];


export default function ResourcesPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const { selectedResources, setSelectedResources } = useSelection();
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ResourceGroup | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: [`/api/projects/${selectedProjectId}/resources`],
    enabled: !!selectedProjectId,
  });

  // Calculate Efficiency Stats
  const efficiencyStats = useMemo(() => {
    // In a real app, we'd fetch this from backend. Simulating based on resources + random factors for demo or available fields
    // Assuming we don't have task history in `resources` list directly, we'd need a separate query.
    // For now, I'll use placeholder logic or minimal available data to populate the UI component.
    
    // Let's pretend we have this data. 
    // TODO: Connect to real aggregation endpoint
    return {
        cpi: 1.12,
        efficiency: 105,
        totalBudgetedHours: 1200,
        totalActualHours: 1140,
        costVariance: 5000
    };
  }, [resources]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/resources`] });
      toast({
        title: "Success",
        description: "Resource deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete resource",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setSelectedResource(null);
    setEditModalOpen(true);
  };

  const handleOpenEdit = (resource: Resource) => {
    setSelectedResource(resource);
    setEditModalOpen(true);
  };

  const handleOpenDetails = (resource: Resource) => {
    setSelectedResource(resource);
    setDetailsModalOpen(true);
  };

  const handleDelete = (resource: Resource) => {
    if (confirm(`Are you sure you want to delete "${resource.name}"?`)) {
      deleteMutation.mutate(resource.id);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = RESOURCE_TYPES.find(t => t.value === type);
    if (!typeConfig) return User;
    return typeConfig.icon;
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = RESOURCE_TYPES.find(t => t.value === type);
    return typeConfig?.label || type;
  };

  const getDisciplineLabel = (discipline: string | null | undefined) => {
    if (!discipline) return "General";
    const disciplineConfig = DISCIPLINES.find(d => d.value === discipline);
    return disciplineConfig?.label || discipline;
  };

  const totalResources = resources.length;
  const avgAvailability = resources.length > 0 
    ? Math.round(resources.reduce((sum, r) => sum + r.availability, 0) / resources.length)
    : 0;

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/resources/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/resources`] });
      setBulkDeleteDialogOpen(false);
      setSelectedResources([]);
      toast({ title: "Success", description: `${selectedResources.length} resource(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete resources", variant: "destructive" });
    },
  });

  const handleBulkAction = useCallback((action: string, items: Resource[]) => {
    if (action === "add-to-group") {
      setSelectedGroup(null);
      setGroupModalOpen(true);
    } else if (action === "delete") {
      setBulkDeleteDialogOpen(true);
    }
  }, [setSelectedGroup, setGroupModalOpen, setBulkDeleteDialogOpen]);

  // Register bulk action handler for bottom toolbar
  React.useEffect(() => {
    return registerBulkActionHandler("resources", handleBulkAction);
  }, [handleBulkAction]);

  // Define columns
  const columns = useMemo<ColumnDef<Resource>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => {
          const resource = row.original;
          const TypeIcon = getTypeIcon(resource.type);
          return (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <TypeIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{resource.name}</span>
                  {resource.pricingModels && Array.isArray(resource.pricingModels) && resource.pricingModels.length > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Tiered Pricing
                    </Badge>
                  )}
                </div>
                {resource.vendorName && (
                  <div className="text-xs text-muted-foreground">Vendor: {resource.vendorName}</div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <SortableHeader column={column}>Type</SortableHeader>
        ),
        cell: ({ row }) => {
          const resource = row.original;
          const TypeIcon = getTypeIcon(resource.type);
          return (
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="capitalize">
                {getTypeLabel(resource.type)}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "discipline",
        header: ({ column }) => (
          <SortableHeader column={column}>Discipline</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {getDisciplineLabel(row.original.discipline)}
          </Badge>
        ),
      },
      {
        accessorKey: "availability",
        header: ({ column }) => (
          <SortableHeader column={column}>Availability</SortableHeader>
        ),
        cell: ({ row }) => {
          const availability = row.original.availability;
          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={availability} className="w-16 h-2" />
              <span className="text-sm font-mono w-12 text-right">{availability}%</span>
            </div>
          );
        },
      },
      {
        id: "rate",
        header: "Rate/Cost",
        cell: ({ row }) => {
          const resource = row.original;
          if (!resource.rate && !resource.costPerHour) {
            return <span className="text-muted-foreground">-</span>;
          }
          const rate = parseFloat(resource.rate || resource.costPerHour || "0");
          return (
            <div className="text-right">
              <div className="font-mono text-sm flex items-center justify-end gap-1">
                <DollarSign className="h-3 w-3" />
                {rate.toFixed(2)}
                {resource.rateType === "per-hour" && "/hr"}
                {resource.rateType === "per-use" && "/use"}
                {resource.rateType === "per-unit" && `/${resource.unitType || "unit"}`}
                {!resource.rateType && "/hr"}
              </div>
              <div className="text-xs text-muted-foreground">{resource.currency}</div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const resource = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenDetails(resource)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenEdit(resource)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => handleDelete(resource)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    []
  );

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view resources.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-resources">Resources</h1>
          <p className="text-muted-foreground">Manage project resources and assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedGroup(null);
              setGroupModalOpen(true);
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Groups
          </Button>
          <Button onClick={handleOpenCreate} data-testid="button-add-resource">
            <Plus className="h-4 w-4 mr-2" />
            Add Resource
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-resources-list">
            <List className="h-4 w-4 mr-2" />
            List View
          </TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-resources-materials">
            <Package className="h-4 w-4 mr-2" />
            Materials
          </TabsTrigger>
          <TabsTrigger value="utilization" data-testid="tab-resources-utilization">
            <BarChart3 className="h-4 w-4 mr-2" />
            Utilization & Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          {/* Efficiency Metrics - New Feature */}
          <ResourceEfficiencyMetrics stats={efficiencyStats} />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalResources}</p>
                    <p className="text-sm text-muted-foreground">Total Resources</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {resources.filter(r => r.type === "human").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Human Resources</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {resources.filter(r => r.type === "equipment").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Equipment</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Percent className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgAvailability}%</p>
                    <p className="text-sm text-muted-foreground">Avg Availability</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resources Table */}
          {resources.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Resources Yet</h2>
                <p className="text-muted-foreground mb-4">
                  Add resources like team members, equipment, or materials to manage your project.
                </p>
                <Button onClick={handleOpenCreate} data-testid="button-add-first-resource">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Resource
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <DataTable
                columns={columns}
                data={resources}
                searchKey="name"
                searchPlaceholder="Search resources by name, type, or discipline..."
                enableSelection={true}
                enableColumnVisibility={true}
                enableExport={true}
                enableSorting={true}
                enableFiltering={true}
                enablePagination={false}
                maxHeight="calc(100vh - 500px)"
                onSelectionChange={setSelectedResources}
                emptyMessage={resources.length === 0 ? "No resources yet. Add your first resource!" : "No resources found."}
                getRowId={(row) => row.id.toString()}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="materials">
          <ResourceMaterialsTab projectId={selectedProjectId || 0} />
        </TabsContent>

        <TabsContent value="utilization">
          <ResourceUtilizationChart />
        </TabsContent>
      </Tabs>

      <ResourceDetailsModal
        resource={selectedResource}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />

      <EditResourceModal
        resource={selectedResource}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />

      <ResourceGroupModal
        projectId={selectedProjectId || 0}
        group={selectedGroup || undefined}
        open={groupModalOpen}
        onOpenChange={(open) => {
          setGroupModalOpen(open);
          if (!open) {
            setSelectedGroup(null);
            setSelectedResources([]);
          }
        }}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Resources</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedResources.length} selected resource(s)? This action cannot be undone.
              <br /><br />
              <strong>Resources to delete:</strong>
              <ul className="list-disc list-inside mt-2 max-h-32 overflow-y-auto">
                {selectedResources.map(r => <li key={r.id}>{r.name} ({getTypeLabel(r.type)})</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = selectedResources.map(r => r.id);
                bulkDeleteMutation.mutate(ids);
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedResources.length} Resource(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
