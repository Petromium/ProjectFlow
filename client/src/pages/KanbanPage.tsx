import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TaskModal } from "@/components/TaskModal";
import type { Task, KanbanColumn, ProjectStatus } from "@shared/schema";

type TaskStatus = "not-started" | "in-progress" | "review" | "completed" | "on-hold";

// Default columns fallback
const DEFAULT_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "not-started", title: "Not Started" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "In Review" },
  { id: "completed", title: "Completed" },
];

export default function KanbanPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("not-started");
  const [defaultCustomStatusId, setDefaultCustomStatusId] = useState<number | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  // Fetch custom kanban columns
  const { 
    data: kanbanColumns = [], 
    isLoading: isLoadingColumns 
  } = useQuery<KanbanColumn[]>({
    queryKey: [`/api/projects/${selectedProjectId}/kanban-columns`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  // Fetch custom project statuses (for display)
  const { 
    data: projectStatuses = [] 
  } = useQuery<ProjectStatus[]>({
    queryKey: [`/api/projects/${selectedProjectId}/statuses`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  const { 
    data: tasks = [], 
    isLoading: isLoadingTasks, 
    error 
  } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  const isLoading = isLoadingTasks || isLoadingColumns;

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, customStatusId }: { taskId: number; status?: TaskStatus; customStatusId?: number | null }) => {
      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (customStatusId !== undefined) updateData.customStatusId = customStatusId;
      await apiRequest("PATCH", `/api/tasks/${taskId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task status",
        variant: "destructive",
      });
    },
  });

  // Build columns from custom kanban columns or use defaults
  const columns = useMemo(() => {
    const activeColumns = kanbanColumns.filter(col => col.isActive).sort((a, b) => a.order - b.order);
    
    if (activeColumns.length > 0) {
      return activeColumns.map(col => ({
        id: col.id,
        title: col.name,
        statusId: col.statusId,
        customStatusId: col.customStatusId,
      }));
    }
    
    // Fallback to default columns
    return DEFAULT_COLUMNS.map(col => ({
      id: col.id,
      title: col.title,
      statusId: col.id as TaskStatus,
      customStatusId: null,
    }));
  }, [kanbanColumns]);

  // Group tasks by column
  const groupedTasks = useMemo(() => {
    const grouped: Record<number | string, Task[]> = {};
    
    columns.forEach(col => {
      const key = col.customStatusId || col.statusId || col.id;
      grouped[key] = [];
    });

  tasks.forEach((task) => {
      // Find matching column
      const matchingColumn = columns.find(col => {
        if (col.customStatusId) {
          return task.customStatusId === col.customStatusId;
        } else if (col.statusId) {
          return task.status === col.statusId && !task.customStatusId;
        }
        return false;
      });

      if (matchingColumn) {
        const key = matchingColumn.customStatusId || matchingColumn.statusId || matchingColumn.id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(task);
      } else {
        // Fallback: group by status if no custom columns match
        const fallbackKey = task.status;
        if (!grouped[fallbackKey]) grouped[fallbackKey] = [];
        grouped[fallbackKey].push(task);
    }
  });

    return grouped;
  }, [tasks, columns]);

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, column: { id: number | string; statusId?: TaskStatus | null; customStatusId?: number | null }) => {
    e.preventDefault();
    if (draggedTaskId !== null) {
      const task = tasks.find(t => t.id === draggedTaskId);
      if (!task) {
        setDraggedTaskId(null);
        return;
      }

      const currentMatches = task.customStatusId === column.customStatusId && task.status === (column.statusId || task.status);
      const newStatusId = column.statusId;
      const newCustomStatusId = column.customStatusId;

      // Check if status actually changed
      if (task.customStatusId !== newCustomStatusId || task.status !== newStatusId) {
        updateTaskMutation.mutate({ 
          taskId: draggedTaskId, 
          status: newStatusId || undefined,
          customStatusId: newCustomStatusId !== undefined ? newCustomStatusId : undefined,
        });
      }
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleAddTask = (column: { id: number | string; statusId?: TaskStatus | null; customStatusId?: number | null }) => {
    setEditingTask(undefined);
    setDefaultStatus((column.statusId as TaskStatus) || "not-started");
    setDefaultCustomStatusId(column.customStatusId || null);
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive" className="text-xs">critical</Badge>;
      case "high":
        return <Badge variant="default" className="text-xs">high</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs">medium</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{priority}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const isOverdue = (task: Task) => {
    if (!task.endDate) return false;
    return new Date(task.endDate) < new Date() && task.status !== "completed";
  };

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view the Kanban board.
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

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load tasks. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-kanban">Kanban Board</h1>
          <p className="text-muted-foreground">Drag and drop to change task status</p>
        </div>
        <Button onClick={() => handleAddTask("not-started")} data-testid="button-add-task">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className={`grid gap-4 h-[calc(100%-80px)]`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 1fr))` }}>
        {columns.map((column) => {
          const columnKey = column.customStatusId || column.statusId || column.id;
          const columnTasks = groupedTasks[columnKey] || [];
          
          return (
          <div 
            key={column.id} 
            className="flex flex-col min-h-[400px]"
            onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column)}
            data-testid={`column-${column.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{column.title}</h3>
                <Badge variant="secondary" data-testid={`count-${column.id}`}>
                    {columnTasks.length}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
                {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  className={`cursor-grab active:cursor-grabbing hover-elevate active-elevate-2 transition-all ${
                    draggedTaskId === task.id ? "opacity-50" : ""
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleEditTask(task)}
                  data-testid={`kanban-card-${task.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-xs" data-testid={`task-code-${task.id}`}>
                        {task.wbsCode || `T-${task.id}`}
                      </Badge>
                      {isOverdue(task) && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>

                    <h4 className="font-medium text-sm leading-tight" data-testid={`task-name-${task.id}`}>
                      {task.name}
                    </h4>

                    {task.progress !== undefined && task.progress > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-1.5" />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      {getPriorityBadge(task.priority)}

                      <div className="flex items-center gap-2">
                        {task.endDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(task.endDate).toLocaleDateString()}
                          </div>
                        )}
                        {task.assignedTo && (
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(task.assignedTo)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => handleAddTask(column)}
                data-testid={`button-add-card-${column.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>
        );
        })}
      </div>

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
        defaultCustomStatusId={defaultCustomStatusId}
      />
    </div>
  );
}
