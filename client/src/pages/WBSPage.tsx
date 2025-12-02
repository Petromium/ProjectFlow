import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TableRowCard } from "@/components/TableRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Filter, LayoutGrid, List, Calendar as CalendarIcon, 
  GanttChartSquare, AlertCircle, Plus, Clock, AlertTriangle, 
  Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X,
  Link2, CheckCircle2, Percent, Users, FileText, AlertOctagon, Trash2, ChevronDown, Activity,
  Calendar, MessageSquare, Settings, ChevronUp, User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { TaskModal } from "@/components/TaskModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Task, TaskDependency, Resource, Risk, Issue, Document, TaskRisk, TaskIssue, TaskDocument, ResourceAssignment, Conversation } from "@shared/schema";

type TaskStatus = "not-started" | "in-progress" | "review" | "completed" | "on-hold";
type ViewMode = "list" | "kanban" | "gantt" | "calendar";
type ZoomLevel = "day" | "week" | "month" | "quarter";

const KANBAN_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "not-started", title: "Not Started" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "In Review" },
  { id: "completed", title: "Completed" },
];

const ZOOM_CONFIGS: Record<ZoomLevel, { daysPerUnit: number; unitLabel: string; minUnitWidth: number }> = {
  day: { daysPerUnit: 1, unitLabel: "Day", minUnitWidth: 40 },
  week: { daysPerUnit: 7, unitLabel: "Week", minUnitWidth: 100 },
  month: { daysPerUnit: 30, unitLabel: "Month", minUnitWidth: 60 },
  quarter: { daysPerUnit: 90, unitLabel: "Quarter", minUnitWidth: 80 },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WBSPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [lastClickedTaskId, setLastClickedTaskId] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      // Slight delay to ensure data is ready or just open it
      setTimeout(() => setTaskModalOpen(true), 100);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("not-started");
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [disciplineFilters, setDisciplineFilters] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [baselineDateStart, setBaselineDateStart] = useState<string>("");
  const [baselineDateEnd, setBaselineDateEnd] = useState<string>("");
  const [actualDateStart, setActualDateStart] = useState<string>("");
  const [actualDateEnd, setActualDateEnd] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baselineDialogOpen, setBaselineDialogOpen] = useState(false);
  const [selectedResources, setSelectedResources] = useState<number[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<number[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Mouse drag state for Gantt chart panning
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
  
  // Drag and drop state for hierarchy
  const [draggedTaskIds, setDraggedTaskIds] = useState<number[]>([]);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null);
  
  // Gantt bar display settings
  const [ganttSettingsOpen, setGanttSettingsOpen] = useState(false);
  const [showBarStartDate, setShowBarStartDate] = useState(true);
  const [showBarEndDate, setShowBarEndDate] = useState(true);
  const [showBarProgress, setShowBarProgress] = useState(true);

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

  const { data: dependencies = [] } = useQuery<TaskDependency[]>({
    queryKey: [`/api/projects/${selectedProjectId}/dependencies`],
    enabled: !!selectedProjectId && viewMode === "gantt",
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: [`/api/projects/${selectedProjectId}/resources`],
    enabled: !!selectedProjectId,
  });

  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: [`/api/projects/${selectedProjectId}/risks`],
    enabled: !!selectedProjectId,
  });

  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: [`/api/projects/${selectedProjectId}/issues`],
    enabled: !!selectedProjectId,
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/projects/${selectedProjectId}/documents`],
    enabled: !!selectedProjectId,
  });

  // Fetch project users for assignment
  const { data: projectUsers = [] } = useQuery<Array<{ id: string; name: string; email?: string }>>({
    queryKey: [`/api/projects/${selectedProjectId}/users`],
    enabled: !!selectedProjectId,
  });

  // Fetch all task relationships for efficient count computation
  const { data: relationships } = useQuery<{
    taskRisks: TaskRisk[];
    taskIssues: TaskIssue[];
    taskDocuments: TaskDocument[];
    resourceAssignments: ResourceAssignment[];
    conversations: Conversation[];
  }>({
    queryKey: [`/api/projects/${selectedProjectId}/task-relationships`],
    enabled: !!selectedProjectId,
  });

  const taskRisks = relationships?.taskRisks || [];
  const taskIssues = relationships?.taskIssues || [];
  const taskDocuments = relationships?.taskDocuments || [];
  const resourceAssignments = relationships?.resourceAssignments || [];
  const conversations = relationships?.conversations || [];

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, ...updates }: { taskId: number; status?: TaskStatus; parentId?: number | null }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ taskIds, updates }: { taskIds: number[]; updates: { status?: TaskStatus; progress?: number } }) => {
      await apiRequest("POST", `/api/bulk/tasks/update`, { taskIds, updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      toast({ title: "Success", description: "Tasks updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update tasks", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      await apiRequest("POST", `/api/bulk/tasks/delete`, { taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      setDeleteDialogOpen(false);
      toast({ title: "Success", description: "Tasks deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete tasks", variant: "destructive" });
    },
  });

  const bulkDependencyMutation = useMutation({
    mutationFn: async ({ taskIds, action }: { taskIds: number[]; action: "chain-fs" | "set-ss" | "set-ff" | "clear" }) => {
      if (action === "clear") {
        await apiRequest("POST", `/api/bulk/dependencies/clear`, { taskIds });
      } else if (action === "chain-fs") {
        await apiRequest("POST", `/api/bulk/dependencies/chain`, { taskIds, type: "FS" });
      } else if (action === "set-ss") {
        await apiRequest("POST", `/api/bulk/dependencies/set-parallel`, { taskIds, type: "SS" });
      } else if (action === "set-ff") {
        await apiRequest("POST", `/api/bulk/dependencies/set-parallel`, { taskIds, type: "FF" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/dependencies`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      toast({ title: "Success", description: "Dependencies updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update dependencies", variant: "destructive" });
    },
  });

  const bulkResourceAssignMutation = useMutation({
    mutationFn: async ({ taskIds, resourceIds }: { taskIds: number[]; resourceIds: number[] }) => {
      await apiRequest("POST", `/api/bulk/resource-assignments`, { taskIds, resourceIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      setSelectedResources([]);
      toast({ title: "Success", description: "Resources assigned successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to assign resources", variant: "destructive" });
    },
  });

  const bulkUserAssignMutation = useMutation({
    mutationFn: async ({ taskIds, userIds }: { taskIds: number[]; userIds: string[] }) => {
      await apiRequest("POST", `/api/bulk/tasks/assign-users`, { taskIds, userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      setSelectedUsers([]);
      toast({ title: "Success", description: "Users assigned successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to assign users", variant: "destructive" });
    },
  });

  const bulkRiskLinkMutation = useMutation({
    mutationFn: async ({ taskIds, riskIds }: { taskIds: number[]; riskIds: number[] }) => {
      await apiRequest("POST", `/api/bulk/task-risks`, { taskIds, riskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      setSelectedRisks([]);
      toast({ title: "Success", description: "Risks linked successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to link risks", variant: "destructive" });
    },
  });

  const bulkIssueLinkMutation = useMutation({
    mutationFn: async ({ taskIds, issueIds }: { taskIds: number[]; issueIds: number[] }) => {
      await apiRequest("POST", `/api/bulk/task-issues`, { taskIds, issueIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      setSelectedIssues([]);
      toast({ title: "Success", description: "Issues linked successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to link issues", variant: "destructive" });
    },
  });

  const bulkRecalculateMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      const res = await apiRequest("POST", `/api/bulk/tasks/recalculate`, { taskIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      toast({ title: "Success", description: `Schedule recalculated for ${data.count} tasks` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to recalculate schedule", variant: "destructive" });
    },
  });

  const recalculateWBSMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${selectedProjectId}/tasks/recalculate-wbs`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      toast({ title: "Success", description: "WBS codes recalculated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to recalculate WBS", variant: "destructive" });
    },
  });

  const bulkBaselineMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      const res = await apiRequest("POST", `/api/bulk/tasks/baseline`, { taskIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      setSelectedTasks([]);
      toast({ 
        title: "Success", 
        description: `Baseline set for ${data.count} tasks` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to set baseline", variant: "destructive" });
    },
  });

  const uniqueDisciplines = useMemo(() => {
    const disciplines = new Set<string>();
    tasks.forEach(t => {
      if (t.discipline) disciplines.add(t.discipline);
    });
    return Array.from(disciplines).sort();
  }, [tasks]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilters.length > 0) count++;
    if (priorityFilters.length > 0) count++;
    if (disciplineFilters.length > 0) count++;
    if (dateRangeStart || dateRangeEnd) count++;
    if (baselineDateStart || baselineDateEnd) count++;
    if (actualDateStart || actualDateEnd) count++;
    return count;
  }, [statusFilters, priorityFilters, disciplineFilters, dateRangeStart, dateRangeEnd, baselineDateStart, baselineDateEnd, actualDateStart, actualDateEnd]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.wbsCode?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    if (statusFilters.length > 0) {
      result = result.filter(t => statusFilters.includes(t.status as TaskStatus));
    }

    if (priorityFilters.length > 0) {
      result = result.filter(t => t.priority && priorityFilters.includes(t.priority));
    }

    if (disciplineFilters.length > 0) {
      result = result.filter(t => t.discipline && disciplineFilters.includes(t.discipline));
    }

    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart);
      result = result.filter(t => t.startDate && new Date(t.startDate) >= startDate);
    }

    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd);
      result = result.filter(t => t.endDate && new Date(t.endDate) <= endDate);
    }

    if (baselineDateStart) {
      const startDate = new Date(baselineDateStart);
      result = result.filter(t => (t as any).baselineStart && new Date((t as any).baselineStart) >= startDate);
    }

    if (baselineDateEnd) {
      const endDate = new Date(baselineDateEnd);
      result = result.filter(t => (t as any).baselineFinish && new Date((t as any).baselineFinish) <= endDate);
    }

    if (actualDateStart) {
      const startDate = new Date(actualDateStart);
      result = result.filter(t => t.actualStartDate && new Date(t.actualStartDate) >= startDate);
    }

    if (actualDateEnd) {
      const endDate = new Date(actualDateEnd);
      result = result.filter(t => t.actualFinishDate && new Date(t.actualFinishDate) <= endDate);
    }

    return result;
  }, [tasks, searchQuery, statusFilters, priorityFilters, disciplineFilters, dateRangeStart, dateRangeEnd, baselineDateStart, baselineDateEnd, actualDateStart, actualDateEnd]);

  const clearFilters = () => {
    setStatusFilters([]);
    setPriorityFilters([]);
    setDisciplineFilters([]);
    setDateRangeStart("");
    setDateRangeEnd("");
    setBaselineDateStart("");
    setBaselineDateEnd("");
    setActualDateStart("");
    setActualDateEnd("");
  };

  const toggleStatusFilter = (status: TaskStatus) => {
    setStatusFilters(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const togglePriorityFilter = (priority: string) => {
    setPriorityFilters(prev => 
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  };

  const toggleDisciplineFilter = (discipline: string) => {
    setDisciplineFilters(prev => 
      prev.includes(discipline) ? prev.filter(d => d !== discipline) : [...prev, discipline]
    );
  };

  const flattenedTaskIds = useMemo(() => {
    const result: number[] = [];
    const flatten = (parentId: number | null) => {
      const children = filteredTasks.filter(t => t.parentId === parentId);
      children.sort((a, b) => (a.wbsCode || "").localeCompare(b.wbsCode || ""));
      children.forEach(task => {
        result.push(task.id);
        if (expandedTasks.includes(task.id)) {
          flatten(task.id);
        }
      });
    };
    flatten(null);
    return result;
  }, [filteredTasks, expandedTasks]);

  const handleSelectTask = (id: number, selected: boolean, shiftKey?: boolean) => {
    if (shiftKey && lastClickedTaskId !== null && lastClickedTaskId !== id) {
      const lastIndex = flattenedTaskIds.indexOf(lastClickedTaskId);
      const currentIndex = flattenedTaskIds.indexOf(id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = flattenedTaskIds.slice(start, end + 1);
        setSelectedTasks(prev => {
          const newSelection = new Set(prev);
          rangeIds.forEach(taskId => newSelection.add(taskId));
          return Array.from(newSelection);
        });
        setLastClickedTaskId(id);
        return;
      }
    }
    
    setSelectedTasks(prev => selected ? [...prev, id] : prev.filter(t => t !== id));
    setLastClickedTaskId(id);
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === flattenedTaskIds.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks([...flattenedTaskIds]);
    }
  };

  const handleToggleExpand = (id: number) => {
    setExpandedTasks(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleDeleteTask = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleAddTask = (status: TaskStatus = "not-started") => {
    setEditingTask(undefined);
    setDefaultStatus(status);
    setTaskModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in-progress": return "secondary";
      case "review": return "outline";
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

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in-progress": return "bg-blue-500";
      case "review": return "bg-purple-500";
      case "on-hold": return "bg-amber-500";
      default: return "bg-gray-400";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Helper functions to compute relationship counts
  const getTaskResourceCount = (taskId: number) => {
    return resourceAssignments.filter(ra => ra.taskId === taskId).length;
  };

  const getTaskRiskCount = (taskId: number) => {
    return taskRisks.filter(tr => tr.taskId === taskId).length;
  };

  const getTaskIssueCount = (taskId: number) => {
    return taskIssues.filter(ti => ti.taskId === taskId).length;
  };

  const getTaskDocumentCount = (taskId: number) => {
    return taskDocuments.filter(td => td.taskId === taskId).length;
  };

  const getTaskHasChat = (taskId: number) => {
    return conversations.some(c => c.taskId === taskId);
  };

  const getTaskDuration = (task: Task) => {
    if (task.computedDuration) return task.computedDuration;
    if (task.startDate && task.endDate) {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    return null;
  };

  const isOverdue = (task: Task) => {
    if (!task.endDate) return false;
    return new Date(task.endDate) < new Date() && task.status !== "completed";
  };

  const rootTasks = filteredTasks.filter(t => !t.parentId);
  const getChildren = (parentId: number) => filteredTasks.filter(t => t.parentId === parentId);

  const renderListTask = (task: Task, level = 0) => {
    const children = getChildren(task.id);
    const isExpanded = expandedTasks.includes(task.id);
    const hasChildren = children.length > 0;

    // Compute counts
    const resourceCount = getTaskResourceCount(task.id);
    const riskCount = getTaskRiskCount(task.id);
    const issueCount = getTaskIssueCount(task.id);
    const documentCount = getTaskDocumentCount(task.id);
    const hasChat = getTaskHasChat(task.id);
    const duration = getTaskDuration(task);

    // Format dates
    const startDate = task.startDate ? new Date(task.startDate) : null;
    const endDate = task.endDate ? new Date(task.endDate) : null;

    // Check if task has siblings below (for tree connector rendering)
    const hasSiblingsBelow = (() => {
      const parentId = task.parentId;
      const siblings = filteredTasks.filter(t => t.parentId === parentId);
      siblings.sort((a, b) => (a.wbsCode || "").localeCompare(b.wbsCode || ""));
      const taskIndex = siblings.findIndex(t => t.id === task.id);
      return taskIndex < siblings.length - 1;
    })();

    // Calculate connector line position based on level
    const connectorLeft = level > 0 ? (level - 1) * 24 + 12 : 0;

    return (
      <div key={task.id} className="relative">
        {/* Task row with increased indentation - tree lines removed */}
        <div className={cn(
          "relative z-10",
          level === 0 && "ml-0",
          level === 1 && "ml-6 sm:ml-8",      // 24px/32px
          level === 2 && "ml-12 sm:ml-16",    // 48px/64px
          level >= 3 && "ml-18 sm:ml-24"      // 72px/96px
        )}>
          <TableRowCard
            id={task.id.toString()}
            selected={selectedTasks.includes(task.id)}
            onSelect={(selected, shiftKey) => handleSelectTask(task.id, selected, shiftKey)}
            expanded={isExpanded}
            onToggleExpand={hasChildren ? () => handleToggleExpand(task.id) : undefined}
            expandable={hasChildren}
            draggable={selectedTasks.includes(task.id)}
            onDragStart={(e) => handleDragStartHierarchy(e, task.id)}
            onDragOver={(e) => handleDragOverHierarchy(e, task.id)}
            onDragLeave={handleDragLeaveHierarchy}
            onDrop={(e) => handleDropHierarchy(e, task.id)}
            className={cn(
              dragOverTaskId === task.id && "ring-2 ring-primary ring-offset-2",
              selectedTasks.includes(task.id) && "bg-accent/50"
            )}
            data-testid={`row-task-${task.id}`}
          >
            {/* Mobile: Reorganized Stack Layout - PM-focused */}
            <div className="sm:hidden space-y-2 cursor-pointer" onClick={() => handleEditTask(task)}>
              {/* Header Row: Name + Status + Priority */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-semibold text-sm leading-tight break-words">{task.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{task.wbsCode}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={getStatusColor(task.status)} className="text-xs h-5 px-2 shrink-0" data-testid={`badge-status-${task.id}`}>
                  {task.status.replace("-", " ")}
                </Badge>
                  <Badge variant={getPriorityColor(task.priority)} className="text-xs h-5 px-2 shrink-0" data-testid={`badge-priority-${task.id}`}>
                    {task.priority}
                  </Badge>
                </div>
              </div>

              {/* Metrics + Progress Row */}
              <div className="flex items-center gap-3">
                {/* Metrics icons on the left */}
                <div className="flex items-center gap-2 shrink-0">
                  {resourceCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${resourceCount} resource(s)`}>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{resourceCount}</span>
                </div>
                  )}
                  {riskCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${riskCount} risk(s)`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs text-amber-600 font-medium">{riskCount}</span>
                    </div>
                  )}
                  {issueCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${issueCount} issue(s)`}>
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-xs text-red-600 font-medium">{issueCount}</span>
                    </div>
                  )}
                  {documentCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${documentCount} document(s)`}>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{documentCount}</span>
                    </div>
                  )}
                  {hasChat && (
                    <div className="flex items-center gap-0.5" title="Has chat messages">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                  )}
                </div>
                
                {/* Progress bar */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 25, 50, 75, 100].map((threshold) => (
                      <div
                        key={threshold}
                        className={cn(
                          "w-1.5 h-5 rounded-sm transition-colors",
                          task.progress >= threshold ? "bg-primary" : "bg-accent/20"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium">{task.progress}%</span>
                </div>
              </div>

              {/* Baseline & Actual Dates Row */}
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {/* Baseline Dates */}
                {(task as any).baselineStart && (task as any).baselineFinish ? (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="font-medium text-[10px] w-12 shrink-0">Baseline</span>
                    <span>
                      {new Date((task as any).baselineStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                      {new Date((task as any).baselineFinish).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px]">-</span>
                    <span className="text-[10px]">
                      {Math.ceil((new Date((task as any).baselineFinish).getTime() - new Date((task as any).baselineStart).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                    </div>
                ) : null}
                
                {/* Actual Dates */}
                {task.actualStartDate && task.actualFinishDate ? (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="font-medium text-[10px] w-12 shrink-0">Actual</span>
                    <span>
                      {new Date(task.actualStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                      {new Date(task.actualFinishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px]">-</span>
                    <span className="text-[10px]">
                      {Math.ceil((new Date(task.actualFinishDate).getTime() - new Date(task.actualStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                ) : null}
                
                {/* Fallback to planned dates if no baseline/actual */}
                {!((task as any).baselineStart && (task as any).baselineFinish) && !(task.actualStartDate && task.actualFinishDate) && startDate && endDate ? (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="font-medium text-[10px] w-12 shrink-0">Planned</span>
                    <span>
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                      {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {duration && (
                      <>
                        <span className="text-[10px]">-</span>
                        <span className="text-[10px]">{duration} days</span>
                    </>
                  )}
                </div>
                ) : null}
              </div>

              {/* Assignee Row */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                {task.assignedTo ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarFallback className="text-[9px]">{getInitials(task.assignedTo)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">
                      {task.assignedToName || "Assigned"}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Unassigned</span>
                )}
              </div>
            </div>

            {/* Desktop: Left-aligned Task Name, Right-aligned Everything Else */}
            <div 
              className="hidden sm:flex items-center justify-between gap-4 flex-1 cursor-pointer min-w-0"
              onClick={() => handleEditTask(task)}
            >
              {/* Task Info - Left aligned, indentation handled by parent */}
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{task.name}</div>
                <div className="text-sm text-muted-foreground">{task.wbsCode}</div>
              </div>

              {/* Right Side: All other elements aligned to the right */}
              <div className="flex items-center gap-3 shrink-0">
              {/* Status Badge */}
                <Badge variant={getStatusColor(task.status)} className="h-5 px-2 shrink-0" data-testid={`badge-status-${task.id}`}>
                {task.status.replace("-", " ")}
              </Badge>

                {/* Priority/Risk Badge */}
                <Badge variant={getPriorityColor(task.priority)} className="h-5 px-2 shrink-0" data-testid={`badge-priority-${task.id}`}>
                  {task.priority}
                </Badge>

                {/* Metrics Icons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {resourceCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${resourceCount} resource(s)`}>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{resourceCount}</span>
                    </div>
                  )}
                  {riskCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${riskCount} risk(s)`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs text-amber-600 font-medium">{riskCount}</span>
                    </div>
                  )}
                  {issueCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${issueCount} issue(s)`}>
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-xs text-red-600 font-medium">{issueCount}</span>
                    </div>
                  )}
                  {documentCount > 0 && (
                    <div className="flex items-center gap-0.5" title={`${documentCount} document(s)`}>
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{documentCount}</span>
                    </div>
                  )}
                  {hasChat && (
                    <div className="flex items-center gap-0.5" title="Has chat messages">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                  )}
                </div>
                
                {/* Progress bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-0.5 shrink-0">
                    {[0, 25, 50, 75, 100].map((threshold) => (
                      <div
                        key={threshold}
                        className={cn(
                          "w-1 h-5 rounded-sm transition-colors",
                          task.progress >= threshold ? "bg-primary" : "bg-accent/20"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium w-10 text-right shrink-0">{task.progress}%</span>
              </div>

                {/* Baseline & Actual Dates */}
                <div className="text-xs text-muted-foreground min-w-[200px] flex flex-col items-end shrink-0 gap-0.5">
                  {/* Baseline Dates */}
                  {(task as any).baselineStart && (task as any).baselineFinish ? (
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="font-medium text-[10px] w-12 shrink-0">Baseline</span>
                      <span>
                        {new Date((task as any).baselineStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                        {new Date((task as any).baselineFinish).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[10px]">-</span>
                      <span className="text-[10px]">
                        {Math.ceil((new Date((task as any).baselineFinish).getTime() - new Date((task as any).baselineStart).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                  ) : null}
                  
                  {/* Actual Dates */}
                  {task.actualStartDate && task.actualFinishDate ? (
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="font-medium text-[10px] w-12 shrink-0">Actual</span>
                      <span>
                        {new Date(task.actualStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                        {new Date(task.actualFinishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[10px]">-</span>
                      <span className="text-[10px]">
                        {Math.ceil((new Date(task.actualFinishDate).getTime() - new Date(task.actualStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </span>
                  </div>
                ) : null}
                  
                  {/* Fallback to planned dates if no baseline/actual */}
                  {!((task as any).baselineStart && (task as any).baselineFinish) && !(task.actualStartDate && task.actualFinishDate) && startDate && endDate ? (
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="font-medium text-[10px] w-12 shrink-0">Planned</span>
                      <span>
                        {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                        {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                {duration && (
                        <>
                          <span className="text-[10px]">-</span>
                          <span className="text-[10px]">{duration} days</span>
                        </>
                )}
                    </div>
                  ) : null}
              </div>

              {/* Assignee */}
                <div className="flex items-center shrink-0">
                {task.assignedTo ? (
                  <>
                      <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-xs">{getInitials(task.assignedTo)}</AvatarFallback>
                    </Avatar>
                      <span className="text-sm text-muted-foreground truncate max-w-[80px] ml-1">
                      {task.assignedToName || "Assigned"}
                    </span>
                  </>
                ) : (
                    <span className="text-sm text-muted-foreground italic">Unassigned</span>
                )}
                </div>
              </div>
            </div>
          </TableRowCard>
        </div>
        {/* Render children in a wrapper to ensure vertical lines connect properly */}
        {isExpanded && children.length > 0 && (
          <div className="relative">
            {children.map((child, index) => (
              <div key={child.id} className="relative">
                {renderListTask(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId !== null) {
      const task = filteredTasks.find(t => t.id === draggedTaskId);
      if (task && task.status !== targetStatus) {
        updateTaskMutation.mutate({ taskId: draggedTaskId, status: targetStatus });
      }
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => setDraggedTaskId(null);

  // Drag handlers for hierarchy reorganization
  const handleDragStartHierarchy = (e: React.DragEvent, taskId: number) => {
    if (!selectedTasks.includes(taskId)) {
      setSelectedTasks([taskId]);
      setDraggedTaskIds([taskId]);
    } else {
      setDraggedTaskIds(selectedTasks);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId.toString());
    e.stopPropagation();
  };

  const handleDragOverHierarchy = (e: React.DragEvent, targetTaskId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent dropping on self or descendants
    const isDescendant = (taskId: number, ancestorId: number): boolean => {
      const task = filteredTasks.find(t => t.id === taskId);
      if (!task || !task.parentId) return false;
      if (task.parentId === ancestorId) return true;
      return isDescendant(task.parentId, ancestorId);
    };
    
    const canDrop = draggedTaskIds.every(id => 
      id !== targetTaskId && !isDescendant(targetTaskId, id)
    );
    
    if (canDrop) {
      setDragOverTaskId(targetTaskId);
      e.dataTransfer.dropEffect = "move";
    } else {
      setDragOverTaskId(null);
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleDragLeaveHierarchy = () => {
    setDragOverTaskId(null);
  };

  const handleDropHierarchy = async (e: React.DragEvent, targetTaskId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedTaskIds.length === 0 || dragOverTaskId !== targetTaskId) return;
    
    // Update parentId for all dragged tasks
    try {
      const updatePromises = draggedTaskIds.map(taskId => 
        updateTaskMutation.mutateAsync({ 
          taskId, 
          parentId: targetTaskId 
        })
      );
      
      await Promise.all(updatePromises);
      await recalculateWBSMutation.mutateAsync();
      toast({ title: "Success", description: `${draggedTaskIds.length} task(s) moved successfully` });
      setSelectedTasks([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to move tasks", variant: "destructive" });
    }
    
    setDraggedTaskIds([]);
    setDragOverTaskId(null);
    setDropTargetId(null);
  };

  const handleMakeChildOf = async (parentId: number) => {
    try {
      const updatePromises = selectedTasks.map(taskId => 
        updateTaskMutation.mutateAsync({ 
          taskId, 
          parentId 
        })
      );
      
      await Promise.all(updatePromises);
      await recalculateWBSMutation.mutateAsync();
      toast({ title: "Success", description: `${selectedTasks.length} task(s) moved successfully` });
      setSelectedTasks([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to move tasks", variant: "destructive" });
    }
  };

  const canMoveUp = (): boolean => {
    return selectedTasks.some(taskId => {
      const task = filteredTasks.find(t => t.id === taskId);
      return task && task.parentId !== null;
    });
  };

  const canMoveDown = (): boolean => {
    return selectedTasks.some(taskId => {
      const task = filteredTasks.find(t => t.id === taskId);
      if (!task || !task.parentId) return false;
      
      const siblings = filteredTasks
        .filter(t => t.parentId === task.parentId)
        .sort((a, b) => (a.wbsCode || "").localeCompare(b.wbsCode || ""));
      
      const taskIndex = siblings.findIndex(t => t.id === taskId);
      return taskIndex > 0; // Has previous sibling
    });
  };

  const handleMoveUpLevel = async () => {
    if (selectedTasks.length === 0 || !canMoveUp()) return;
    
    try {
      const updates = await Promise.all(
        selectedTasks.map(async (taskId) => {
          const task = filteredTasks.find(t => t.id === taskId);
          if (!task || !task.parentId) return null;
          
          const parent = filteredTasks.find(t => t.id === task.parentId);
          return {
            taskId,
            parentId: parent?.parentId || null
          };
        })
      );
      
      const validUpdates = updates.filter(u => u !== null) as { taskId: number; parentId: number | null }[];
      
      await Promise.all(validUpdates.map(update => 
        updateTaskMutation.mutateAsync({ 
          taskId: update.taskId, 
          parentId: update.parentId 
        })
      ));
      await recalculateWBSMutation.mutateAsync();
      toast({ title: "Success", description: "Tasks moved up level successfully" });
      setSelectedTasks([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to move tasks", variant: "destructive" });
    }
  };

  const handleMoveDownLevel = async () => {
    if (selectedTasks.length === 0 || !canMoveDown()) return;
    
    try {
      const updates = await Promise.all(
        selectedTasks.map(async (taskId) => {
          const task = filteredTasks.find(t => t.id === taskId);
          if (!task || !task.parentId) return null;
          
          const siblings = filteredTasks
            .filter(t => t.parentId === task.parentId)
            .sort((a, b) => (a.wbsCode || "").localeCompare(b.wbsCode || ""));
          
          const taskIndex = siblings.findIndex(t => t.id === taskId);
          if (taskIndex <= 0) return null;
          
          const previousSibling = siblings[taskIndex - 1];
          return {
            taskId,
            parentId: previousSibling.id
          };
        })
      );
      
      const validUpdates = updates.filter(u => u !== null) as { taskId: number; parentId: number }[];
      
      await Promise.all(validUpdates.map(update => 
        updateTaskMutation.mutateAsync({ 
          taskId: update.taskId, 
          parentId: update.parentId 
        })
      ));
      await recalculateWBSMutation.mutateAsync();
      toast({ title: "Success", description: "Tasks moved down level successfully" });
      setSelectedTasks([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to move tasks", variant: "destructive" });
    }
  };

  const groupedTasks: Record<TaskStatus, Task[]> = {
    "not-started": [],
    "in-progress": [],
    "review": [],
    "completed": [],
    "on-hold": [],
  };
  filteredTasks.forEach((task) => {
    if (groupedTasks[task.status as TaskStatus]) {
      groupedTasks[task.status as TaskStatus].push(task);
    }
  });

  const { minDate, maxDate, totalDays, units } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000), totalDays: 180, units: 6 };
    }
    let min = new Date();
    let max = new Date();
    filteredTasks.forEach(task => {
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
    return { minDate: min, maxDate: max, totalDays: daysDiff, units: Math.ceil(daysDiff / daysPerUnit) };
  }, [filteredTasks, zoom]);

  const timelineWidth = units * ZOOM_CONFIGS[zoom].minUnitWidth;
  const containerWidth = Math.max(1000, 300 + timelineWidth);

  const getTaskPosition = (task: Task) => {
    if (!task.startDate || !task.endDate) return { left: 0, width: 0 };
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const startOffset = Math.floor((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { left: (startOffset / totalDays) * 100, width: (duration / totalDays) * 100 };
  };

  const getBaselinePosition = (task: Task) => {
    if (!(task as any).baselineStart || !(task as any).baselineFinish) return null;
    const start = new Date((task as any).baselineStart);
    const end = new Date((task as any).baselineFinish);
    const startOffset = Math.floor((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { left: (startOffset / totalDays) * 100, width: (duration / totalDays) * 100 };
  };

  const getActualPosition = (task: Task) => {
    if (!task.actualStartDate || !task.actualFinishDate) return null;
    const start = new Date(task.actualStartDate);
    const end = new Date(task.actualFinishDate);
    const startOffset = Math.floor((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { left: (startOffset / totalDays) * 100, width: (duration / totalDays) * 100 };
  };

  const getUnitLabels = () => {
    const labels: ({ top: string; bottom: string } | string)[] = [];
    const { daysPerUnit, unitLabel } = ZOOM_CONFIGS[zoom];
    for (let i = 0; i < units; i++) {
      const unitDate = new Date(minDate.getTime() + i * daysPerUnit * 24 * 60 * 60 * 1000);
      if (zoom === "day") {
        labels.push({
          top: unitDate.toLocaleDateString("en-US", { weekday: "short" }),
          bottom: unitDate.toLocaleDateString("en-US", { day: "numeric" })
        });
      } else if (zoom === "week") {
        // Two-row header for week: Week number on top, date range on bottom
        const weekStart = new Date(unitDate);
        const weekEnd = new Date(unitDate.getTime() + 6 * 24 * 60 * 60 * 1000);
        labels.push({
          top: `W${i + 1}`,
          bottom: `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { day: "numeric" })}`
        });
      } else if (zoom === "month") {
        // Two-row header for month: Month name on top, year on bottom
        labels.push({
          top: unitDate.toLocaleDateString("en-US", { month: "short" }),
          bottom: unitDate.toLocaleDateString("en-US", { year: "numeric" })
        });
      } else {
        labels.push(`Q${Math.floor(unitDate.getMonth() / 3) + 1} ${unitDate.getFullYear()}`);
      }
    }
    return labels;
  };

  const handleZoomIn = () => { 
    if (zoom === "quarter") setZoom("month"); 
    else if (zoom === "month") setZoom("week"); 
    else if (zoom === "week") setZoom("day");
  };
  const handleZoomOut = () => { 
    if (zoom === "day") setZoom("week"); 
    else if (zoom === "week") setZoom("month"); 
    else if (zoom === "month") setZoom("quarter"); 
  };

  const renderGanttTask = (task: Task, level = 0): JSX.Element[] => {
    const children = getChildren(task.id);
    const baselinePos = getBaselinePosition(task);
    const actualPos = getActualPosition(task);
    const hasBaseline = baselinePos !== null;
    const hasActual = actualPos !== null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const priorityClass = task.priority === "critical" ? "border-l-4 border-l-red-500" : task.priority === "high" ? "border-l-4 border-l-orange-500" : "";
    
    // Calculate vertical positioning for two bars (Baseline + Actual)
    const barCount = [hasBaseline, hasActual].filter(Boolean).length;
    
    const elements: JSX.Element[] = [
      <div
        key={task.id}
        className={`grid grid-cols-[300px_1fr] items-center border-b border-border ${priorityClass}`}
        style={{ minHeight: '80px' }} // Increased row height to comfortably accommodate 3 bars
      >
        <div 
          className="flex items-center gap-2 py-4 pr-2 border-r border-border bg-card sticky left-0 z-30 h-full"
          style={{ paddingLeft: `${(level * 1.5) + 0.5}rem` }}
        >
          <Badge variant="outline" className="font-mono text-xs shrink-0">{task.wbsCode || `#${task.id}`}</Badge>
          <span className="text-sm font-medium truncate">{task.name}</span>
        </div>
        <div className="relative h-full bg-white dark:bg-gray-900 border-r border-border overflow-hidden">
          {/* Grid lines - optimized CSS-only approach with perfect alignment */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ 
              minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`,
              height: '100%',
              backgroundImage: `repeating-linear-gradient(
                to right,
                transparent 0,
                transparent calc(${ZOOM_CONFIGS[zoom].minUnitWidth}px - 1px),
                hsl(var(--border)) calc(${ZOOM_CONFIGS[zoom].minUnitWidth}px - 1px),
                hsl(var(--border)) ${ZOOM_CONFIGS[zoom].minUnitWidth}px
              )`,
              backgroundSize: `${ZOOM_CONFIGS[zoom].minUnitWidth}px 100%`,
              backgroundPosition: '0 0',
              backgroundRepeat: 'repeat'
            }}
          />
          <div 
            className="relative"
            style={{ 
              minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`, 
              height: '100%', 
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            
          {/* Baseline Bar (Top) - Approved plan with status colors and progress */}
          {hasBaseline ? (() => {
            // Calculate actual pixel width for comparison
            const baselineBarWidthPx = (baselinePos!.width / 100) * timelineWidth;
            const minWidthForDates = 150; // Minimum width to show dates inside bar
            const showDatesInside = baselineBarWidthPx > minWidthForDates;
            const baselineStartDate = new Date((task as any).baselineStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const baselineEndDate = new Date((task as any).baselineFinish).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              
              return (
              <>
                {/* Dates outside bar (left side) - shown when bar is too small */}
                {!showDatesInside && showBarStartDate && (
                  <div
                    className="absolute text-[10px] text-muted-foreground font-medium whitespace-nowrap z-10"
                    style={{
                      left: `${baselinePos!.left}%`,
                      top: hasActual ? 'calc(50% - 20px)' : 'calc(50% - 12px)',
                      transform: 'translateX(-100%)',
                      paddingRight: '4px'
                    }}
                  >
                    {baselineStartDate}
                  </div>
                )}
                
                {/* Baseline bar */}
                <div
                  className={`absolute h-6 rounded-md ${getStatusBgColor(task.status)} flex items-center px-2 text-white text-xs font-semibold shadow-md hover:shadow-lg cursor-pointer transition-all overflow-hidden z-10`}
                  style={{ 
                    left: `${baselinePos!.left}%`, 
                    width: `${baselinePos!.width}%`, 
                    minWidth: "40px",
                    top: hasActual ? 'calc(50% - 20px)' : 'calc(50% - 12px)',
                    maxWidth: '100%'
                  }}
                  onClick={() => handleEditTask(task)}
                  data-testid={`gantt-bar-baseline-${task.id}`}
                  title={`Baseline: ${baselineStartDate} - ${baselineEndDate}`}
                >
                  {/* Dates inside bar - shown when bar is wide enough */}
                  {showDatesInside && (
                    <div className="flex items-center justify-between w-full gap-1">
                      {showBarStartDate && (
                        <span className="truncate text-[10px]">{baselineStartDate}</span>
                      )}
                      {showBarProgress && (
                        <span className="truncate font-bold">{task.progress || 0}%</span>
                      )}
                      {showBarEndDate && (
                        <span className="truncate text-[10px]">{baselineEndDate}</span>
                  )}
                </div>
                  )}
                  {/* Progress overlay */}
                  <div className="absolute inset-0 bg-white/20 rounded-md pointer-events-none" style={{ width: `${task.progress || 0}%` }}></div>
                </div>
                
                {/* Dates outside bar (right side) - shown when bar is too small */}
                {!showDatesInside && showBarEndDate && (
                  <div
                    className="absolute text-[10px] text-muted-foreground font-medium whitespace-nowrap z-10"
                    style={{
                      left: `${baselinePos!.left + baselinePos!.width}%`,
                      top: hasActual ? 'calc(50% - 20px)' : 'calc(50% - 12px)',
                      paddingLeft: '4px'
                    }}
                  >
                    {baselineEndDate}
                  </div>
                )}
              </>
              );
          })() : null}

          {/* Actual Bar (Bottom) - Actual dates - ORANGE */}
          {hasActual ? (() => {
            // Calculate actual pixel width for comparison
            const actualBarWidthPx = (actualPos!.width / 100) * timelineWidth;
            const minWidthForDates = 150; // Minimum width to show dates inside bar
            const showDatesInside = actualBarWidthPx > minWidthForDates;
            const actualStartDate = new Date(task.actualStartDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const actualEndDate = new Date(task.actualFinishDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            
            return (
              <>
                {/* Dates outside bar (left side) - shown when bar is too small */}
                {!showDatesInside && showBarStartDate && (
                  <div
                    className="absolute text-[10px] text-muted-foreground font-medium whitespace-nowrap z-20"
                    style={{
                      left: `${actualPos!.left}%`,
                      top: hasBaseline ? 'calc(50% + 16px)' : 'calc(50% - 2px)',
                      transform: 'translateX(-100%)',
                      paddingRight: '4px'
                    }}
                  >
                    {actualStartDate}
          </div>
                )}
                
                {/* Actual bar */}
            <div
                  className="absolute h-4 bg-orange-500 border-2 border-orange-600 rounded-sm overflow-hidden z-20 shadow-sm flex items-center px-1"
                  style={{
                    left: `${actualPos!.left}%`,
                    width: `${actualPos!.width}%`,
                    top: hasBaseline ? 'calc(50% + 16px)' : 'calc(50% - 2px)',
                    minWidth: "24px",
                    maxWidth: '100%'
                  }}
                  title={`Actual: ${actualStartDate} - ${actualEndDate}`}
                >
                  {/* Dates inside bar - shown when bar is wide enough */}
                  {showDatesInside && (
                    <div className="flex items-center gap-1 text-[10px] text-white font-semibold w-full justify-between">
                      {showBarStartDate && (
                        <span className="truncate">{actualStartDate}</span>
                      )}
                      {showBarEndDate && (
                        <span className="truncate ml-auto">{actualEndDate}</span>
                      )}
            </div>
                  )}
                </div>
                
                {/* Dates outside bar (right side) - shown when bar is too small */}
                {!showDatesInside && showBarEndDate && (
                  <div
                    className="absolute text-[10px] text-muted-foreground font-medium whitespace-nowrap z-20"
                    style={{
                      left: `${actualPos!.left + actualPos!.width}%`,
                      top: hasBaseline ? 'calc(50% + 16px)' : 'calc(50% - 2px)',
                      paddingLeft: '4px'
                    }}
                  >
                    {actualEndDate}
                  </div>
                )}
              </>
            );
          })() : null}

          {/* No dates message - only show if no bars exist */}
          {!hasBaseline && !hasActual && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground z-10">No dates set</div>
          )}
          </div>
        </div>
      </div>
    ];
    children.forEach(child => elements.push(...renderGanttTask(child, level + 1)));
    return elements;
  };

  const { year, month, daysInMonth, startDay, today, monthName } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const todayDate = new Date();
    return {
      year: y, month: m, daysInMonth: lastDay.getDate(), startDay: firstDay.getDay(),
      today: todayDate.getFullYear() === y && todayDate.getMonth() === m ? todayDate.getDate() : -1,
      monthName: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [currentDate]);

  const tasksOnDate = useMemo(() => {
    const taskMap: Map<number, Task[]> = new Map();
    filteredTasks.forEach(task => {
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
          if (!existing) taskMap.get(day)!.push({ ...task, _isEnd: true } as any);
        }
      }
    });
    return taskMap;
  }, [filteredTasks, year, month]);

  const weeks = Math.ceil((daysInMonth + startDay) / 7);
  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  if (!selectedProjectId) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project from the dropdown above</p>
        </div>
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
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold" data-testid="page-title-wbs">Work Breakdown Structure</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage tasks and deliverables</p>
        </div>
        <Button 
          onClick={() => handleAddTask()} 
          data-testid="button-create-task"
          className="w-full sm:w-auto"
          size="sm"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Create Task</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load tasks. {(error as Error).message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry">Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search - Full width on mobile */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks..."
            className="pl-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-tasks"
          />
        </div>

        {/* View controls - Wrap on mobile */}
        <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="px-2 sm:px-3" data-testid="tab-view-list">
                <List className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="kanban" className="px-2 sm:px-3" data-testid="tab-view-kanban">
                <LayoutGrid className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="gantt" className="px-2 sm:px-3" data-testid="tab-view-gantt">
                <GanttChartSquare className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="calendar" className="px-2 sm:px-3" data-testid="tab-view-calendar">
                <CalendarIcon className="h-4 w-4" />
              </TabsTrigger>
          </TabsList>
        </Tabs>

          {/* Gantt zoom controls - Hide text on mobile */}
        {viewMode === "gantt" && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleZoomIn} disabled={zoom === "day"} data-testid="button-zoom-in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Badge variant="secondary" className="px-2 text-xs hidden sm:inline-flex">
                {ZOOM_CONFIGS[zoom].unitLabel}
              </Badge>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleZoomOut} disabled={zoom === "quarter"} data-testid="button-zoom-out">
                <ZoomOut className="h-4 w-4" />
              </Button>
          </div>
        )}

          {/* Calendar controls - Compact on mobile */}
        {viewMode === "calendar" && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" className="h-9 text-xs sm:text-sm" onClick={goToToday} data-testid="button-today">
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrevMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 sm:px-4 font-semibold text-xs sm:text-sm min-w-[120px] sm:min-w-[180px] text-center">
                {monthName}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
          </div>
        )}

          {/* Filter button */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 relative" data-testid="button-filter">
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          
          {/* Gantt Settings button - Only show in Gantt view */}
          {viewMode === "gantt" && (
            <Popover open={ganttSettingsOpen} onOpenChange={setGanttSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-gantt-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-4">
                  <h4 className="font-semibold">Gantt Bar Display</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-start-date" className="text-sm cursor-pointer">Show Start Date</Label>
                      <Checkbox 
                        id="show-start-date"
                        checked={showBarStartDate}
                        onCheckedChange={(checked) => setShowBarStartDate(checked === true)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-end-date" className="text-sm cursor-pointer">Show End Date</Label>
                      <Checkbox 
                        id="show-end-date"
                        checked={showBarEndDate}
                        onCheckedChange={(checked) => setShowBarEndDate(checked === true)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-progress" className="text-sm cursor-pointer">Show Progress %</Label>
                      <Checkbox 
                        id="show-progress"
                        checked={showBarProgress}
                        onCheckedChange={(checked) => setShowBarProgress(checked === true)}
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="h-3 w-3 mr-1" />Clear All
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {KANBAN_COLUMNS.map((col) => (
                    <div key={col.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`status-${col.id}`}
                        checked={statusFilters.includes(col.id)}
                        onCheckedChange={() => toggleStatusFilter(col.id)}
                        data-testid={`filter-status-${col.id}`}
                      />
                      <Label htmlFor={`status-${col.id}`} className="text-sm font-normal cursor-pointer">{col.title}</Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="status-on-hold"
                      checked={statusFilters.includes("on-hold")}
                      onCheckedChange={() => toggleStatusFilter("on-hold")}
                      data-testid="filter-status-on-hold"
                    />
                    <Label htmlFor="status-on-hold" className="text-sm font-normal cursor-pointer">On Hold</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["critical", "high", "medium", "low"].map((priority) => (
                    <div key={priority} className="flex items-center gap-2">
                      <Checkbox 
                        id={`priority-${priority}`}
                        checked={priorityFilters.includes(priority)}
                        onCheckedChange={() => togglePriorityFilter(priority)}
                        data-testid={`filter-priority-${priority}`}
                      />
                      <Label htmlFor={`priority-${priority}`} className="text-sm font-normal cursor-pointer capitalize">{priority}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {uniqueDisciplines.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Discipline</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {uniqueDisciplines.map((discipline) => (
                      <div key={discipline} className="flex items-center gap-2">
                        <Checkbox 
                          id={`discipline-${discipline}`}
                          checked={disciplineFilters.includes(discipline)}
                          onCheckedChange={() => toggleDisciplineFilter(discipline)}
                          data-testid={`filter-discipline-${discipline}`}
                        />
                        <Label htmlFor={`discipline-${discipline}`} className="text-sm font-normal cursor-pointer truncate">{discipline}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Planned Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start After</Label>
                    <Input 
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-date-start"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Before</Label>
                    <Input 
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-date-end"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Baseline Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start After</Label>
                    <Input 
                      type="date"
                      value={baselineDateStart}
                      onChange={(e) => setBaselineDateStart(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-baseline-date-start"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Before</Label>
                    <Input 
                      type="date"
                      value={baselineDateEnd}
                      onChange={(e) => setBaselineDateEnd(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-baseline-date-end"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Actual Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start After</Label>
                    <Input 
                      type="date"
                      value={actualDateStart}
                      onChange={(e) => setActualDateStart(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-actual-date-start"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Before</Label>
                    <Input 
                      type="date"
                      value={actualDateEnd}
                      onChange={(e) => setActualDateEnd(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="filter-actual-date-end"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground">
                Showing {filteredTasks.length} of {tasks.length} tasks
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      </div>

      {/* Selection Toolbar - Always visible */}
      <div className={cn(
        "bg-accent/5 border border-accent/20 rounded-lg p-3 sm:p-4 space-y-3",
        selectedTasks.length === 0 && "opacity-60"
      )}>
        {/* Mobile: Compact header */}
        <div className="flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-2">
          <Checkbox 
              checked={selectedTasks.length === flattenedTaskIds.length}
            onCheckedChange={handleSelectAll}
            data-testid="checkbox-select-all"
          />
            <span className="text-sm font-medium">{selectedTasks.length} selected</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedTasks([])}
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop: Full header */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedTasks.length === flattenedTaskIds.length}
              onCheckedChange={handleSelectAll}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm font-medium" data-testid="text-selection-count">
              {selectedTasks.length > 0 ? `${selectedTasks.length} tasks selected` : "Select tasks"}
          </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedTasks([])}
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4 mr-1" />Clear Selection
          </Button>
        </div>
        
        {/* Action buttons - Horizontal scroll on mobile, flex-wrap on desktop */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="flex gap-2 sm:flex-wrap min-w-max sm:min-w-0">
        {/* Dependencies Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length < 2}
                  className="shrink-0 justify-start"
              data-testid="dropdown-dependencies"
            >
              <Link2 className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Dependencies</span>
                  <span className="xs:hidden">Deps</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Link Selected Tasks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => bulkDependencyMutation.mutate({ taskIds: selectedTasks, action: "chain-fs" })}
              data-testid="menu-chain-fs"
            >
              Chain FS (Waterfall)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => bulkDependencyMutation.mutate({ taskIds: selectedTasks, action: "set-ss" })}
              data-testid="menu-set-ss"
            >
              Set SS (Start Together)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => bulkDependencyMutation.mutate({ taskIds: selectedTasks, action: "set-ff" })}
              data-testid="menu-set-ff"
            >
              Set FF (Finish Together)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => bulkDependencyMutation.mutate({ taskIds: selectedTasks, action: "clear" })}
              className="text-destructive"
              data-testid="menu-clear-deps"
            >
              Clear Dependencies
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
                  className="shrink-0"
              data-testid="dropdown-status"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Status
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Set Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => bulkUpdateMutation.mutate({ taskIds: selectedTasks, updates: { status: "not-started" } })}
              data-testid="menu-status-not-started"
            >
              Not Started
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => bulkUpdateMutation.mutate({ taskIds: selectedTasks, updates: { status: "in-progress" } })}
              data-testid="menu-status-in-progress"
            >
              In Progress
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => bulkUpdateMutation.mutate({ taskIds: selectedTasks, updates: { status: "on-hold" } })}
              data-testid="menu-status-on-hold"
            >
              On Hold
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => bulkUpdateMutation.mutate({ taskIds: selectedTasks, updates: { status: "completed" } })}
              data-testid="menu-status-completed"
            >
              Completed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Progress Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
                  className="shrink-0"
              data-testid="dropdown-progress"
            >
              <Percent className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Progress</span>
                  <span className="xs:hidden">%</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Set Progress</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[0, 25, 50, 75, 100].map(value => (
              <DropdownMenuItem 
                key={value}
                onClick={() => bulkUpdateMutation.mutate({ taskIds: selectedTasks, updates: { progress: value } })}
                data-testid={`menu-progress-${value}`}
              >
                {value}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Resources Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
                  className="shrink-0"
              data-testid="dropdown-resources"
            >
              <Users className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Resources</span>
                  <span className="xs:hidden">Res</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Assign Resources</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {resources.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No resources available</div>
            ) : (
              <>
                {resources.map(resource => (
                  <DropdownMenuCheckboxItem
                    key={resource.id}
                    checked={selectedResources.includes(resource.id)}
                    onCheckedChange={(checked) => {
                      setSelectedResources(prev => 
                        checked ? [...prev, resource.id] : prev.filter(id => id !== resource.id)
                      );
                    }}
                    data-testid={`menu-resource-${resource.id}`}
                  >
                    {resource.name}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedResources.length === 0}
                  onClick={() => bulkResourceAssignMutation.mutate({ taskIds: selectedTasks, resourceIds: selectedResources })}
                  className="font-medium"
                  data-testid="menu-apply-resources"
                >
                  Apply ({selectedResources.length} selected)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Users Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
              className="shrink-0"
              data-testid="dropdown-users"
            >
              <User className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Assign Users</span>
              <span className="xs:hidden">Users</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Assign Users</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {projectUsers.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No users available</div>
            ) : (
              <>
                {projectUsers.map(user => (
                  <DropdownMenuCheckboxItem
                    key={user.id}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => {
                      setSelectedUsers(prev => 
                        checked ? [...prev, user.id] : prev.filter(id => id !== user.id)
                      );
                    }}
                    data-testid={`menu-user-${user.id}`}
                  >
                    {user.name} {user.email && <span className="text-muted-foreground">({user.email})</span>}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedUsers.length === 0}
                  onClick={() => bulkUserAssignMutation.mutate({ taskIds: selectedTasks, userIds: selectedUsers })}
                  className="font-medium"
                  data-testid="menu-apply-users"
                >
                  Apply ({selectedUsers.length} selected)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Risks Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
                  className="shrink-0"
              data-testid="dropdown-risks"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Risks
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Link Risks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {risks.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No risks available</div>
            ) : (
              <>
                {risks.map(risk => (
                  <DropdownMenuCheckboxItem
                    key={risk.id}
                    checked={selectedRisks.includes(risk.id)}
                    onCheckedChange={(checked) => {
                      setSelectedRisks(prev => 
                        checked ? [...prev, risk.id] : prev.filter(id => id !== risk.id)
                      );
                    }}
                    data-testid={`menu-risk-${risk.id}`}
                  >
                    {risk.code}: {risk.title}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedRisks.length === 0}
                  onClick={() => bulkRiskLinkMutation.mutate({ taskIds: selectedTasks, riskIds: selectedRisks })}
                  className="font-medium"
                  data-testid="menu-apply-risks"
                >
                  Apply ({selectedRisks.length} selected)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Issues Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
                  className="shrink-0"
              data-testid="dropdown-issues"
            >
              <AlertOctagon className="h-4 w-4 mr-1" />
              Issues
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel>Link Issues</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {issues.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No issues available</div>
            ) : (
              <>
                {issues.map(issue => (
                  <DropdownMenuCheckboxItem
                    key={issue.id}
                    checked={selectedIssues.includes(issue.id)}
                    onCheckedChange={(checked) => {
                      setSelectedIssues(prev => 
                        checked ? [...prev, issue.id] : prev.filter(id => id !== issue.id)
                      );
                    }}
                    data-testid={`menu-issue-${issue.id}`}
                  >
                    {issue.code}: {issue.title}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedIssues.length === 0}
                  onClick={() => bulkIssueLinkMutation.mutate({ taskIds: selectedTasks, issueIds: selectedIssues })}
                  className="font-medium"
                  data-testid="menu-apply-issues"
                >
                  Apply ({selectedIssues.length} selected)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hierarchy Management Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={selectedTasks.length === 0}
              className="shrink-0"
              data-testid="dropdown-hierarchy"
            >
              <ChevronDown className="h-4 w-4 mr-1 rotate-[-90deg]" />
              <span className="hidden xs:inline">Make Child Of</span>
              <span className="xs:hidden">Child</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto w-64">
            <DropdownMenuLabel>Select Parent Task</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filteredTasks
              .filter(t => !selectedTasks.includes(t.id)) // Can't be parent of self
              .map(task => (
                <DropdownMenuItem
                  key={task.id}
                  onClick={() => handleMakeChildOf(task.id)}
                  data-testid={`menu-parent-${task.id}`}
                >
                  <span className="font-mono text-xs mr-2">{task.wbsCode || `#${task.id}`}</span>
                  <span className="truncate">{task.name}</span>
                </DropdownMenuItem>
              ))}
            {filteredTasks.filter(t => !selectedTasks.includes(t.id)).length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No available parent tasks</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Move Up Level Button */}
        <Button 
          variant="outline" 
          size="sm" 
          disabled={selectedTasks.length === 0 || !canMoveUp()}
          onClick={handleMoveUpLevel}
          className="shrink-0"
          data-testid="button-move-up-level"
          title="Move selected tasks up one level (promote)"
        >
          <ChevronUp className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline">Move Up Level</span>
          <span className="xs:hidden">Up</span>
        </Button>

        {/* Move Down Level Button */}
        <Button 
          variant="outline" 
          size="sm" 
          disabled={selectedTasks.length === 0 || !canMoveDown()}
          onClick={handleMoveDownLevel}
          className="shrink-0"
          data-testid="button-move-down-level"
          title="Move selected tasks down one level (demote)"
        >
          <ChevronDown className="h-4 w-4 mr-1" />
          <span className="hidden xs:inline">Move Down Level</span>
          <span className="xs:hidden">Down</span>
        </Button>

            {/* Recalculate Button */}
        <Button 
          variant="outline" 
          size="sm" 
              disabled={selectedTasks.length === 0 || bulkRecalculateMutation.isPending}
              onClick={() => bulkRecalculateMutation.mutate(selectedTasks)}
              className="shrink-0"
              data-testid="button-recalculate-schedule"
        >
              <Loader2 className={cn("h-4 w-4 mr-1", bulkRecalculateMutation.isPending && "animate-spin")} />
              <span className="hidden xs:inline">Recalculate</span>
              <span className="xs:hidden">Recalc</span>
        </Button>

            {/* Set Baseline Button */}
          <Button 
              variant="outline"
            size="sm"
              disabled={selectedTasks.length === 0 || bulkBaselineMutation.isPending}
              onClick={() => setBaselineDialogOpen(true)}
              className="shrink-0"
              data-testid="button-set-baseline"
          >
              <Clock className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Set Baseline</span>
              <span className="xs:hidden">Baseline</span>
          </Button>

            {/* Delete Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={selectedTasks.length === 0 || deleteMutation.isPending}
              onClick={() => setDeleteDialogOpen(true)}
              className="shrink-0 text-destructive hover:text-destructive"
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTasks.length} tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected tasks and all their subtasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedTasks)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Baseline Confirmation Dialog */}
      <AlertDialog open={baselineDialogOpen} onOpenChange={setBaselineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Baseline for {selectedTasks.length} tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the baseline dates to match current planned dates for the selected tasks.
              <br /><br />
              <strong>Note:</strong> Completed tasks (100% progress) will be ignored. To include them, change their progress to less than 100%.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-baseline">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkBaselineMutation.mutate(selectedTasks);
                setBaselineDialogOpen(false);
              }}
              data-testid="button-confirm-baseline"
            >
              {bulkBaselineMutation.isPending ? "Setting Baseline..." : "Proceed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewMode === "list" && (
        filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">No Tasks Found</h2>
            <p className="text-muted-foreground mb-4">Get started by creating your first task</p>
            <Button onClick={() => handleAddTask()} data-testid="button-create-first-task">Create Task</Button>
          </div>
        ) : (
          <div className="space-y-2">{rootTasks.map(task => renderListTask(task))}</div>
        )
      )}

      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-h-[500px]">
          {KANBAN_COLUMNS.map((column) => (
            <div 
              key={column.id} 
              className="flex flex-col min-h-[400px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              data-testid={`column-${column.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="secondary" data-testid={`count-${column.id}`}>{groupedTasks[column.id].length}</Badge>
                </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {groupedTasks[column.id].map((task) => (
                  <Card
                    key={task.id}
                    className={`cursor-grab active:cursor-grabbing hover-elevate active-elevate-2 transition-all ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleEditTask(task)}
                    data-testid={`kanban-card-${task.id}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs" data-testid={`task-code-${task.id}`}>{task.wbsCode || `T-${task.id}`}</Badge>
                        {isOverdue(task) && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      </div>
                      <h4 className="font-medium text-sm leading-tight" data-testid={`task-name-${task.id}`}>{task.name}</h4>
                      {task.progress !== undefined && task.progress > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{task.progress}%</span></div>
                          <Progress value={task.progress} className="h-1.5" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant={task.priority === "critical" ? "destructive" : task.priority === "high" ? "default" : "outline"} className="text-xs">{task.priority}</Badge>
                        <div className="flex items-center gap-2">
                          {task.endDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(task.endDate).toLocaleDateString()}
                            </div>
                          )}
                          {task.assignedTo && (
                            <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{getInitials(task.assignedTo)}</AvatarFallback></Avatar>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" className="w-full border-dashed" onClick={() => handleAddTask(column.id)} data-testid={`button-add-card-${column.id}`}>
                  <Plus className="h-4 w-4 mr-2" />Add Task
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "gantt" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Project Timeline ({filteredTasks.length} tasks)</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold mb-2">No Tasks Yet</h2>
                <p className="text-muted-foreground">Create tasks with start and end dates to see them on the Gantt chart</p>
              </div>
            ) : (
              <div 
                ref={ganttScrollRef}
                className="overflow-x-auto cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => {
                  if (ganttScrollRef.current && e.button === 0) {
                    setIsDragging(true);
                    setDragStart({
                      x: e.pageX,
                      scrollLeft: ganttScrollRef.current.scrollLeft
                    });
                    e.preventDefault();
                  }
                }}
                onMouseMove={(e) => {
                  if (!isDragging || !ganttScrollRef.current) return;
                  e.preventDefault();
                  const walk = (e.pageX - dragStart.x) * 2; // Scroll speed multiplier
                  ganttScrollRef.current.scrollLeft = dragStart.scrollLeft - walk;
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <div className="min-w-[1000px]" style={{ minWidth: `${containerWidth}px` }}>
                  <div className="grid grid-cols-[300px_1fr] mb-4 border border-border rounded-lg overflow-hidden bg-card">
                    <div className="bg-card p-3 font-semibold text-sm border-r border-border sticky left-0 z-10">Task</div>
                    <div className="bg-card overflow-x-hidden">
                      {zoom === "day" ? (
                        <div className="border-b border-border">
                          <div 
                            className="grid text-center text-xs font-semibold border-b border-border/50 bg-muted/30" 
                            style={{ 
                              gridTemplateColumns: `repeat(${units}, 1fr)`,
                              minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`
                            }}
                          >
                            {getUnitLabels().map((label, i) => (
                              <div key={`top-${i}`} className="p-1 border-l border-border last:border-r-0 truncate text-muted-foreground">
                                {typeof label === 'object' ? label.top : ''}
                              </div>
                        ))}
                      </div>
                          <div 
                            className="grid text-center text-sm font-semibold" 
                            style={{ 
                              gridTemplateColumns: `repeat(${units}, 1fr)`,
                              minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`
                            }}
                          >
                            {getUnitLabels().map((label, i) => (
                              <div key={`bottom-${i}`} className="p-1 border-l border-border last:border-r-0">
                                {typeof label === 'object' ? label.bottom : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        // Two-row headers for week and month views
                        (zoom === "week" || zoom === "month") ? (
                          <div className="border-b border-border">
                            <div 
                              className="grid text-center text-xs font-semibold border-b border-border/50 bg-muted/30" 
                              style={{ 
                                gridTemplateColumns: `repeat(${units}, 1fr)`,
                                minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`
                              }}
                            >
                              {getUnitLabels().map((label, i) => (
                                <div key={`top-${i}`} className="p-1 border-l border-border last:border-r-0 truncate text-muted-foreground">
                                  {typeof label === 'object' ? label.top : ''}
                                </div>
                              ))}
                            </div>
                            <div 
                              className="grid text-center text-sm font-semibold" 
                              style={{ 
                                gridTemplateColumns: `repeat(${units}, 1fr)`,
                                minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`
                              }}
                            >
                              {getUnitLabels().map((label, i) => (
                                <div key={`bottom-${i}`} className="p-1 border-l border-border last:border-r-0">
                                  {typeof label === 'object' ? label.bottom : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="grid text-center text-sm font-semibold border-b border-border" 
                            style={{ 
                              gridTemplateColumns: `repeat(${units}, 1fr)`,
                              minWidth: `${units * ZOOM_CONFIGS[zoom].minUnitWidth}px`
                            }}
                          >
                            {getUnitLabels().map((label, i) => (
                              <div key={i} className="p-3 border-l border-border last:border-r-0 truncate">
                                {typeof label === 'string' ? label : ''}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">{rootTasks.map(task => renderGanttTask(task))}</div>
                  <div className="sticky bottom-0 mt-6 p-4 bg-accent/5 border border-accent/20 rounded-lg backdrop-blur-sm bg-background/95 z-50 shadow-lg">
                    <h3 className="text-sm font-semibold mb-3">Legend</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Task Status Colors</h4>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500"></div><span>Completed</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-500"></div><span>In Progress</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-purple-500"></div><span>In Review</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-amber-500"></div><span>On Hold</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-400"></div><span>Not Started</span></div>
                    </div>
                  </div>
                      <div>
                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Gantt Bars</h4>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-6 rounded bg-blue-500"></div>
                            <span>Baseline (Approved Plan)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-3 rounded bg-orange-500 border border-orange-600"></div>
                            <span>Actual (Actual Start/Finish)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === "calendar" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Monthly View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {WEEKDAYS.map((day) => (
                <div key={day} className="bg-card border border-border p-3 text-center text-sm font-semibold">{day}</div>
              ))}
              {Array.from({ length: weeks * 7 }).map((_, index) => {
                const dayNumber = index - startDay + 1;
                const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
                const isToday = dayNumber === today;
                const dayTasks = tasksOnDate.get(dayNumber) || [];
                return (
                  <div
                    key={index}
                    className={cn("bg-background p-2 min-h-28", isToday && "ring-2 ring-primary ring-inset", !isValidDay && "bg-accent/5")}
                    data-testid={isValidDay ? `calendar-day-${dayNumber}` : undefined}
                  >
                    {isValidDay && (
                      <>
                        <div className={cn("text-sm font-semibold mb-2", isToday && "text-primary")}>{dayNumber}</div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((task: any) => (
                            <div
                              key={`${task.id}-${task._isStart ? 'start' : 'end'}`}
                              className={cn("text-xs px-1.5 py-0.5 rounded text-white truncate cursor-pointer hover:opacity-80", getStatusBgColor(task.status))}
                              title={`${task.name} (${task._isStart ? 'Start' : 'Due'})`}
                              onClick={() => handleEditTask(task)}
                              data-testid={`calendar-task-${task.id}`}
                            >
                              {task._isStart ? "▶ " : "◼ "}{task.name}
                            </div>
                          ))}
                          {dayTasks.length > 3 && <div className="text-xs text-muted-foreground">+{dayTasks.length - 3} more</div>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}

