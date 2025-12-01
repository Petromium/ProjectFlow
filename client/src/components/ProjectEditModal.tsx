import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import type { Project, ProjectStatus, KanbanColumn } from "@shared/schema";

interface ProjectEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null; // null = create mode, Project = edit mode
  organizationId: number;
  onCreate?: (data: { name: string; code: string; description?: string; organizationId: number; status: string }) => void;
  onUpdate?: (data: { id: number; name?: string; code?: string; description?: string; status?: string }) => void;
}

export function ProjectEditModal({
  open,
  onOpenChange,
  project,
  organizationId,
  onCreate,
  onUpdate,
}: ProjectEditModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusCode, setNewStatusCode] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("blue");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"system" | "custom">("system");
  const [newColumnStatusId, setNewColumnStatusId] = useState<string>("not-started");
  const [newColumnCustomStatusId, setNewColumnCustomStatusId] = useState<number | null>(null);

  const isCreateMode = !project;

  // Reset form when modal opens/closes or project changes
  useEffect(() => {
    if (open) {
      if (project) {
        setName(project.name);
        setCode(project.code);
        setDescription(project.description || "");
        setStatus(project.status);
        setActiveTab("general");
      } else {
        setName("");
        setCode("");
        setDescription("");
        setStatus("active");
        setActiveTab("general");
      }
    }
  }, [open, project]);

  // Fetch project statuses (only when editing existing project)
  const { data: projectStatuses = [], refetch: refetchStatuses } = useQuery<ProjectStatus[]>({
    queryKey: [`/api/projects/${project?.id}/statuses`],
    enabled: open && !!project && project.id > 0,
  });

  // Fetch kanban columns (only when editing existing project)
  const { data: kanbanColumns = [], refetch: refetchColumns } = useQuery<KanbanColumn[]>({
    queryKey: [`/api/projects/${project?.id}/kanban-columns`],
    enabled: open && !!project && project.id > 0,
  });

  // General tab mutations
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; code?: string; description?: string; status?: string }) => {
      if (!project) return;
      const res = await apiRequest("PATCH", `/api/projects/${project.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/projects`] });
      toast({ title: "Success", description: "Project updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update project", variant: "destructive" });
    },
  });

  // Status mutations
  const createStatusMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; color?: string }) => {
      if (!project) return;
      const res = await apiRequest("POST", `/api/projects/${project.id}/statuses`, {
        ...data,
        projectId: project.id,
        order: projectStatuses.length,
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/statuses`] });
      setNewStatusName("");
      setNewStatusCode("");
      setNewStatusColor("blue");
      refetchStatuses();
      toast({ title: "Success", description: "Status created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create status", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; code?: string; color?: string; isActive?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/project-statuses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/statuses`] });
      setEditingStatus(null);
      refetchStatuses();
      toast({ title: "Success", description: "Status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/project-statuses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/statuses`] });
      refetchStatuses();
      toast({ title: "Success", description: "Status deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete status", variant: "destructive" });
    },
  });

  // Kanban column mutations
  const createColumnMutation = useMutation({
    mutationFn: async (data: { name: string; statusId?: string; customStatusId?: number }) => {
      if (!project) return;
      const res = await apiRequest("POST", `/api/projects/${project.id}/kanban-columns`, {
        ...data,
        projectId: project.id,
        order: kanbanColumns.length,
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/kanban-columns`] });
      setNewColumnName("");
      setNewColumnType("system");
      setNewColumnStatusId("not-started");
      setNewColumnCustomStatusId(null);
      refetchColumns();
      toast({ title: "Success", description: "Column created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create column", variant: "destructive" });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; statusId?: string; customStatusId?: number; isActive?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/kanban-columns/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/kanban-columns`] });
      setEditingColumn(null);
      refetchColumns();
      toast({ title: "Success", description: "Column updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update column", variant: "destructive" });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/kanban-columns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project?.id}/kanban-columns`] });
      refetchColumns();
      toast({ title: "Success", description: "Column deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete column", variant: "destructive" });
    },
  });

  const handleGeneralSubmit = () => {
    if (!name.trim() || !code.trim()) {
      toast({ title: "Error", description: "Name and code are required", variant: "destructive" });
      return;
    }

    const data = { name, code, description: description || undefined, organizationId, status };
    if (project && onUpdate) {
      updateProjectMutation.mutate({ id: project.id, ...data });
    } else if (onCreate) {
      onCreate(data);
    }
  };

  const handleCreateStatus = () => {
    if (!newStatusName.trim() || !newStatusCode.trim()) {
      toast({ title: "Error", description: "Name and code are required", variant: "destructive" });
      return;
    }
    createStatusMutation.mutate({
      name: newStatusName,
      code: newStatusCode.toLowerCase().replace(/\s+/g, "-"),
      color: newStatusColor,
    });
  };

  const handleCreateColumn = () => {
    if (!newColumnName.trim()) {
      toast({ title: "Error", description: "Column name is required", variant: "destructive" });
      return;
    }
    if (newColumnType === "system" && !newColumnStatusId) {
      toast({ title: "Error", description: "Please select a system status", variant: "destructive" });
      return;
    }
    if (newColumnType === "custom" && !newColumnCustomStatusId) {
      toast({ title: "Error", description: "Please select a custom status", variant: "destructive" });
      return;
    }
    createColumnMutation.mutate({
      name: newColumnName,
      statusId: newColumnType === "system" ? newColumnStatusId : undefined,
      customStatusId: newColumnType === "custom" ? newColumnCustomStatusId || undefined : undefined,
    });
  };

  const SYSTEM_STATUSES = [
    { id: "not-started", name: "Not Started" },
    { id: "in-progress", name: "In Progress" },
    { id: "review", name: "In Review" },
    { id: "completed", name: "Completed" },
    { id: "on-hold", name: "On Hold" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{project ? `Edit Project: ${project.name}` : "Create Project"}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            {project && (
              <>
                <TabsTrigger value="statuses">Status Configuration</TabsTrigger>
                <TabsTrigger value="kanban">Kanban Columns</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PRJ-001"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Status Configuration Tab - Only for existing projects */}
          {project && (
            <TabsContent value="statuses" className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Custom Statuses</h3>
                    <p className="text-sm text-muted-foreground">Define custom statuses for this project</p>
                  </div>
                </div>

                {/* Add New Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Add New Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="status-name">Name</Label>
                        <Input
                          id="status-name"
                          value={newStatusName}
                          onChange={(e) => setNewStatusName(e.target.value)}
                          placeholder="e.g., Stuck, Internal Approval"
                        />
                      </div>
                      <div>
                        <Label htmlFor="status-code">Code</Label>
                        <Input
                          id="status-code"
                          value={newStatusCode}
                          onChange={(e) => setNewStatusCode(e.target.value)}
                          placeholder="e.g., stuck, internal-approval"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="status-color">Color</Label>
                      <Select value={newStatusColor} onValueChange={setNewStatusColor}>
                        <SelectTrigger id="status-color">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blue">Blue</SelectItem>
                          <SelectItem value="green">Green</SelectItem>
                          <SelectItem value="red">Red</SelectItem>
                          <SelectItem value="amber">Amber</SelectItem>
                          <SelectItem value="purple">Purple</SelectItem>
                          <SelectItem value="gray">Gray</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateStatus} disabled={createStatusMutation.isPending}>
                      {createStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Status
                    </Button>
                  </CardContent>
                </Card>

                {/* Existing Statuses */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Existing Statuses</h4>
                  {projectStatuses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custom statuses defined</p>
                  ) : (
                    <div className="space-y-2">
                      {projectStatuses.map((status) => (
                        <Card key={status.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full bg-${status.color || "blue"}-500`} />
                                <div>
                                  <div className="font-medium">{status.name}</div>
                                  <div className="text-sm text-muted-foreground font-mono">{status.code}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={status.isActive}
                                  onCheckedChange={(checked) => updateStatusMutation.mutate({ id: status.id, isActive: checked === true })}
                                />
                                <Button variant="ghost" size="sm" onClick={() => setEditingStatus(status)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteStatusMutation.mutate(status.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit Status Dialog */}
                {editingStatus && (
                  <EditStatusDialog
                    status={editingStatus}
                    open={!!editingStatus}
                    onOpenChange={(open) => !open && setEditingStatus(null)}
                    onUpdate={(data) => updateStatusMutation.mutate({ id: editingStatus.id, ...data })}
                  />
                )}
              </div>
            </TabsContent>
          )}

          {/* Kanban Columns Tab - Only for existing projects */}
          {project && (
            <TabsContent value="kanban" className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Kanban Columns</h3>
                    <p className="text-sm text-muted-foreground">Configure Kanban board columns for this project</p>
                  </div>
                </div>

                {/* Add New Column */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Add New Column</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="column-name">Column Name</Label>
                      <Input
                        id="column-name"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="e.g., Stuck, Internal Approval"
                      />
                    </div>
                    <div>
                      <Label htmlFor="column-type">Map To</Label>
                      <Select value={newColumnType} onValueChange={(val: "system" | "custom") => setNewColumnType(val)}>
                        <SelectTrigger id="column-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System Status</SelectItem>
                          <SelectItem value="custom">Custom Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newColumnType === "system" ? (
                      <div>
                        <Label htmlFor="column-status">System Status</Label>
                        <Select value={newColumnStatusId} onValueChange={setNewColumnStatusId}>
                          <SelectTrigger id="column-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_STATUSES.map((status) => (
                              <SelectItem key={status.id} value={status.id}>
                                {status.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="column-custom-status">Custom Status</Label>
                        {projectStatuses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No custom statuses available. Create one in the Status Configuration tab.</p>
                        ) : (
                          <Select 
                            value={newColumnCustomStatusId?.toString() || ""} 
                            onValueChange={(val) => setNewColumnCustomStatusId(parseInt(val))}
                          >
                            <SelectTrigger id="column-custom-status">
                              <SelectValue placeholder="Select custom status" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectStatuses.map((status) => (
                                <SelectItem key={status.id} value={status.id.toString()}>
                                  {status.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                    <Button onClick={handleCreateColumn} disabled={createColumnMutation.isPending}>
                      {createColumnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Column
                    </Button>
                  </CardContent>
                </Card>

                {/* Existing Columns */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Existing Columns</h4>
                  {kanbanColumns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No custom columns defined. Default columns will be used.</p>
                  ) : (
                    <div className="space-y-2">
                      {kanbanColumns.map((column) => {
                        const mappedStatus = column.statusId 
                          ? SYSTEM_STATUSES.find(s => s.id === column.statusId)?.name
                          : projectStatuses.find(s => s.id === column.customStatusId)?.name || "Unknown";
                        
                        return (
                          <Card key={column.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{column.name}</div>
                                  <div className="text-sm text-muted-foreground">Maps to: {mappedStatus}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={column.isActive}
                                    onCheckedChange={(checked) => updateColumnMutation.mutate({ id: column.id, isActive: checked === true })}
                                  />
                                  <Button variant="ghost" size="sm" onClick={() => setEditingColumn(column)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteColumnMutation.mutate(column.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Edit Column Dialog */}
                {editingColumn && (
                  <EditColumnDialog
                    column={editingColumn}
                    statuses={projectStatuses}
                    systemStatuses={SYSTEM_STATUSES}
                    open={!!editingColumn}
                    onOpenChange={(open) => !open && setEditingColumn(null)}
                    onUpdate={(data) => updateColumnMutation.mutate({ id: editingColumn.id, ...data })}
                  />
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {activeTab === "general" && (
            <Button onClick={handleGeneralSubmit} disabled={updateProjectMutation.isPending || (isCreateMode && !onCreate)}>
              {updateProjectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {project ? "Update" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Status Dialog Component
function EditStatusDialog({
  status,
  open,
  onOpenChange,
  onUpdate,
}: {
  status: ProjectStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: any) => void;
}) {
  const [name, setName] = useState(status.name);
  const [code, setCode] = useState(status.code);
  const [color, setColor] = useState(status.color || "blue");

  useEffect(() => {
    setName(status.name);
    setCode(status.code);
    setColor(status.color || "blue");
  }, [status]);

  const handleUpdate = () => {
    onUpdate({ name, code, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-status-name">Name</Label>
            <Input
              id="edit-status-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-status-code">Code</Label>
            <Input
              id="edit-status-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-status-color">Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger id="edit-status-color">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
                <SelectItem value="gray">Gray</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Column Dialog Component
function EditColumnDialog({
  column,
  statuses,
  systemStatuses,
  open,
  onOpenChange,
  onUpdate,
}: {
  column: KanbanColumn;
  statuses: ProjectStatus[];
  systemStatuses: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (data: any) => void;
}) {
  const [name, setName] = useState(column.name);
  const [type, setType] = useState<"system" | "custom">(column.statusId ? "system" : "custom");
  const [statusId, setStatusId] = useState(column.statusId || "not-started");
  const [customStatusId, setCustomStatusId] = useState<number | null>(column.customStatusId || null);

  useEffect(() => {
    setName(column.name);
    setType(column.statusId ? "system" : "custom");
    setStatusId(column.statusId || "not-started");
    setCustomStatusId(column.customStatusId || null);
  }, [column]);

  const handleUpdate = () => {
    onUpdate({
      name,
      statusId: type === "system" ? statusId : undefined,
      customStatusId: type === "custom" ? customStatusId || undefined : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-column-name">Column Name</Label>
            <Input
              id="edit-column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-column-type">Map To</Label>
            <Select value={type} onValueChange={(val: "system" | "custom") => setType(val)}>
              <SelectTrigger id="edit-column-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System Status</SelectItem>
                <SelectItem value="custom">Custom Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "system" ? (
            <div>
              <Label htmlFor="edit-column-status">System Status</Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger id="edit-column-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {systemStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="edit-column-custom-status">Custom Status</Label>
              {statuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No custom statuses available.</p>
              ) : (
                <Select 
                  value={customStatusId?.toString() || ""} 
                  onValueChange={(val) => setCustomStatusId(parseInt(val))}
                >
                  <SelectTrigger id="edit-column-custom-status">
                    <SelectValue placeholder="Select custom status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpdate}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


