import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Plus, Edit, Trash2, Copy, Loader2, 
  AlertCircle, ChevronRight, MoreHorizontal, Tags
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Project } from "@shared/schema";
import { ProjectEditModal } from "@/components/ProjectEditModal";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import Papa from "papaparse";
import { useSelection } from "@/contexts/SelectionContext";
import { registerBulkActionHandler } from "@/components/BottomSelectionToolbar";
import type { Tag } from "@shared/schema";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId, terminology } = useProject();
  const { toast } = useToast();
  const { selectedProjects, setSelectedProjects } = useSelection();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [projectToDuplicate, setProjectToDuplicate] = useState<Project | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  // Get user's organizations
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  const selectedOrgId = organizations?.[0]?.id; // For now, use first org

  // Fetch all tags for organization
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: [`/api/organizations/${selectedOrgId}/tags`],
    enabled: !!selectedOrgId,
  });

  // Fetch projects first (must be declared before useMemo that depends on it)
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: selectedOrgId ? [`/api/organizations/${selectedOrgId}/projects`] : ["/api/organizations/null/projects"],
    enabled: !!selectedOrgId && !isLoadingOrgs,
  });

  // Memoize project IDs to prevent unnecessary refetches
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  // Fetch tags for each project
  const { data: projectTagsMap = {} } = useQuery<Record<number, Tag[]>>({
    queryKey: [`/api/projects/tags`, projectIds],
    queryFn: async () => {
      const tagsMap: Record<number, Tag[]> = {};
      await Promise.all(
        projects.map(async (project) => {
          try {
            const response = await apiRequest("GET", `/api/tags/entity/project/${project.id}`);
            tagsMap[project.id] = await response.json();
          } catch {
            tagsMap[project.id] = [];
          }
        })
      );
      return tagsMap;
    },
    enabled: projects.length > 0,
  });

  // Filter projects by selected tags
  const filteredProjects = useMemo(() => {
    if (selectedTagIds.length === 0) return projects;
    return projects.filter(project => {
      const projectTags = projectTagsMap[project.id] || [];
      return selectedTagIds.every(tagId => 
        projectTags.some(tag => tag.id === tagId)
      );
    });
  }, [projects, projectTagsMap, selectedTagIds]);

  const isLoading = isLoadingOrgs || isLoadingProjects;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500",
      "on-hold": "bg-amber-500",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-blue-500";
  };

  // Define columns
  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.name}</div>
        ),
      },
      {
        accessorKey: "code",
        header: ({ column }) => (
          <SortableHeader column={column}>Code</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-mono text-sm">{row.original.code}</div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader column={column}>Status</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge className={getStatusColor(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => (
          <SortableHeader column={column}>Start Date</SortableHeader>
        ),
        cell: ({ row }) => {
          const date = row.original.startDate;
          return date ? new Date(date).toLocaleDateString() : "-";
        },
      },
      {
        accessorKey: "endDate",
        header: ({ column }) => (
          <SortableHeader column={column}>End Date</SortableHeader>
        ),
        cell: ({ row }) => {
          const date = row.original.endDate;
          return date ? new Date(date).toLocaleDateString() : "-";
        },
      },
      {
        accessorKey: "budget",
        header: ({ column }) => (
          <SortableHeader column={column}>Budget</SortableHeader>
        ),
        cell: ({ row }) => {
          const budget = row.original.budget;
          return budget ? `$${Number(budget).toLocaleString()}` : "-";
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const project = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditProject(project)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicateProject(project)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDeleteProject(project)}
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

  const handleExport = useCallback((projectsToExport: Project[] | null) => {
    const dataToExport = projectsToExport || projects;
    const csv = Papa.unparse(
      dataToExport.map((p) => ({
        Name: p.name,
        Code: p.code,
        Status: p.status,
        "Start Date": p.startDate ? new Date(p.startDate).toLocaleDateString() : "",
        "End Date": p.endDate ? new Date(p.endDate).toLocaleDateString() : "",
        Budget: p.budget ? Number(p.budget).toLocaleString() : "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `projects_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: "Projects exported successfully" });
  }, [projects, toast]);

  const handleBulkAction = useCallback((action: string, items: Project[]) => {
    if (action === "delete") {
      setBulkDeleteDialogOpen(true);
    } else if (action === "export") {
      handleExport(items);
    }
  }, [handleExport, setBulkDeleteDialogOpen]);

  // Register bulk action handler for bottom toolbar
  React.useEffect(() => {
    return registerBulkActionHandler("projects", handleBulkAction);
  }, [handleBulkAction]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; description?: string; organizationId: number }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrgId}/projects`] });
      }
      setProjectModalOpen(false);
      toast({ title: "Success", description: "Project created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create project", variant: "destructive" });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; code?: string; description?: string; status?: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrgId}/projects`] });
      }
      setProjectModalOpen(false);
      setEditingProject(null);
      toast({ title: "Success", description: "Project updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update project", variant: "destructive" });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrgId}/projects`] });
      }
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      if (selectedProjectId === projectToDelete?.id) {
        setSelectedProjectId(null);
      }
      toast({ title: "Success", description: "Project deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete project", variant: "destructive" });
    },
  });

  // Bulk delete projects mutation
  const bulkDeleteProjectsMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      await Promise.all(projectIds.map(id => apiRequest("DELETE", `/api/projects/${id}`)));
    },
    onSuccess: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrgId}/projects`] });
      }
      setBulkDeleteDialogOpen(false);
      setSelectedProjects([]);
      // Clear selected project if it was deleted
      if (selectedProjectId && selectedProjects.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(null);
      }
      toast({ title: "Success", description: `${selectedProjects.length} project(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete projects", variant: "destructive" });
    },
  });

  // Duplicate project mutation
  const duplicateProjectMutation = useMutation({
    mutationFn: async ({ id, name, code }: { id: number; name: string; code: string }) => {
      const res = await apiRequest("POST", `/api/projects/${id}/duplicate`, { name, code });
      return res.json();
    },
    onSuccess: () => {
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrgId}/projects`] });
      }
      setDuplicateDialogOpen(false);
      setProjectToDuplicate(null);
      toast({ title: "Success", description: "Project duplicated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to duplicate project", variant: "destructive" });
    },
  });

  const handleCreateProject = () => {
    setEditingProject(null);
    setProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDuplicateProject = (project: Project) => {
    setProjectToDuplicate(project);
    setDuplicateDialogOpen(true);
  };

  if (isLoadingOrgs) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!selectedOrgId) {
    return (
      <div className="p-6">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <p className="text-center text-muted-foreground">No {terminology.topLevel.toLowerCase()} found. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage all projects in your organization</p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Projects Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tags className="h-4 w-4 mr-2" />
                    Filter by Tags
                    {selectedTagIds.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedTagIds.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                      <CommandEmpty>No tags found.</CommandEmpty>
                      <CommandGroup>
                        {allTags.map((tag) => {
                          const isSelected = selectedTagIds.includes(tag.id);
                          return (
                            <CommandItem
                              key={tag.id}
                              onSelect={() => {
                                setSelectedTagIds(prev =>
                                  isSelected
                                    ? prev.filter(id => id !== tag.id)
                                    : [...prev, tag.id]
                                );
                              }}
                            >
                              <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                {isSelected && <Check className="h-4 w-4" />}
                              </div>
                              {tag.color && (
                                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                              )}
                              <span>{tag.name}</span>
                              {tag.category && (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {tag.category}
                                </Badge>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedTagIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTagIds([])}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}

          <DataTable
            columns={columns}
            data={filteredProjects}
            searchKey="name"
            searchPlaceholder="Search projects by name or code..."
            enableSelection={true}
            enableColumnVisibility={true}
            enableExport={true}
            enableSorting={true}
            enableFiltering={true}
            enablePagination={false}
            maxHeight="calc(100vh - 400px)"
            onSelectionChange={setSelectedProjects}
            onExport={handleExport}
            emptyMessage={projects.length === 0 ? "No projects yet. Create your first project!" : "No projects found."}
            getRowId={(row) => row.id.toString()}
          />
        </div>
      )}

      {/* Create/Edit Project Modal */}
      <ProjectEditModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        project={editingProject}
        organizationId={selectedOrgId}
        onCreate={createProjectMutation.mutate}
        onUpdate={(data) => editingProject && updateProjectMutation.mutate({ ...data, id: editingProject.id })}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone and will delete all tasks, resources, and other project data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && deleteProjectMutation.mutate(projectToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Project Dialog */}
      <DuplicateProjectDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        project={projectToDuplicate}
        onDuplicate={(name, code) => projectToDuplicate && duplicateProjectMutation.mutate({ id: projectToDuplicate.id, name, code })}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Projects</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProjects.length} selected project(s)? This action cannot be undone and will delete all tasks, resources, and other project data for these projects.
              <br /><br />
              <strong>Projects to delete:</strong>
              <ul className="list-disc list-inside mt-2 max-h-32 overflow-y-auto">
                {selectedProjects.map(p => <li key={p.id}>{p.name} ({p.code})</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = selectedProjects.map(p => p.id);
                bulkDeleteProjectsMutation.mutate(ids);
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteProjectsMutation.isPending}
            >
              {bulkDeleteProjectsMutation.isPending ? "Deleting..." : `Delete ${selectedProjects.length} Project(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// Duplicate Project Dialog
function DuplicateProjectDialog({
  open,
  onOpenChange,
  project,
  onDuplicate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onDuplicate: (name: string, code: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (project) {
      setName(`${project.name} (Copy)`);
      setCode(`${project.code}-COPY`);
    } else {
      setName("");
      setCode("");
    }
  }, [project]);

  const handleDuplicate = () => {
    if (!name.trim() || !code.trim()) {
      return;
    }
    onDuplicate(name, code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="dup-name">New Project Name *</Label>
            <Input
              id="dup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="dup-code">New Project Code *</Label>
            <Input
              id="dup-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PRJ-001"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDuplicate}>Duplicate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


