import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, AlertTriangle, AlertCircle, User, Calendar, FileText, 
  ArrowRight, ExternalLink, Clock, DollarSign, Activity
} from "lucide-react";
import type { Task, Risk, Issue, ResourceAssignment, Resource } from "@shared/schema";

type TaskStatus = "not-started" | "in-progress" | "review" | "completed" | "on-hold";
type TaskPriority = "low" | "medium" | "high" | "critical";

const DISCIPLINES = [
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "piping", label: "Piping" },
  { value: "electrical", label: "Electrical" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "hse", label: "HSE" },
  { value: "commissioning", label: "Commissioning" },
  { value: "other", label: "Other" },
];

const CONSTRAINT_TYPES = [
  { value: "asap", label: "As Soon As Possible" },
  { value: "alap", label: "As Late As Possible" },
  { value: "mso", label: "Must Start On" },
  { value: "mfo", label: "Must Finish On" },
  { value: "snet", label: "Start No Earlier Than" },
  { value: "snlt", label: "Start No Later Than" },
  { value: "fnet", label: "Finish No Earlier Than" },
  { value: "fnlt", label: "Finish No Later Than" },
];

interface TaskFormData {
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  progress: number;
  discipline: string;
  areaCode: string;
  weightFactor: number;
  constraintType: string;
  baselineStart: string;
  baselineFinish: string;
  responsibleContractor: string;
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
  const [activeTab, setActiveTab] = useState("details");
  
  const getDefaultFormData = (): TaskFormData => ({
    name: "",
    description: "",
    status: defaultStatus,
    priority: "medium",
    startDate: "",
    endDate: "",
    progress: 0,
    discipline: "",
    areaCode: "",
    weightFactor: 1.0,
    constraintType: "asap",
    baselineStart: "",
    baselineFinish: "",
    responsibleContractor: "",
  });

