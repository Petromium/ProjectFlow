import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProject } from "@/contexts/ProjectContext";
import { TaskModal } from "@/components/TaskModal";
import type { Task } from "@shared/schema";

type OrgTask = Task & { projectName: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed": return "bg-green-500";
    case "in-progress": return "bg-blue-500";
    case "review": return "bg-purple-500";
    case "on-hold": return "bg-amber-500";
    default: return "bg-gray-400";
  }
};

const getPriorityBorder = (priority: string) => {
  switch (priority) {
    case "critical": return "border-l-2 border-l-red-500";
    case "high": return "border-l-2 border-l-orange-500";
    default: return "";
  }
};

const getProjectColor = (projectId: number): string => {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", 
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"
  ];
  return colors[projectId % colors.length];
};

export default function PMOCalendarPage() {
  const { selectedOrgId, selectedOrg, isLoadingOrgs } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const { 
    data: tasks = [], 
    isLoading 
  } = useQuery<OrgTask[]>({
    queryKey: [`/api/organizations/${selectedOrgId}/pmo/calendar`],
    enabled: !!selectedOrgId,
  });

  const { year, month, daysInMonth, startDay, today, monthName } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const todayDate = new Date();
    
    return {
      year: y,
      month: m,
      daysInMonth: lastDay.getDate(),
      startDay: firstDay.getDay(),
      today: todayDate.getFullYear() === y && todayDate.getMonth() === m ? todayDate.getDate() : -1,
      monthName: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [currentDate]);

  const tasksOnDate = useMemo(() => {
    const taskMap: Map<number, OrgTask[]> = new Map();
    
    tasks.forEach(task => {
      if (task.startDate) {
        const startDate = new Date(task.startDate);
        if (startDate.getFullYear() === year && startDate.getMonth() === month) {
          const day = startDate.getDate();
          if (!taskMap.has(day)) taskMap.set(day, []);
          taskMap.get(day)!.push({ ...task, _isStart: true } as any);
        }
      }
      if (task.endDate) {
        const endDate = new Date(task.endDate);
        if (endDate.getFullYear() === year && endDate.getMonth() === month) {
          const day = endDate.getDate();
          if (!taskMap.has(day)) taskMap.set(day, []);
          const existing = taskMap.get(day)!.find(t => t.id === task.id);
          if (!existing) {
            taskMap.get(day)!.push({ ...task, _isEnd: true } as any);
          }
        }
      }
    });
    
    return taskMap;
  }, [tasks, year, month]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(task => {
        if (!task.endDate) return false;
        const endDate = new Date(task.endDate);
        return endDate >= now && task.status !== "completed";
      })
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
      .slice(0, 10);
  }, [tasks]);

  const projectStats = useMemo(() => {
    const stats = new Map<string, { count: number; projectId: number }>();
    tasks.forEach(task => {
      const name = task.projectName;
      if (!stats.has(name)) {
        stats.set(name, { count: 0, projectId: task.projectId });
      }
      stats.get(name)!.count++;
    });
    return Array.from(stats.entries()).map(([name, data]) => ({ name, ...data }));
  }, [tasks]);

  const weeks = Math.ceil((daysInMonth + startDay) / 7);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const getDaysUntil = (date: string | Date) => {
    const target = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    return `${diff} days`;
  };

  if (!selectedOrgId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select an organization to view the PMO calendar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || isLoadingOrgs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-pmo-calendar">PMO Calendar</h1>
          <p className="text-muted-foreground">
            Organization-wide project timeline for {selectedOrg?.name || 'All Projects'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-4 font-semibold min-w-[180px] text-center">{monthName}</div>
          <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {projectStats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {projectStats.map(({ name, count, projectId }) => (
            <Badge key={projectId} variant="outline" className="gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", getProjectColor(projectId))} />
              {name} ({count})
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Monthly View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-muted p-3 text-center text-sm font-semibold"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: weeks * 7 }).map((_, index) => {
              const dayNumber = index - startDay + 1;
              const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
              const isToday = dayNumber === today;
              const dayTasks = tasksOnDate.get(dayNumber) || [];

              return (
                <div
                  key={index}
                  className={cn(
                    "bg-background p-2 min-h-28",
                    isToday && "ring-2 ring-primary ring-inset",
                    !isValidDay && "bg-muted/30"
                  )}
                  data-testid={isValidDay ? `calendar-day-${dayNumber}` : undefined}
                >
                  {isValidDay && (
                    <>
                      <div
                        className={cn(
                          "text-sm font-semibold mb-2",
                          isToday && "text-primary"
                        )}
                      >
                        {dayNumber}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map((task: any) => (
                          <div
                            key={`${task.id}-${task._isStart ? 'start' : 'end'}`}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded text-white truncate cursor-pointer hover:opacity-80",
                              getProjectColor(task.projectId),
                              getPriorityBorder(task.priority)
                            )}
                            title={`${task.projectName}: ${task.name} (${task._isStart ? 'Start' : 'Due'})`}
                            onClick={() => handleTaskClick(task)}
                            data-testid={`calendar-task-${task.id}`}
                          >
                            {task._isStart ? "▶ " : "◼ "}{task.name}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Upcoming Deadlines Across Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No upcoming deadlines. All tasks are either completed or have no end date set.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div 
                  key={task.id} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer",
                    getPriorityBorder(task.priority)
                  )}
                  onClick={() => handleTaskClick(task)}
                  data-testid={`upcoming-task-${task.id}`}
                >
                  <div className={cn("w-1 h-12 rounded", getProjectColor(task.projectId))} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.projectName} • Due: {new Date(task.endDate!).toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric",
                        year: "numeric"
                      })}
                    </p>
                  </div>
                  <Badge variant={task.priority === "critical" ? "destructive" : "outline"}>
                    {getDaysUntil(task.endDate!)}
                  </Badge>
                </div>
              ))}
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
