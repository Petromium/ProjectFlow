import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Search, Edit, Trash2, Copy, Loader2, 
  AlertCircle, ChevronRight
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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

export default function ProjectsPage() {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [projectToDuplicate, setProjectToDuplicate] = useState<Project | null>(null);

  // Get user's organizations
  const { data: organizations = [], isLoading: isLoadingOrgs } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  const selectedOrgId = organizations?.[0]?.id; // For now, use first org

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: selectedOrgId ? [`/api/organizations/${selectedOrgId}/projects`] : ["/api/organizations/null/projects"],
    enabled: !!selectedOrgId && !isLoadingOrgs,
  });

  const isLoading = isLoadingOrgs || isLoadingProjects;

  // Filter projects
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500",
      "on-hold": "bg-amber-500",
      completed: "bg-gray-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-blue-500";
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
        <p className="text-center text-muted-foreground">No organization found. Please contact your administrator.</p>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Projects Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {searchQuery ? "No projects found" : "No projects yet. Create your first project!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="font-mono text-sm">{project.code}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      {project.budget ? `$${Number(project.budget).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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


