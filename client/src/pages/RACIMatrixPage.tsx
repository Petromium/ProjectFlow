import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  Users, 
  FolderTree, 
  Search, 
  ChevronRight, 
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  User,
  Briefcase,
  Download,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { useLocation } from "wouter";
import Papa from "papaparse";
import type { Task, Stakeholder, StakeholderRaci, Resource } from "@shared/schema";

type RaciRole = "R" | "A" | "C" | "I";

interface Person {
  id: number;
  name: string;
  type: "stakeholder" | "resource";
  role?: string;
  organization?: string;
}

const RACI_COLUMNS: { key: RaciRole; label: string; description: string; color: string }[] = [
  { key: "R", label: "Responsible", description: "Does the work to complete the task", color: "bg-blue-500 text-white" },
  { key: "A", label: "Accountable", description: "Ultimately answerable for the task", color: "bg-green-500 text-white" },
  { key: "C", label: "Consulted", description: "Provides input before work is done", color: "bg-yellow-500 text-black" },
  { key: "I", label: "Informed", description: "Kept up-to-date on progress", color: "bg-purple-500 text-white" },
];

function PersonMultiSelect({
  selectedPeople,
  allPeople,
  onSelectionChange,
  raciRole,
  taskId,
  isInherited,
  hasParent,
  onResetToInherited,
  disabled,
}: {
  selectedPeople: Person[];
  allPeople: Person[];
  onSelectionChange: (people: Person[]) => void;
  raciRole: RaciRole;
  taskId: number;
  isInherited: boolean;
  hasParent: boolean;
  onResetToInherited?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const showAccountableWarning = raciRole === "A" && selectedPeople.length > 1;
  const showResetButton = hasParent && !isInherited && selectedPeople.length > 0 && onResetToInherited;

  const handleTogglePerson = (person: Person) => {
    const isSelected = selectedPeople.some(p => p.id === person.id && p.type === person.type);
    if (isSelected) {
      onSelectionChange(selectedPeople.filter(p => !(p.id === person.id && p.type === person.type)));
    } else {
      onSelectionChange([...selectedPeople, person]);
    }
  };

  const stakeholders = allPeople.filter(p => p.type === "stakeholder");
  const resources = allPeople.filter(p => p.type === "resource");

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`w-full justify-start text-left font-normal min-h-[36px] ${
              isInherited ? "border-dashed bg-muted/50" : ""
            } ${showAccountableWarning ? "border-amber-500" : ""}`}
            disabled={disabled}
            data-testid={`raci-cell-${taskId}-${raciRole}`}
          >
            {selectedPeople.length === 0 ? (
              <span className="text-muted-foreground text-xs">Select...</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedPeople.slice(0, 2).map((person) => (
                  <Badge 
                    key={`${person.type}-${person.id}`} 
                    variant="secondary" 
                    className={`text-[10px] px-1 py-0 ${isInherited ? "opacity-70" : ""}`}
                  >
                    {person.type === "resource" && <Briefcase className="h-2 w-2 mr-0.5" />}
                    {person.name.split(" ")[0]}
                  </Badge>
                ))}
                {selectedPeople.length > 2 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    +{selectedPeople.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No people found.</CommandEmpty>
              {stakeholders.length > 0 && (
                <CommandGroup heading="Stakeholders">
                  {stakeholders.map((person) => {
                    const isSelected = selectedPeople.some(p => p.id === person.id && p.type === person.type);
                    return (
                      <CommandItem
                        key={`stakeholder-${person.id}`}
                        onSelect={() => handleTogglePerson(person)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <User className="h-3 w-3 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{person.name}</div>
                            {person.role && (
                              <div className="text-[10px] text-muted-foreground truncate">{person.role}</div>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {resources.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Resources">
                    {resources.map((person) => {
                      const isSelected = selectedPeople.some(p => p.id === person.id && p.type === person.type);
                      return (
                        <CommandItem
                          key={`resource-${person.id}`}
                          onSelect={() => handleTogglePerson(person)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                            <Briefcase className="h-3 w-3 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{person.name}</div>
                              {person.role && (
                                <div className="text-[10px] text-muted-foreground truncate">{person.role}</div>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
          {showResetButton && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  onResetToInherited!();
                  setOpen(false);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to parent
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {showAccountableWarning && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-1 -right-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Warning: Multiple people accountable. Best practice is one person per task.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {isInherited && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -bottom-1 -left-1">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Inherited from parent task</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

export default function RACIMatrixPage() {
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [showHorizontalScrollHint, setShowHorizontalScrollHint] = useState(true);

  const projectId = selectedProject?.id;

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: Boolean(projectId),
  });

  // Fetch stakeholders
  const { data: stakeholders = [], isLoading: stakeholdersLoading } = useQuery<Stakeholder[]>({
    queryKey: ["/api/projects", projectId, "stakeholders"],
    enabled: Boolean(projectId),
  });

  // Fetch resources (human type only for RACI)
  const { data: resources = [], isLoading: resourcesLoading } = useQuery<Resource[]>({
    queryKey: ["/api/projects", projectId, "resources"],
    enabled: Boolean(projectId),
  });

  // Fetch RACI assignments
  const { data: raciAssignments = [], isLoading: raciLoading } = useQuery<StakeholderRaci[]>({
    queryKey: ["/api/projects", projectId, "raci"],
    enabled: Boolean(projectId),
  });

  // Combine stakeholders and human resources into unified people list
  const allPeople: Person[] = useMemo(() => {
    const people: Person[] = [];
    stakeholders.forEach(s => {
      people.push({
        id: s.id,
        name: s.name,
        type: "stakeholder",
        role: s.role,
        organization: s.organization || undefined,
      });
    });
    resources.filter(r => r.type === "human").forEach(r => {
      people.push({
        id: r.id,
        name: r.name,
        type: "resource",
        role: r.discipline || undefined,
      });
    });
    return people;
  }, [stakeholders, resources]);

  // Build RACI lookup: { taskId: { raciRole: Person[] } }
  const raciByTask = useMemo(() => {
    const map: Map<number, Map<RaciRole, { people: Person[]; isInherited: boolean }>> = new Map();
    
    raciAssignments.forEach((raci) => {
      if (!map.has(raci.taskId)) {
        map.set(raci.taskId, new Map());
      }
      const taskMap = map.get(raci.taskId)!;
      const role = raci.raciType as RaciRole;
      
      if (!taskMap.has(role)) {
        taskMap.set(role, { people: [], isInherited: raci.isInherited || false });
      }
      
      const roleData = taskMap.get(role)!;
      
      // Find the person
      if (raci.stakeholderId) {
        const stakeholder = stakeholders.find(s => s.id === raci.stakeholderId);
        if (stakeholder) {
          roleData.people.push({
            id: stakeholder.id,
            name: stakeholder.name,
            type: "stakeholder",
            role: stakeholder.role,
            organization: stakeholder.organization || undefined,
          });
        }
      } else if (raci.resourceId) {
        const resource = resources.find(r => r.id === raci.resourceId);
        if (resource) {
          roleData.people.push({
            id: resource.id,
            name: resource.name,
            type: "resource",
            role: resource.discipline || undefined,
          });
        }
      }
    });
    
    return map;
  }, [raciAssignments, stakeholders, resources]);

  // Upsert RACI mutation
  const updateRaciMutation = useMutation({
    mutationFn: async ({ 
      taskId, 
      raciType, 
      people,
      isInherited = false,
      inheritedFromTaskId = null,
    }: { 
      taskId: number; 
      raciType: RaciRole;
      people: Person[];
      isInherited?: boolean;
      inheritedFromTaskId?: number | null;
    }) => {
      if (!projectId) throw new Error("No project selected");
      
      // First, delete all existing assignments for this task+role
      const existingForRole = raciAssignments.filter(
        r => r.taskId === taskId && r.raciType === raciType
      );
      
      for (const existing of existingForRole) {
        await apiRequest("DELETE", `/api/raci/${existing.id}`);
      }
      
      // Then create new assignments for each person
      for (const person of people) {
        await apiRequest("POST", "/api/raci", {
          projectId,
          taskId,
          raciType,
          stakeholderId: person.type === "stakeholder" ? person.id : null,
          resourceId: person.type === "resource" ? person.id : null,
          isInherited,
          inheritedFromTaskId,
        });
      }
      
      return { taskId, raciType, people };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "raci"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get people assigned to a task for a specific RACI role
  const getAssignedPeople = useCallback((taskId: number, role: RaciRole): { people: Person[]; isInherited: boolean } => {
    const taskMap = raciByTask.get(taskId);
    if (!taskMap) return { people: [], isInherited: false };
    return taskMap.get(role) || { people: [], isInherited: false };
  }, [raciByTask]);

  // Reset RACI to inherited mutation
  const resetRaciMutation = useMutation({
    mutationFn: async ({ taskId, raciType }: { taskId: number; raciType: RaciRole }) => {
      if (!projectId) throw new Error("No project selected");
      await apiRequest("POST", "/api/raci/reset", { taskId, raciType, projectId });
      return { taskId, raciType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "raci"] });
      toast({
        title: "Reset Successful",
        description: "RACI assignment has been reset to inherit from parent task.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle selection change
  const handleSelectionChange = useCallback((taskId: number, role: RaciRole, people: Person[]) => {
    // Show warning toast for multiple Accountable
    if (role === "A" && people.length > 1) {
      toast({
        title: "Multiple Accountable Warning",
        description: "Best practice is to have only one person Accountable per task. Consider reviewing this assignment.",
        variant: "default",
      });
    }
    updateRaciMutation.mutate({ taskId, raciType: role, people });
  }, [updateRaciMutation, toast]);

  // Handle reset to inherited
  const handleResetToInherited = useCallback((taskId: number, role: RaciRole) => {
    resetRaciMutation.mutate({ taskId, raciType: role });
  }, [resetRaciMutation]);

  // Filter tasks by search
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const search = searchTerm.toLowerCase();
    return tasks.filter(
      t => t.name.toLowerCase().includes(search) || 
           t.wbsCode.toLowerCase().includes(search)
    );
  }, [tasks, searchTerm]);

  // Build tree structure
  const rootTasks = useMemo(() => {
    return filteredTasks
      .filter(t => !t.parentId)
      .sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }));
  }, [filteredTasks]);

  const getChildren = useCallback((parentId: number) => {
    return filteredTasks
      .filter(t => t.parentId === parentId)
      .sort((a, b) => a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true }));
  }, [filteredTasks]);

  const toggleExpand = useCallback((taskId: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedTasks(new Set(tasks.map(t => t.id)));
  }, [tasks]);

  const collapseAll = useCallback(() => {
    setExpandedTasks(new Set());
  }, []);

  // Export RACI matrix to CSV
  const handleExportCSV = useCallback(() => {
    if (!selectedProject) {
      toast({
        title: "Error",
        description: "No project selected",
        variant: "destructive",
      });
      return;
    }

    // Build flat list of all tasks with their RACI assignments
    const exportData: Array<{
      "WBS Code": string;
      "Task Name": string;
      "Level": number;
      "Responsible": string;
      "Accountable": string;
      "Consulted": string;
      "Informed": string;
      "Inherited": string;
    }> = [];

    const buildExportRow = (task: Task, level: number) => {
      const { people: responsible, isInherited: rInherited } = getAssignedPeople(task.id, "R");
      const { people: accountable, isInherited: aInherited } = getAssignedPeople(task.id, "A");
      const { people: consulted, isInherited: cInherited } = getAssignedPeople(task.id, "C");
      const { people: informed, isInherited: iInherited } = getAssignedPeople(task.id, "I");

      exportData.push({
        "WBS Code": task.wbsCode || `#${task.id}`,
        "Task Name": task.name,
        "Level": level,
        "Responsible": responsible.map(p => p.name).join("; ") || "",
        "Accountable": accountable.map(p => p.name).join("; ") || "",
        "Consulted": consulted.map(p => p.name).join("; ") || "",
        "Informed": informed.map(p => p.name).join("; ") || "",
        "Inherited": [rInherited && "R", aInherited && "A", cInherited && "C", iInherited && "I"]
          .filter(Boolean).join(", ") || "None",
      });

      // Recursively add children
      const children = getChildren(task.id);
      children.forEach(child => buildExportRow(child, level + 1));
    };

    rootTasks.forEach(task => buildExportRow(task, 0));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedProject.code || "project"}_raci_matrix_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "RACI Matrix exported successfully",
    });
  }, [selectedProject, rootTasks, getAssignedPeople, getChildren, toast]);

  // Render a single task row
  const renderTaskRow = (task: Task, level: number = 0) => {
    const children = getChildren(task.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id}>
        <div 
          className="grid grid-cols-[minmax(250px,2fr),repeat(4,minmax(120px,1fr))] gap-2 items-center py-2 px-3 border-b hover:bg-muted/30"
          data-testid={`raci-row-${task.id}`}
        >
          {/* Task column with tree indentation */}
          <div className="flex items-center gap-1" style={{ paddingLeft: `${level * 1.25}rem` }}>
            {hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0"
                onClick={() => toggleExpand(task.id)}
                data-testid={`expand-toggle-${task.id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{task.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{task.wbsCode}</div>
            </div>
          </div>

          {/* RACI columns */}
          {RACI_COLUMNS.map((col) => {
            const { people, isInherited } = getAssignedPeople(task.id, col.key);
            return (
              <PersonMultiSelect
                key={col.key}
                selectedPeople={people}
                allPeople={allPeople}
                onSelectionChange={(newPeople) => handleSelectionChange(task.id, col.key, newPeople)}
                raciRole={col.key}
                taskId={task.id}
                isInherited={isInherited}
                hasParent={Boolean(task.parentId)}
                onResetToInherited={() => handleResetToInherited(task.id, col.key)}
                disabled={updateRaciMutation.isPending || resetRaciMutation.isPending}
              />
            );
          })}
        </div>

        {/* Render children if expanded */}
        {isExpanded && children.map(child => renderTaskRow(child, level + 1))}
      </div>
    );
  };

  if (!selectedProject) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a project to view the RACI Matrix.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = tasksLoading || stakeholdersLoading || resourcesLoading || raciLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-raci-title">RACI Matrix</h1>
          <p className="text-muted-foreground">
            Assign Responsible, Accountable, Consulted, and Informed roles for each WBS item
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <FolderTree className="h-3 w-3" />
            {tasks.length} Tasks
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {allPeople.length} People
          </Badge>
        </div>
      </div>

      {/* RACI Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">RACI Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {RACI_COLUMNS.map(({ key, label, description, color }) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`h-6 w-6 rounded flex items-center justify-center font-bold text-xs ${color}`}>
                  {key}
                </div>
                <div>
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground ml-1">- {description}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span>Inherited from parent</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Multiple accountable (warning)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks by name or WBS code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-tasks"
          />
        </div>
        <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
          Collapse All
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* RACI Matrix Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Responsibility Assignment Matrix</CardTitle>
          <CardDescription>
            Click on cells to assign people. Children inherit parent assignments unless explicitly overridden.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : allPeople.length === 0 ? (
            <div className="p-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-4">
                  <div>
                    No stakeholders or resources found. Add people to this project before creating RACI assignments.
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate("/stakeholders")}
                      className="gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Add Stakeholders
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/resources")}
                      className="gap-2"
                    >
                      <Briefcase className="h-4 w-4" />
                      Add Resources
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No tasks found matching your search. Try adjusting your search criteria.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="relative">
              {/* Horizontal scroll hint */}
              {showHorizontalScrollHint && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-md px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                  <ChevronsRight className="h-3 w-3 animate-pulse" />
                  <span>Scroll horizontally to see all columns</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setShowHorizontalScrollHint(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="min-w-[700px]">
                  {/* Header row - sticky during horizontal scroll */}
                  <div className="grid grid-cols-[minmax(250px,2fr),repeat(4,minmax(120px,1fr))] gap-2 items-center py-3 px-3 bg-muted/50 border-b sticky top-0 z-10 backdrop-blur-sm">
                    <div className="font-medium text-sm">WBS / Task</div>
                    {RACI_COLUMNS.map((col) => (
                      <TooltipProvider key={col.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center gap-1 cursor-help">
                              <div className={`h-5 w-5 rounded flex items-center justify-center font-bold text-[10px] ${col.color}`}>
                                {col.key}
                              </div>
                              <span className="font-medium text-xs">{col.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">{col.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>

                  {/* Task rows */}
                  <div>
                    {rootTasks.map(task => renderTaskRow(task, 0))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
