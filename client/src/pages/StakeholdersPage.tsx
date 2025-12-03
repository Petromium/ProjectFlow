import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Edit, Trash2, AlertCircle, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Stakeholder } from "@shared/schema";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StakeholdersPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [selectedStakeholders, setSelectedStakeholders] = useState<Stakeholder[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "other" as "consultant" | "sponsor" | "client" | "team-member" | "contractor" | "other",
    email: "",
    phone: "",
    organization: "",
  });

  // Fetch stakeholders
  const { 
    data: stakeholders = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Stakeholder[]>({
    queryKey: [`/api/projects/${selectedProjectId}/stakeholders`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  // Create stakeholder mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!selectedProjectId) throw new Error("No project selected");
      await apiRequest("POST", "/api/stakeholders", {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/stakeholders`] });
      setDialogOpen(false);
      setEditingStakeholder(null);
      setFormData({
        name: "",
        role: "other",
        email: "",
        phone: "",
        organization: "",
      });
      toast({
        title: "Success",
        description: "Stakeholder added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add stakeholder",
        variant: "destructive",
      });
    },
  });

  // Update stakeholder mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      await apiRequest("PATCH", `/api/stakeholders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/stakeholders`] });
      setDialogOpen(false);
      setEditingStakeholder(null);
      setFormData({
        name: "",
        role: "other",
        email: "",
        phone: "",
        organization: "",
      });
      toast({
        title: "Success",
        description: "Stakeholder updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stakeholder",
        variant: "destructive",
      });
    },
  });

  // Delete stakeholder mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stakeholders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/stakeholders`] });
      toast({
        title: "Success",
        description: "Stakeholder deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stakeholder",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStakeholder) {
      updateMutation.mutate({ id: editingStakeholder.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setFormData({
      name: stakeholder.name,
      role: stakeholder.role as any,
      email: stakeholder.email || "",
      phone: stakeholder.phone || "",
      organization: stakeholder.organization || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this stakeholder?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingStakeholder(null);
    setFormData({
      name: "",
      role: "other",
      email: "",
      phone: "",
      organization: "",
    });
    setDialogOpen(true);
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/stakeholders/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/stakeholders`] });
      setBulkDeleteDialogOpen(false);
      setSelectedStakeholders([]);
      toast({ title: "Success", description: `${selectedStakeholders.length} stakeholder(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete stakeholders", variant: "destructive" });
    },
  });

  const handleBulkAction = (action: string, items: Stakeholder[]) => {
    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
    }
  };

  // Define columns
  const columns = useMemo<ColumnDef<Stakeholder>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {row.original.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{row.original.name}</div>
              {row.original.organization && (
                <div className="text-xs text-muted-foreground">{row.original.organization}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <SortableHeader column={column}>Role</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: "contactInfo",
        header: "Contact Info",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-sm">
            {row.original.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span>{row.original.email}</span>
              </div>
            )}
            {row.original.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>{row.original.phone}</span>
              </div>
            )}
            {!row.original.email && !row.original.phone && (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const stakeholder = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(stakeholder)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDelete(stakeholder.id)}
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

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project from the dropdown above</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Stakeholders</h1>
          <p className="text-muted-foreground">Project team and external contacts</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-stakeholder">
          Add Stakeholder
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load stakeholders. {(error as Error).message}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-retry"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading stakeholders...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selection Toolbar - moved to top */}
          <SelectionToolbar
            selectedCount={selectedStakeholders.length}
            selectedItems={selectedStakeholders}
            onClearSelection={() => setSelectedStakeholders([])}
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
          <DataTable
            columns={columns}
            data={stakeholders}
            searchKey="name"
            searchPlaceholder="Search stakeholders by name, email, or organization..."
            enableSelection={true}
            enableColumnVisibility={true}
            enableExport={true}
            enableSorting={true}
            enableFiltering={true}
            enablePagination={false}
            maxHeight="calc(100vh - 400px)"
            onSelectionChange={setSelectedStakeholders}
            emptyMessage={stakeholders.length === 0 ? "No stakeholders yet. Add your first stakeholder!" : "No stakeholders found."}
            getRowId={(row) => row.id.toString()}
          />
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Stakeholders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedStakeholders.length} selected stakeholder(s)? This action cannot be undone.
              <br /><br />
              <strong>Stakeholders to delete:</strong>
              <ul className="list-disc list-inside mt-2 max-h-32 overflow-y-auto">
                {selectedStakeholders.map(s => <li key={s.id}>{s.name} {s.email ? `(${s.email})` : ""}</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = selectedStakeholders.map(s => s.id);
                bulkDeleteMutation.mutate(ids);
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedStakeholders.length} Stakeholder(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-stakeholder">
          <DialogHeader>
            <DialogTitle>{editingStakeholder ? "Edit Stakeholder" : "Add Stakeholder"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-stakeholder-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="select-stakeholder-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sponsor">Sponsor</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="team-member">Team Member</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="consultant">Consultant</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-stakeholder-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-stakeholder-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                data-testid="input-stakeholder-organization"
              />
            </div>


            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Saving..." 
                  : editingStakeholder 
                    ? "Update Stakeholder" 
                    : "Add Stakeholder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
