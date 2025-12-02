import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { 
  AlertTriangle, 
  RotateCcw,
  User,
  Briefcase
} from "lucide-react";
import type { Stakeholder, StakeholderRaci, Resource } from "@shared/schema";

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

export function TaskRaciTab({ taskId, projectId, hasParent }: { taskId: number; projectId: number; hasParent: boolean }) {
  const { toast } = useToast();

  // Fetch stakeholders
  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/projects", projectId, "stakeholders"],
    enabled: Boolean(projectId),
  });

  // Fetch resources (human type only for RACI)
  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["/api/projects", projectId, "resources"],
    enabled: Boolean(projectId),
  });

  // Fetch RACI assignments for this task
  const { data: raciAssignments = [], isLoading: raciLoading } = useQuery<StakeholderRaci[]>({
    queryKey: [`/api/tasks/${taskId}/raci`],
    enabled: Boolean(taskId),
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

  // Build RACI lookup: { raciRole: { people: Person[], isInherited: boolean } }
  const raciMap = useMemo(() => {
    const map = new Map<RaciRole, { people: Person[]; isInherited: boolean }>();
    
    raciAssignments.forEach((raci) => {
      const role = raci.raciType as RaciRole;
      
      if (!map.has(role)) {
        map.set(role, { people: [], isInherited: raci.isInherited || false });
      }
      
      const roleData = map.get(role)!;
      
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
      raciType, 
      people,
    }: { 
      raciType: RaciRole;
      people: Person[];
    }) => {
      if (!projectId) throw new Error("No project selected");
      
      // First, delete all existing assignments for this task+role
      const existingForRole = raciAssignments.filter(
        r => r.raciType === raciType
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
          isInherited: false, // Direct assignment
        });
      }
      
      return { raciType, people };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/raci`] });
      // Also invalidate the project-level RACI query
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

  // Reset RACI to inherited mutation
  const resetRaciMutation = useMutation({
    mutationFn: async ({ raciType }: { raciType: RaciRole }) => {
      if (!projectId) throw new Error("No project selected");
      await apiRequest("POST", "/api/raci/reset", { taskId, raciType, projectId });
      return { raciType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/raci`] });
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

  const handleSelectionChange = useCallback((role: RaciRole, people: Person[]) => {
    if (role === "A" && people.length > 1) {
      toast({
        title: "Multiple Accountable Warning",
        description: "Best practice is to have only one person Accountable per task.",
        variant: "default",
      });
    }
    updateRaciMutation.mutate({ raciType: role, people });
  }, [updateRaciMutation, toast]);

  if (raciLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground">Loading RACI assignments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">RACI Matrix</p>
          <p className="text-xs text-muted-foreground">
            Define roles and responsibilities for this task. 
            Assignments can be inherited from parent tasks (shown with blue dot).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RACI_COLUMNS.map((col) => {
          const { people, isInherited } = raciMap.get(col.key) || { people: [], isInherited: false };
          
          return (
            <div key={col.key} className="space-y-2 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={col.color}>{col.key}</Badge>
                  <span className="font-medium text-sm">{col.label}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3 min-h-[32px]">
                {col.description}
              </p>
              <PersonMultiSelect
                selectedPeople={people}
                allPeople={allPeople}
                onSelectionChange={(newPeople) => handleSelectionChange(col.key, newPeople)}
                raciRole={col.key}
                taskId={taskId}
                isInherited={isInherited}
                hasParent={hasParent}
                onResetToInherited={() => resetRaciMutation.mutate({ raciType: col.key })}
                disabled={updateRaciMutation.isPending || resetRaciMutation.isPending}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