  const [formData, setFormData] = useState<TaskFormData>(getDefaultFormData());
  
  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: [`/api/projects/${selectedProjectId}/risks`],
    enabled: !!selectedProjectId && !!task && open,
  });

  const { data: issues = [] } = useQuery<Issue[]>({
    queryKey: [`/api/projects/${selectedProjectId}/issues`],
    enabled: !!selectedProjectId && !!task && open,
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: [`/api/projects/${selectedProjectId}/resources`],
    enabled: !!selectedProjectId && !!task && open,
  });

  const { data: assignments = [] } = useQuery<ResourceAssignment[]>({
    queryKey: [`/api/tasks/${task?.id}/assignments`],
    enabled: !!task?.id && open,
  });

  const { data: dependencies = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${selectedProjectId}/dependencies`],
    enabled: !!selectedProjectId && !!task && open,
  });
  
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
          discipline: (task as any).discipline || "",
          areaCode: (task as any).areaCode || "",
          weightFactor: (task as any).weightFactor || 1.0,
          constraintType: (task as any).constraintType || "asap",
          baselineStart: (task as any).baselineStart ? new Date((task as any).baselineStart).toISOString().split('T')[0] : "",
          baselineFinish: (task as any).baselineFinish ? new Date((task as any).baselineFinish).toISOString().split('T')[0] : "",
          responsibleContractor: (task as any).responsibleContractor || "",
        });
      } else {
        setFormData({
          ...getDefaultFormData(),
          status: defaultStatus,
        });
      }
      setActiveTab("details");
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
      discipline: formData.discipline || undefined,
      areaCode: formData.areaCode || undefined,
      weightFactor: formData.weightFactor || undefined,
      constraintType: formData.constraintType || undefined,
      baselineStart: formData.baselineStart ? new Date(formData.baselineStart).toISOString() : undefined,
      baselineFinish: formData.baselineFinish ? new Date(formData.baselineFinish).toISOString() : undefined,
      responsibleContractor: formData.responsibleContractor || undefined,
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

  const taskDependencies = dependencies.filter(
    (dep: any) => dep.sourceTaskId === task?.id || dep.targetTaskId === task?.id
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "not-started": "secondary",
      "in-progress": "default",
      "review": "outline",
      "completed": "default",
      "on-hold": "destructive",
      "identified": "secondary",
      "analyzing": "outline",
      "mitigating": "default",
      "closed": "default",
      "accepted": "secondary",
      "open": "destructive",
      "in_progress": "default",
      "resolved": "default",
    };
    return variants[status] || "secondary";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "text-green-600",
      medium: "text-amber-600",
      high: "text-orange-600",
      critical: "text-red-600",
    };
    return colors[priority] || "text-muted-foreground";
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isEditing = !!task;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="modal-task">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Badge variant="outline" className="font-mono">
                    {task.wbsCode || `#${task.id}`}
                  </Badge>
                  <span>{task.name}</span>
                </>
              ) : (
                "Create New Task"
              )}
            </DialogTitle>
            {isEditing && (
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadge(formData.status)}>
                  {formData.status.replace("-", " ")}
                </Badge>
                <Badge variant="outline" className={getPriorityColor(formData.priority)}>
                  {formData.priority}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5 shrink-0">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="risks" disabled={!isEditing}>
              Risks {isEditing && risks.length > 0 && `(${risks.length})`}
            </TabsTrigger>
            <TabsTrigger value="issues" disabled={!isEditing}>
              Issues {isEditing && issues.length > 0 && `(${issues.length})`}
            </TabsTrigger>
            <TabsTrigger value="resources" disabled={!isEditing}>Resources</TabsTrigger>
            <TabsTrigger value="documents" disabled={!isEditing}>Documents</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <div className="pr-4 pb-4">
              <TabsContent value="details" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Basic Information</h3>
                    
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
                        rows={3}
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

                    <div className="space-y-2">
                      <Label htmlFor="progress">Progress ({formData.progress}%)</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="progress"
                          type="range"
                          min={0}
                          max={100}
                          value={formData.progress}
                          onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                          data-testid="input-progress"
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-mono text-sm">{formData.progress}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">EPC Details</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="discipline">Discipline</Label>
                        <Select 
                          value={formData.discipline} 
                          onValueChange={(value) => setFormData({ ...formData, discipline: value })}
                        >
                          <SelectTrigger id="discipline" data-testid="select-discipline">
                            <SelectValue placeholder="Select discipline" />
                          </SelectTrigger>
                          <SelectContent>
                            {DISCIPLINES.map(d => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="area-code">Area/Zone Code</Label>
                        <Input
                          id="area-code"
                          placeholder="e.g., A-101"
                          value={formData.areaCode}
                          onChange={(e) => setFormData({ ...formData, areaCode: e.target.value })}
                          data-testid="input-area-code"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="weight-factor">Weight Factor</Label>
                        <Input
                          id="weight-factor"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.weightFactor}
                          onChange={(e) => setFormData({ ...formData, weightFactor: parseFloat(e.target.value) || 1 })}
                          data-testid="input-weight-factor"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="constraint">Constraint Type</Label>
                        <Select 
                          value={formData.constraintType} 
                          onValueChange={(value) => setFormData({ ...formData, constraintType: value })}
                        >
                          <SelectTrigger id="constraint" data-testid="select-constraint">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONSTRAINT_TYPES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contractor">Responsible Contractor</Label>
                      <Input
                        id="contractor"
                        placeholder="Enter contractor name"
                        value={formData.responsibleContractor}
                        onChange={(e) => setFormData({ ...formData, responsibleContractor: e.target.value })}
                        data-testid="input-contractor"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-4">Schedule</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="baseline-start">Baseline Start</Label>
                      <Input
                        id="baseline-start"
                        type="date"
                        value={formData.baselineStart}
                        onChange={(e) => setFormData({ ...formData, baselineStart: e.target.value })}
                        data-testid="input-baseline-start"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="baseline-finish">Baseline Finish</Label>
                      <Input
                        id="baseline-finish"
                        type="date"
                        value={formData.baselineFinish}
                        onChange={(e) => setFormData({ ...formData, baselineFinish: e.target.value })}
                        data-testid="input-baseline-finish"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && taskDependencies.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Dependencies</h3>
                    <div className="space-y-2">
                      {taskDependencies.map((dep: any) => (
                        <div key={dep.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                          <Badge variant="outline" className="font-mono text-xs">
                            {dep.sourceTaskId === task?.id ? "Successor" : "Predecessor"}
                          </Badge>
                          <span className="font-medium">
                            Task #{dep.sourceTaskId === task?.id ? dep.targetTaskId : dep.sourceTaskId}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                          <Badge variant="secondary">{dep.dependencyType}</Badge>
                          {dep.lagDays !== 0 && (
                            <span className="text-muted-foreground">
                              ({dep.lagDays > 0 ? "+" : ""}{dep.lagDays} days)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risks" className="space-y-4 mt-0">
                {risks.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Risks Found</h3>
                    <p className="text-sm text-muted-foreground">
                      No risks have been identified for this project yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {risks.map((risk) => (
                      <Card key={risk.id} className="hover-elevate cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">{risk.code}</Badge>
                                <Badge variant={getStatusBadge(risk.status)}>{risk.status}</Badge>
                              </div>
                              <h4 className="font-medium mb-1">{risk.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">{risk.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Activity className="h-4 w-4" />
                                <span>P: {risk.probability}</span>
                              </div>
                              <Badge variant="outline" className={
                                risk.impact === "critical" ? "border-red-500 text-red-500" :
                                risk.impact === "high" ? "border-orange-500 text-orange-500" :
                                risk.impact === "medium" ? "border-amber-500 text-amber-500" : ""
                              }>
                                {risk.impact}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="issues" className="space-y-4 mt-0">
                {issues.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
                    <p className="text-sm text-muted-foreground">
                      No issues have been reported for this project yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issues.map((issue) => (
                      <Card key={issue.id} className="hover-elevate cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs">{issue.code}</Badge>
                                <Badge variant={getStatusBadge(issue.status)}>{issue.status}</Badge>
                                <Badge variant="outline" className={getPriorityColor(issue.priority)}>
                                  {issue.priority}
                                </Badge>
                              </div>
                              <h4 className="font-medium mb-1">{issue.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">{issue.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{new Date(issue.reportedDate).toLocaleDateString()}</span>
                              </div>
                              {issue.targetResolutionDate && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  <span>Due: {new Date(issue.targetResolutionDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="resources" className="space-y-4 mt-0">
                {assignments.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Resources Assigned</h3>
                    <p className="text-sm text-muted-foreground">
                      No resources have been assigned to this task yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Resource assignments can be managed from the Resources page.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => {
                      const resource = resources.find(r => r.id === assignment.resourceId);
                      return (
                        <Card key={assignment.id} className="hover-elevate">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{resource?.name || `Resource #${assignment.resourceId}`}</h4>
                                  <p className="text-sm text-muted-foreground">{resource?.type || "Unknown type"}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-sm">{assignment.units}%</p>
                                <p className="text-xs text-muted-foreground">Allocation</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-0">
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Document Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Document attachments and SOPs linked to this task will appear here.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Use the Document Register to manage project documents.
                  </p>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2 shrink-0 border-t pt-4">
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
