import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Task } from "@shared/schema";

type TaskStatus = "not-started" | "in-progress" | "review" | "completed" | "on-hold";
type TaskPriority = "low" | "medium" | "high" | "critical";

interface TaskFormData {
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  progress: number;
}

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  defaultStatus?: TaskStatus;
  onClose?: () => void;
  onSave?: (data: any) => void;
}

export function TaskModal({ 
  open, 
  onOpenChange, 
  task, 
  defaultStatus = "not-started",
  onClose,
  onSave 
}: TaskModalProps) {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  
  const getDefaultFormData = (): TaskFormData => ({
    name: "",
    description: "",
    status: defaultStatus,
    priority: "medium",
    startDate: "",
    endDate: "",
    progress: 0,
  });

  const [formData, setFormData] = useState<TaskFormData>(getDefaultFormData());
  
  useEffect(() => {
    if (open) {
      if (task) {
        setFormData({
          name: task.name || "",
          description: task.description || "",
          status: (task.status as TaskStatus) || "not-started",
          priority: (task.priority as TaskPriority) || "medium",
          startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : "",
          endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : "",
          progress: task.progress || 0,
        });
      } else {
        setFormData({
          ...getDefaultFormData(),
          status: defaultStatus,
        });
      }
    }
  }, [open, task, defaultStatus]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/tasks`, {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/tasks/${task?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setFormData(getDefaultFormData());
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Task name is required",
        variant: "destructive",
      });
      return;
    }

    const taskData = {
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      priority: formData.priority,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      progress: formData.progress,
    };

    if (onSave) {
      onSave(taskData);
      handleClose();
    } else if (task) {
      updateMutation.mutate(taskData);
    } else {
      createMutation.mutate(taskData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isEditing = !!task;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="modal-task">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name *</Label>
              <Input
                id="task-name"
                placeholder="Enter task name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-task-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Enter task description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="textarea-task-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: TaskStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="task-status" data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value: TaskPriority) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger id="task-priority" data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="progress">Progress ({formData.progress}%)</Label>
              <Input
                id="progress"
                type="range"
                min={0}
                max={100}
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                data-testid="input-progress"
                className="w-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Resource assignment and RACI matrix will be implemented here.</p>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Cost tracking and budget management will be implemented here.</p>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Document attachments and evidence gallery will be implemented here.</p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} data-testid="button-save-task">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
