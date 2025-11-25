import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TableRowCard } from "@/components/TableRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, LayoutGrid, List, Calendar as CalendarIcon, GanttChartSquare, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TaskModal } from "@/components/TaskModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Task } from "@shared/schema";

export default function WBSPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>("list");

  // Fetch tasks for selected project
  const { 
    data: tasks = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  const handleSelectTask = (id: number, selected: boolean) => {
    setSelectedTasks(prev =>
      selected ? [...prev, id] : prev.filter(t => t !== id)
    );
  };

  const handleToggleExpand = (id: number) => {
    setExpandedTasks(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleDeleteTask = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in-progress": return "secondary";
      case "at-risk": return "destructive";
      default: return "outline";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive";
      case "high": return "secondary";
      default: return "outline";
    }
  };

  // Build task hierarchy
  const rootTasks = tasks.filter(t => !t.parentId);
  const getChildren = (parentId: number) => tasks.filter(t => t.parentId === parentId);

  const renderTask = (task: Task, level = 0) => {
    const children = getChildren(task.id);
    const isExpanded = expandedTasks.includes(task.id);
    const hasChildren = children.length > 0;

    return (
      <div key={task.id}>
        <div className={level > 0 ? `ml-${level * 12}` : ""} style={{ marginLeft: `${level * 3}rem` }}>
          <TableRowCard
            id={task.id.toString()}
            selected={selectedTasks.includes(task.id)}
            onSelect={(selected) => handleSelectTask(task.id, selected)}
            expanded={isExpanded}
            onToggleExpand={hasChildren ? () => handleToggleExpand(task.id) : undefined}
            expandable={hasChildren}
            data-testid={`row-task-${task.id}`}
          >
            <div className="grid grid-cols-[2fr,1fr,1fr,1fr,100px,80px] gap-4 items-center flex-1">
              <div>
                <div className="font-medium">{task.name}</div>
                <div className="text-sm text-muted-foreground">{task.wbsCode}</div>
              </div>
              <Badge variant={getStatusColor(task.status)} data-testid={`badge-status-${task.id}`}>
                {task.status.replace("-", " ")}
              </Badge>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {task.progress}%
                </span>
              </div>
              <Badge variant={getPriorityColor(task.priority)} data-testid={`badge-priority-${task.id}`}>
                {task.priority}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {task.assignedTo || "Unassigned"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTask(task.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-${task.id}`}
              >
                Delete
              </Button>
            </div>
          </TableRowCard>
        </div>
        {isExpanded && children.map(child => renderTask(child, level + 1))}
      </div>
    );
  };

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
          <h1 className="text-3xl font-semibold">Work Breakdown Structure</h1>
          <p className="text-muted-foreground">Manage tasks and deliverables</p>
        </div>
        <Button onClick={() => setTaskModalOpen(true)} data-testid="button-create-task">
          Create Task
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load tasks. {(error as Error).message}</span>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            className="pl-9"
            data-testid="input-search-tasks"
          />
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="list" data-testid="tab-view-list">
              <List className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="grid" data-testid="tab-view-grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="gantt" data-testid="tab-view-gantt">
              <GanttChartSquare className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-view-calendar">
              <CalendarIcon className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="outline" size="icon" data-testid="button-filter">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {selectedTasks.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedTasks.length} selected</span>
          <Button variant="outline" size="sm" data-testid="button-bulk-edit">
            Bulk Edit
          </Button>
          <Button variant="outline" size="sm" data-testid="button-bulk-delete">
            Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Tasks Found</h2>
          <p className="text-muted-foreground mb-4">Get started by creating your first task</p>
          <Button onClick={() => setTaskModalOpen(true)} data-testid="button-create-first-task">
            Create Task
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rootTasks.map(task => renderTask(task))}
        </div>
      )}

      <TaskModal open={taskModalOpen} onOpenChange={setTaskModalOpen} />
    </div>
  );
}
