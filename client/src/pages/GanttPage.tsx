import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProject } from "@/contexts/ProjectContext";
import { TaskModal } from "@/components/TaskModal";
import type { Task, TaskDependency } from "@shared/schema";

type ZoomLevel = "week" | "month" | "quarter";

const ZOOM_CONFIGS: Record<ZoomLevel, { daysPerUnit: number; unitLabel: string }> = {
  week: { daysPerUnit: 7, unitLabel: "Week" },
  month: { daysPerUnit: 30, unitLabel: "Month" },
  quarter: { daysPerUnit: 90, unitLabel: "Quarter" },
};

export default function GanttPage() {
  const { selectedProjectId } = useProject();
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const { 
    data: tasks = [], 
    isLoading: tasksLoading 
  } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId,
  });

  const { data: dependencies = [] } = useQuery<TaskDependency[]>({
    queryKey: [`/api/projects/${selectedProjectId}/dependencies`],
    enabled: !!selectedProjectId,
  });

  const { minDate, maxDate, totalDays, units } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        minDate: now,
        maxDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        totalDays: 180,
        units: 6,
      };
    }

    let min = new Date();
    let max = new Date();
    
    tasks.forEach(task => {
      if (task.startDate) {
        const start = new Date(task.startDate);
        if (!min || start < min) min = start;
      }
      if (task.endDate) {
        const end = new Date(task.endDate);
        if (!max || end > max) max = end;
      }
    });

    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    const daysDiff = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
    const { daysPerUnit } = ZOOM_CONFIGS[zoom];
    
    return {
      minDate: min,
      maxDate: max,
      totalDays: daysDiff,
      units: Math.ceil(daysDiff / daysPerUnit),
    };
  }, [tasks, zoom]);

  const getTaskPosition = (task: Task) => {
    if (!task.startDate || !task.endDate) return { left: 0, width: 0 };
    
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    
    const startOffset = Math.floor((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      left: (startOffset / totalDays) * 100,
      width: Math.max((duration / totalDays) * 100, 1),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in-progress": return "bg-blue-500";
      case "review": return "bg-purple-500";
      case "on-hold": return "bg-amber-500";
      default: return "bg-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "border-l-4 border-l-red-500";
      case "high": return "border-l-4 border-l-orange-500";
      default: return "";
    }
  };

  const getUnitLabels = () => {
    const labels: string[] = [];
    const { daysPerUnit, unitLabel } = ZOOM_CONFIGS[zoom];
    
    for (let i = 0; i < units; i++) {
      const unitDate = new Date(minDate.getTime() + i * daysPerUnit * 24 * 60 * 60 * 1000);
      if (zoom === "week") {
        labels.push(`${unitLabel} ${i + 1}`);
      } else if (zoom === "month") {
        labels.push(unitDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
      } else {
        labels.push(`Q${Math.floor(unitDate.getMonth() / 3) + 1} ${unitDate.getFullYear()}`);
      }
    }
    return labels;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleZoomIn = () => {
    if (zoom === "quarter") setZoom("month");
    else if (zoom === "month") setZoom("week");
  };

  const handleZoomOut = () => {
    if (zoom === "week") setZoom("month");
    else if (zoom === "month") setZoom("quarter");
  };

  const rootTasks = tasks.filter(t => !t.parentId);
  const getChildren = (parentId: number): Task[] => tasks.filter(t => t.parentId === parentId);

  const renderTask = (task: Task, level = 0): JSX.Element[] => {
    const children = getChildren(task.id);
    const { left, width } = getTaskPosition(task);
    const hasValidDates = task.startDate && task.endDate;
    
    const elements: JSX.Element[] = [
      <div
        key={task.id}
        className={`grid grid-cols-12 gap-px items-center ${getPriorityColor(task.priority)}`}
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        <div className="col-span-3 flex items-center gap-2 py-2 pr-2">
          <Badge variant="outline" className="font-mono text-xs shrink-0">
            {task.wbsCode || `#${task.id}`}
          </Badge>
          <span className="text-sm font-medium truncate">{task.name}</span>
        </div>
        <div className="col-span-9 relative h-10 bg-muted/30 rounded">
          {hasValidDates ? (
            <div
              className={`absolute top-1/2 -translate-y-1/2 h-6 rounded ${getStatusColor(task.status)} flex items-center px-2 text-white text-xs font-semibold shadow hover-elevate cursor-pointer transition-shadow overflow-hidden`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                minWidth: "40px",
              }}
              onClick={() => handleTaskClick(task)}
              data-testid={`gantt-bar-${task.id}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{task.progress || 0}%</span>
              </div>
              <div
                className="absolute inset-0 bg-white/20 rounded pointer-events-none"
                style={{ width: `${task.progress || 0}%` }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              No dates set
            </div>
          )}
        </div>
      </div>
    ];

    children.forEach(child => {
      elements.push(...renderTask(child, level + 1));
    });

    return elements;
  };

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view the Gantt chart.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-gantt">Gantt Chart</h1>
          <p className="text-muted-foreground">
            Timeline view with {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleZoomIn}
            disabled={zoom === "week"}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="px-3">{ZOOM_CONFIGS[zoom].unitLabel}</Badge>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom === "quarter"}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" data-testid="button-fit-screen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">No Tasks Yet</h2>
              <p className="text-muted-foreground">Create tasks with start and end dates to see them on the Gantt chart</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-12 gap-px mb-4 bg-border rounded-lg overflow-hidden">
                  <div className="col-span-3 bg-muted p-3 font-semibold text-sm">Task</div>
                  <div className="col-span-9 bg-muted">
                    <div 
                      className="grid text-center text-sm font-semibold"
                      style={{ gridTemplateColumns: `repeat(${Math.min(units, 12)}, 1fr)` }}
                    >
                      {getUnitLabels().slice(0, 12).map((label, i) => (
                        <div key={i} className="p-3 border-l border-border">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {rootTasks.map(task => renderTask(task))}
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3">Legend</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span>Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500" />
                      <span>In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-purple-500" />
                      <span>In Review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-500" />
                      <span>On Hold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-400" />
                      <span>Not Started</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-4 border-l-4 border-l-red-500 bg-muted rounded" />
                      <span>Critical Priority</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={selectedTask}
      />
    </div>
  );
}
