import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Calendar, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProject } from "@/contexts/ProjectContext";
import { TaskModal } from "@/components/TaskModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@shared/schema";

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

export default function CalendarPage() {
  const { selectedProjectId } = useProject();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [showActualDates, setShowActualDates] = useState(true);
  const [showBaselineDates, setShowBaselineDates] = useState(true);

  const { 
    data: tasks = [], 
    isLoading 
  } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId,
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
    const taskMap: Map<number, Task[]> = new Map();
    
    tasks.forEach(task => {
      // Determine which dates to use based on toggle settings
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let dateType: "actual" | "baseline" | "both" = "actual";

      if (showActualDates && showBaselineDates) {
        // Show both - prefer actual if available, fallback to baseline
        startDate = (task as any).actualStartDate ? new Date((task as any).actualStartDate) : 
                   (task as any).baselineStart ? new Date((task as any).baselineStart) : 
                   task.startDate ? new Date(task.startDate) : null;
        endDate = (task as any).actualFinishDate ? new Date((task as any).actualFinishDate) : 
                 (task as any).baselineFinish ? new Date((task as any).baselineFinish) : 
                 task.endDate ? new Date(task.endDate) : null;
        dateType = "both";
      } else if (showActualDates) {
        startDate = (task as any).actualStartDate ? new Date((task as any).actualStartDate) : null;
        endDate = (task as any).actualFinishDate ? new Date((task as any).actualFinishDate) : null;
        dateType = "actual";
      } else if (showBaselineDates) {
        startDate = (task as any).baselineStart ? new Date((task as any).baselineStart) : null;
        endDate = (task as any).baselineFinish ? new Date((task as any).baselineFinish) : null;
        dateType = "baseline";
      } else {
        // Fallback to planned dates if neither is selected
        startDate = task.startDate ? new Date(task.startDate) : null;
        endDate = task.endDate ? new Date(task.endDate) : null;
      }

      if (!startDate || !endDate) return;

      // Normalize dates to start of day for comparison
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      // Find intersection of task date range with current month
      const rangeStart = start > monthStart ? start : monthStart;
      const rangeEnd = end < monthEnd ? end : monthEnd;

      if (rangeStart <= rangeEnd) {
        // Add task to all days it spans in this month
        for (let d = rangeStart.getDate(); d <= rangeEnd.getDate(); d++) {
          if (!taskMap.has(d)) taskMap.set(d, []);
          const dayTasks = taskMap.get(d)!;
          
          // Check if task already added to this day
          const existing = dayTasks.find(t => t.id === task.id);
          if (!existing) {
            const isStart = d === start.getDate() && start.getMonth() === month && start.getFullYear() === year;
            const isEnd = d === end.getDate() && end.getMonth() === month && end.getFullYear() === year;
            dayTasks.push({ ...task, _isStart: isStart, _isEnd: isEnd, _dateType: dateType } as any);
          }
        }
      }
    });
    
    return taskMap;
  }, [tasks, year, month, showActualDates, showBaselineDates]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(task => {
        if (!task.endDate) return false;
        const endDate = new Date(task.endDate);
        return endDate >= now && task.status !== "completed";
      })
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
      .slice(0, 5);
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

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view the calendar.
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-calendar">Calendar</h1>
          <p className="text-muted-foreground">Project timeline and milestones</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 border rounded-lg p-2">
            <Label className="text-sm font-medium">Date Types:</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-actual"
                  checked={showActualDates}
                  onCheckedChange={setShowActualDates}
                />
                <Label htmlFor="show-actual" className="text-sm cursor-pointer">Actual</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-baseline"
                  checked={showBaselineDates}
                  onCheckedChange={setShowBaselineDates}
                />
                <Label htmlFor="show-baseline" className="text-sm cursor-pointer">Baseline</Label>
              </div>
            </div>
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
      </div>

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
                        {dayTasks.slice(0, 3).map((task: any) => {
                          const isStart = task._isStart;
                          const isEnd = task._isEnd;
                          const isOngoing = !isStart && !isEnd;
                          const dateTypeLabel = task._dateType === "actual" ? "A" : task._dateType === "baseline" ? "B" : "";
                          
                          return (
                            <div
                              key={`${task.id}-${dayNumber}`}
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded text-white truncate cursor-pointer hover:opacity-80 flex items-center gap-1",
                                getStatusColor(task.status),
                                getPriorityBorder(task.priority)
                              )}
                              title={`${task.name}${isStart ? ' (Start)' : isEnd ? ' (End)' : ' (Ongoing)'}${dateTypeLabel ? ` [${dateTypeLabel}]` : ''}`}
                              onClick={() => handleTaskClick(task)}
                              data-testid={`calendar-task-${task.id}`}
                            >
                              {isStart ? "▶ " : isEnd ? "◼ " : "▸ "}
                              {task.name}
                              {dateTypeLabel && <span className="text-[10px] opacity-75">[{dateTypeLabel}]</span>}
                            </div>
                          );
                        })}
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
          <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
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
                  <div className={cn("w-1 h-12 rounded", getStatusColor(task.status))} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(task.endDate!).toLocaleDateString("en-US", { 
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
