import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Plus, Edit, Trash2, Loader2, 
  AlertCircle, MoreHorizontal, Building2
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import type { Organization } from "@shared/schema";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import Papa from "papaparse";

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

interface OrganizationWithStats extends Organization {
  projectCount?: number;
  userCount?: number;
}

export function OrganizationsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<OrganizationWithStats | null>(null);
  const [selectedOrgs, setSelectedOrgs] = useState<OrganizationWithStats[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    currency: "EUR",
  });

  // Fetch organizations
  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  // Fetch stats for each organization
  const { data: orgsWithStats = [] } = useQuery<OrganizationWithStats[]>({
    queryKey: ["/api/organizations/stats", organizations],
    enabled: organizations.length > 0,
    queryFn: async () => {
      const statsPromises = organizations.map(async (org) => {
        try {
          const res = await apiRequest("GET", `/api/organizations/${org.id}/stats`);
          const stats = await res.json();
          return { ...org, projectCount: stats.projectCount, userCount: stats.userCount };
        } catch {
          return { ...org, projectCount: 0, userCount: 0 };
        }
      });
      return Promise.all(statsPromises);
    },
  });

  // Define columns
  const columns = useMemo<ColumnDef<OrganizationWithStats>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "slug",
        header: ({ column }) => (
          <SortableHeader column={column}>Slug</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-mono text-sm text-muted-foreground">{row.original.slug}</div>
        ),
      },
      {
        accessorKey: "currency",
        header: ({ column }) => (
          <SortableHeader column={column}>Currency</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.currency}</Badge>
        ),
      },
      {
        id: "stats",
        header: "Stats",
        cell: ({ row }) => {
          const org = row.original;
          return (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{org.projectCount ?? 0} projects</span>
              <span>{org.userCount ?? 0} users</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const org = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditOrg(org)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDeleteOrg(org)}
                    className="text-destructive"
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

  const handleExport = (orgsToExport: OrganizationWithStats[] | null) => {
    const dataToExport = orgsToExport || orgsWithStats;
    const csv = Papa.unparse(
      dataToExport.map((o) => ({
        Name: o.name,
        Slug: o.slug,
        Currency: o.currency,
        "Project Count": o.projectCount ?? 0,
        "User Count": o.userCount ?? 0,
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `organizations_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: "Organizations exported successfully" });
  };

  const handleBulkAction = (action: string, items: OrganizationWithStats[]) => {
    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
    } else if (action === "export") {
      handleExport(items);
    }
  };

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; currency: string }) => {
      const res = await apiRequest("POST", "/api/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setOrgModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "Organization created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create organization", variant: "destructive" });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; slug?: string; currency?: string }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setOrgModalOpen(false);
      setEditingOrg(null);
      resetForm();
      toast({ title: "Success", description: "Organization updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update organization", variant: "destructive" });
    },
  });

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/organizations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
      setDeleteConfirmation("");
      toast({ title: "Success", description: "Organization deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete organization", variant: "destructive" });
    },
  });

  // Bulk delete organizations mutation
  const bulkDeleteOrgsMutation = useMutation({
    mutationFn: async (orgIds: number[]) => {
      await Promise.all(orgIds.map(id => apiRequest("DELETE", `/api/organizations/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setBulkDeleteDialogOpen(false);
      setSelectedOrgs([]);
      toast({ title: "Success", description: `${selectedOrgs.length} organization(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete organizations", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", slug: "", currency: "EUR" });
  };

  const handleCreateOrg = () => {
    setEditingOrg(null);
    resetForm();
    setOrgModalOpen(true);
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      currency: org.currency,
    });
    setOrgModalOpen(true);
  };

  const handleDeleteOrg = (org: OrganizationWithStats) => {
    setOrgToDelete(org);
    setDeleteConfirmation("");
    setDeleteDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingOrg ? prev.slug : generateSlug(name), // Only auto-generate if creating new
    }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (!formData.slug.trim()) {
      toast({ title: "Error", description: "Slug is required", variant: "destructive" });
      return;
    }

    if (editingOrg) {
      updateOrgMutation.mutate({
        id: editingOrg.id,
        name: formData.name,
        slug: formData.slug,
        currency: formData.currency,
      });
    } else {
      createOrgMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <p className="text-muted-foreground mt-1">Manage your organizations</p>
        </div>
        <Button onClick={handleCreateOrg}>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Organizations Table */}
      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={orgsWithStats}
          searchKey="name"
          searchPlaceholder="Search organizations by name or slug..."
          enableSelection={true}
          enableColumnVisibility={true}
          enableExport={true}
          enableSorting={true}
          enableFiltering={true}
          onSelectionChange={setSelectedOrgs}
          onExport={handleExport}
          emptyMessage={orgsWithStats.length === 0 ? "No organizations yet. Create your first organization!" : "No organizations found."}
          getRowId={(row) => row.id.toString()}
        />
        <SelectionToolbar
          selectedCount={selectedOrgs.length}
          selectedItems={selectedOrgs}
          onClearSelection={() => setSelectedOrgs([])}
          onBulkAction={handleBulkAction}
          position="sticky"
          bulkActions={[
            {
              label: "Delete Selected",
              action: "delete",
              icon: <Trash2 className="h-4 w-4" />,
              variant: "destructive",
            },
          ]}
        />
      </div>

      {/* Create/Edit Organization Modal */}
      <Dialog open={orgModalOpen} onOpenChange={setOrgModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Edit Organization" : "Create Organization"}</DialogTitle>
            <DialogDescription>
              {editingOrg ? "Update organization details" : "Create a new organization"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                placeholder="my-organization"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createOrgMutation.isPending || updateOrgMutation.isPending}>
              {editingOrg ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (GitHub-style) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Organization</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div>
                <p className="font-semibold text-foreground mb-2">
                  This action cannot be undone. This will permanently delete the organization and all associated data.
                </p>
                <p className="text-sm text-muted-foreground">
                  This will delete:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li><strong>{orgToDelete?.projectCount ?? 0} project(s)</strong> and all their data</li>
                  <li><strong>{orgToDelete?.userCount ?? 0} user(s)</strong> will be removed from the organization</li>
                  <li>All tasks, risks, issues, resources, and other project data</li>
                  <li>All documents and files</li>
                  <li>All settings and configurations</li>
                </ul>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="delete-confirmation" className="text-sm font-semibold">
                  Please type <span className="font-mono bg-muted px-1 rounded">{orgToDelete?.name}</span> to confirm:
                </Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={orgToDelete?.name}
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orgToDelete && deleteConfirmation === orgToDelete.name) {
                  deleteOrgMutation.mutate(orgToDelete.id);
                }
              }}
              disabled={deleteConfirmation !== orgToDelete?.name || deleteOrgMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrgMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Organization"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Organizations</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrgs.length} selected organization(s)? This action cannot be undone and will delete all projects, users, and other data for these organizations.
              <br /><br />
              <strong>Organizations to delete:</strong>
              <ul className="list-disc list-inside mt-2 max-h-32 overflow-y-auto">
                {selectedOrgs.map(o => <li key={o.id}>{o.name} ({o.projectCount ?? 0} projects, {o.userCount ?? 0} users)</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteOrgsMutation.mutate(selectedOrgs.map(o => o.id));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedOrgs.length} Organization(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

