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
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, AlertTriangle, AlertCircle, User, Calendar, FileText, 
  ArrowRight, ArrowLeft, Clock, Activity, Plus, X, Link2, GitBranch,
  Pencil, Check, Info, ChevronDown, ChevronUp, Building2
} from "lucide-react";
import type { Task, Risk, Issue, ResourceAssignment, Resource, Document, TaskDependency } from "@shared/schema";
import { EditResourceModal } from "@/components/modals/EditResourceModal";
import { ResourceLevelingModal } from "@/components/modals/ResourceLevelingModal";
import { EditDocumentModal } from "@/components/modals/EditDocumentModal";
import { EditRiskModal } from "@/components/modals/EditRiskModal";
import { EditIssueModal } from "@/components/modals/EditIssueModal";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useTaskConversation, useCreateConversation } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare } from "lucide-react";

type TaskStatus = "not-started" | "in-progress" | "review" | "completed" | "on-hold";
type TaskPriority = "low" | "medium" | "high" | "critical";
type DependencyType = "FS" | "SS" | "FF" | "SF";

const DISCIPLINES = [
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "piping", label: "Piping" },
  { value: "electrical", label: "Electrical" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "hvac", label: "HVAC" },
  { value: "architectural", label: "Architectural" },
  { value: "general", label: "General" },
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

const DEPENDENCY_TYPES = [
  { value: "FS", label: "Finish-to-Start (FS)" },
  { value: "SS", label: "Start-to-Start (SS)" },
  { value: "FF", label: "Finish-to-Finish (FF)" },
  { value: "SF", label: "Start-to-Finish (SF)" },
];

interface TaskFormData {
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  progress: number;
  estimatedHours: string;
  workMode: "parallel" | "sequential";
  discipline: string;
  areaCode: string;
  weightFactor: number;
  constraintType: string;
  baselineStart: string;
  baselineFinish: string;
  actualStartDate: string;
  actualFinishDate: string;
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
  const [selectedPredecessor, setSelectedPredecessor] = useState<string>("");
  const [selectedSuccessor, setSelectedSuccessor] = useState<string>("");
  const [predecessorLag, setPredecessorLag] = useState<number>(0);
  const [successorLag, setSuccessorLag] = useState<number>(0);
  const [predecessorType, setPredecessorType] = useState<DependencyType>("FS");
  const [successorType, setSuccessorType] = useState<DependencyType>("FS");
  const [editingDependency, setEditingDependency] = useState<number | null>(null);
  const [showResourceCreation, setShowResourceCreation] = useState(false);
  const [newlyCreatedResourceId, setNewlyCreatedResourceId] = useState<number | null>(null);
  const [showPmiLegend, setShowPmiLegend] = useState(false);
  const [showResourceLeveling, setShowResourceLeveling] = useState(false);

  const [showDocumentCreation, setShowDocumentCreation] = useState(false);
  const [newlyCreatedDocumentId, setNewlyCreatedDocumentId] = useState<number | null>(null);
  
  const [showRiskCreation, setShowRiskCreation] = useState(false);
  const [newlyCreatedRiskId, setNewlyCreatedRiskId] = useState<number | null>(null);
  
  const [showIssueCreation, setShowIssueCreation] = useState(false);
  const [newlyCreatedIssueId, setNewlyCreatedIssueId] = useState<number | null>(null);
  
  const getDefaultFormData = (): TaskFormData => ({
    name: "",
    description: "",
    status: defaultStatus,
    priority: "medium",
    startDate: "",
    endDate: "",
    progress: 0,
    estimatedHours: "",
    workMode: "parallel",
    discipline: "",
    areaCode: "",
    weightFactor: 1.0,
    constraintType: "asap",
    baselineStart: "",
    baselineFinish: "",
    actualStartDate: "",
    actualFinishDate: "",
    responsibleContractor: "",
  });

  const [formData, setFormData] = useState<TaskFormData>(getDefaultFormData());
  
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/projects/${selectedProjectId}/tasks`],
    enabled: !!selectedProjectId && open,
  });

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
    enabled: !!selectedProjectId && open,
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/projects/${selectedProjectId}/documents`],
    enabled: !!selectedProjectId && open,
  });

  const { data: assignments = [] } = useQuery<ResourceAssignment[]>({
    queryKey: [`/api/tasks/${task?.id}/assignments`],
    enabled: !!task?.id && open,
  });

  const { data: dependencies = [] } = useQuery<TaskDependency[]>({
    queryKey: [`/api/projects/${selectedProjectId}/dependencies`],
    enabled: !!selectedProjectId && open,
  });

  const { data: taskDocuments = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/documents`],
    enabled: !!task?.id && open,
  });

  const { data: taskRisks = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/risks`],
    enabled: !!task?.id && open,
  });

  const { data: taskIssues = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/issues`],
    enabled: !!task?.id && open,
  });

  const { data: inheritedResources = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/inherited/resources`],
    enabled: !!task?.id && open,
  });

  const { data: inheritedDocuments = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/inherited/documents`],
    enabled: !!task?.id && open,
  });

  const { data: inheritedRisks = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/inherited/risks`],
    enabled: !!task?.id && open,
  });

  const { data: inheritedIssues = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${task?.id}/inherited/issues`],
    enabled: !!task?.id && open,
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
          estimatedHours: task.estimatedHours ? String(task.estimatedHours) : "",
          workMode: ((task as any).workMode as "parallel" | "sequential") || "parallel",
          discipline: (task as any).discipline || "",
          areaCode: (task as any).areaCode || "",
          weightFactor: (task as any).weightFactor || 1.0,
          constraintType: (task as any).constraintType || "asap",
          baselineStart: (task as any).baselineStart ? new Date((task as any).baselineStart).toISOString().split('T')[0] : "",
          baselineFinish: (task as any).baselineFinish ? new Date((task as any).baselineFinish).toISOString().split('T')[0] : "",
          actualStartDate: (task as any).actualStartDate ? new Date((task as any).actualStartDate).toISOString().split('T')[0] : "",
          actualFinishDate: (task as any).actualFinishDate ? new Date((task as any).actualFinishDate).toISOString().split('T')[0] : "",
          responsibleContractor: (task as any).responsibleContractor || "",
        });
      } else {
        setFormData({
          ...getDefaultFormData(),
          status: defaultStatus,
        });
      }
      setActiveTab("details");
      setSelectedPredecessor("");
      setSelectedSuccessor("");
      setPredecessorLag(0);
      setSuccessorLag(0);
      setEditingDependency(null);
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
      // Ensure decimal fields are sent as strings
      const payload = {
        ...data,
        estimatedHours: data.estimatedHours ? String(data.estimatedHours) : null,
        weightFactor: data.weightFactor !== undefined && data.weightFactor !== null ? String(data.weightFactor) : null,
      };
      const response = await apiRequest("PATCH", `/api/tasks/${task?.id}`, payload);
      return await response.json();
    },
    onSuccess: (updatedTask: Task) => {
      // Update formData with refreshed task data, especially endDate and computedDuration
      if (updatedTask) {
        setFormData(prev => ({
          ...prev,
          endDate: updatedTask.endDate ? new Date(updatedTask.endDate).toISOString().split('T')[0] : prev.endDate,
          startDate: updatedTask.startDate ? new Date(updatedTask.startDate).toISOString().split('T')[0] : prev.startDate,
          estimatedHours: updatedTask.estimatedHours ? String(updatedTask.estimatedHours) : prev.estimatedHours,
        }));
        // Don't close modal if estimatedHours changed - let user see the updated endDate
        const estimatedHoursChanged = task && updatedTask.estimatedHours && 
          Number(task.estimatedHours) !== Number(updatedTask.estimatedHours);
        
        if (!estimatedHoursChanged) {
          handleClose();
        } else {
          // Keep modal open but show success message
          toast({
            title: "Task Updated",
            description: "Estimated hours updated. End date recalculated based on new duration.",
          });
        }
      } else {
        handleClose();
      }
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const addDependencyMutation = useMutation({
    mutationFn: async (data: { predecessorId: number; successorId: number; type: DependencyType; lagDays: number }) => {
      return await apiRequest("POST", `/api/dependencies`, {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/dependencies`] });
      toast({ title: "Success", description: "Dependency added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: async (dependencyId: number) => {
      return await apiRequest("DELETE", `/api/dependencies/${dependencyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/dependencies`] });
      toast({ title: "Success", description: "Dependency removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDependencyMutation = useMutation({
    mutationFn: async ({ id, type, lagDays }: { id: number; type: DependencyType; lagDays: number }) => {
      return await apiRequest("PATCH", `/api/dependencies/${id}`, { type, lagDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/dependencies`] });
      toast({ title: "Success", description: "Dependency updated" });
      setEditingDependency(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addResourceMutation = useMutation({
    mutationFn: async (data: { resourceId: number; allocation: number }) => {
      return await apiRequest("POST", `/api/assignments`, {
        taskId: task?.id,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/assignments`] });
      toast({ title: "Success", description: "Resource assigned" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeResourceMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return await apiRequest("DELETE", `/api/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/assignments`] });
      toast({ title: "Success", description: "Resource removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: async (data: { documentId: number; relationship?: string }) => {
      return await apiRequest("POST", `/api/tasks/${task?.id}/documents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/documents`] });
      toast({ title: "Success", description: "Document linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${task?.id}/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/documents`] });
      toast({ title: "Success", description: "Document unlinked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addRiskMutation = useMutation({
    mutationFn: async (riskId: number) => {
      return await apiRequest("POST", `/api/tasks/${task?.id}/risks`, { riskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/risks`] });
      toast({ title: "Success", description: "Risk linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeRiskMutation = useMutation({
    mutationFn: async (riskId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${task?.id}/risks/${riskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/risks`] });
      toast({ title: "Success", description: "Risk unlinked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addIssueMutation = useMutation({
    mutationFn: async (issueId: number) => {
      return await apiRequest("POST", `/api/tasks/${task?.id}/issues`, { issueId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/issues`] });
      toast({ title: "Success", description: "Issue linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeIssueMutation = useMutation({
    mutationFn: async (issueId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${task?.id}/issues/${issueId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/issues`] });
      toast({ title: "Success", description: "Issue unlinked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
      workMode: formData.workMode,
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

  const predecessors = dependencies.filter((dep) => dep.successorId === task?.id);
  const successors = dependencies.filter((dep) => dep.predecessorId === task?.id);
  const availableTasks = allTasks.filter(t => t.id !== task?.id);
  const linkedDocIds = taskDocuments.map((td: any) => td.documentId);
  const linkedRiskIds = taskRisks.map((tr: any) => tr.riskId);
  const linkedIssueIds = taskIssues.map((ti: any) => ti.issueId);
  const assignedResourceIds = assignments.map(a => a.resourceId);

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

  const getTaskName = (taskId: number) => {
    const t = allTasks.find(task => task.id === taskId);
    return t ? `${t.wbsCode || '#' + t.id} - ${t.name}` : `Task #${taskId}`;
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isEditing = !!task;

  // Auto-assign newly created resource to task
  useEffect(() => {
    if (newlyCreatedResourceId && task) {
      addResourceMutation.mutate(
        { resourceId: newlyCreatedResourceId, allocation: 100 },
        {
          onSuccess: () => {
            setNewlyCreatedResourceId(null);
            toast({
              title: "Resource Assigned",
              description: "The newly created resource has been assigned to this task.",
            });
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyCreatedResourceId, task]);

  // Auto-link newly created document to task
  useEffect(() => {
    if (newlyCreatedDocumentId && task) {
      addDocumentMutation.mutate(
        { documentId: newlyCreatedDocumentId },
        {
          onSuccess: () => {
            setNewlyCreatedDocumentId(null);
            toast({
              title: "Document Linked",
              description: "The newly created document has been linked to this task.",
            });
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyCreatedDocumentId, task]);

  // Auto-link newly created risk to task
  useEffect(() => {
    if (newlyCreatedRiskId && task) {
      addRiskMutation.mutate(
        newlyCreatedRiskId,
        {
          onSuccess: () => {
            setNewlyCreatedRiskId(null);
            toast({
              title: "Risk Linked",
              description: "The newly created risk has been linked to this task.",
            });
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyCreatedRiskId, task]);

  // Auto-link newly created issue to task
  useEffect(() => {
    if (newlyCreatedIssueId && task) {
      addIssueMutation.mutate(
        newlyCreatedIssueId,
        {
          onSuccess: () => {
            setNewlyCreatedIssueId(null);
            toast({
              title: "Issue Linked",
              description: "The newly created issue has been linked to this task.",
            });
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyCreatedIssueId, task]);

  // If showing resource creation, render EditResourceModal instead
  if (showResourceCreation) {
    return (
      <EditResourceModal
        resource={null}
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowResourceCreation(false);
          }
        }}
        onSuccess={(createdResource) => {
          setShowResourceCreation(false);
          // Store the newly created resource ID to auto-assign it
          if (createdResource?.id) {
            setNewlyCreatedResourceId(createdResource.id);
          }
          // Refresh resources list
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/resources`] });
        }}
      />
    );
  }

  // If showing document creation
  if (showDocumentCreation) {
    return (
      <EditDocumentModal
        document={null}
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowDocumentCreation(false);
          }
        }}
        onSuccess={(createdDocument) => {
          setShowDocumentCreation(false);
          if (createdDocument?.id) {
            setNewlyCreatedDocumentId(createdDocument.id);
          }
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/documents`] });
        }}
      />
    );
  }

  // If showing risk creation
  if (showRiskCreation) {
    return (
      <EditRiskModal
        risk={null}
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowRiskCreation(false);
          }
        }}
        onSuccess={(createdRisk) => {
          setShowRiskCreation(false);
          if (createdRisk?.id) {
            setNewlyCreatedRiskId(createdRisk.id);
          }
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/risks`] });
        }}
      />
    );
  }

  // If showing issue creation
  if (showIssueCreation) {
    return (
      <EditIssueModal
        issue={null}
        open={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowIssueCreation(false);
          }
        }}
        onSuccess={(createdIssue) => {
          setShowIssueCreation(false);
          if (createdIssue?.id) {
            setNewlyCreatedIssueId(createdIssue.id);
          }
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/issues`] });
        }}
      />
    );
  }

  // Render Resource Leveling Modal if needed
  if (showResourceLeveling && task) {
    return (
      <>
        <ResourceLevelingModal
          task={task}
          open={showResourceLeveling}
          onOpenChange={(isOpen) => {
            setShowResourceLeveling(isOpen);
            if (!isOpen) {
              // Refresh task data after leveling
              queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
            }
          }}
          onApply={(option) => {
            // Refresh task data after applying leveling
            queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
          }}
        />
        {/* Keep the main modal open but hidden */}
        <div style={{ display: 'none' }} />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0" data-testid="modal-task">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b">
          <div className="flex items-center justify-between mr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2 border-b shrink-0 bg-background">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b-0 rounded-none">
              <TabsTrigger 
                value="details" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Details
              </TabsTrigger>
              <TabsTrigger 
                value="dependencies" 
                disabled={!isEditing}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Dependencies {isEditing && (predecessors.length + successors.length > 0) && `(${predecessors.length + successors.length})`}
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                disabled={!isEditing}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Resources {isEditing && assignments.length > 0 && `(${assignments.length})`}
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                disabled={!isEditing}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Documents {isEditing && taskDocuments.length > 0 && `(${taskDocuments.length})`}
              </TabsTrigger>
              <TabsTrigger 
                value="risks" 
                disabled={!isEditing}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Risks {isEditing && taskRisks.length > 0 && `(${taskRisks.length})`}
              </TabsTrigger>
              <TabsTrigger 
                value="issues" 
                disabled={!isEditing}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Issues {isEditing && taskIssues.length > 0 && `(${taskIssues.length})`}
              </TabsTrigger>
              <TabsTrigger 
                value="chat"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Chat
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="details" className="space-y-6 mt-0 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Description & Core Info */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-name">Task Name *</Label>
                      <Input
                        id="task-name"
                        placeholder="Enter task name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-task-name"
                        className="text-lg font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        placeholder="Enter task description"
                        rows={5}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        data-testid="textarea-task-description"
                      />
                    </div>
                  </div>

                  {/* EPC Details Section */}
                  <div className="border rounded-lg p-4 bg-muted/10 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      EPC Details
                    </h3>
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
                            {DISCIPLINES.map((disc) => (
                              <SelectItem key={disc.value} value={disc.value}>{disc.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="area-code">Area Code</Label>
                        <Input
                          id="area-code"
                          placeholder="e.g., A-100"
                          value={formData.areaCode}
                          onChange={(e) => setFormData({ ...formData, areaCode: e.target.value })}
                          data-testid="input-area-code"
                        />
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

                      {assignments.length > 1 && (
                        <div className="space-y-2">
                          <Label htmlFor="work-mode">Work Mode</Label>
                          <Select 
                            value={formData.workMode} 
                            onValueChange={(value: "parallel" | "sequential") => setFormData({ ...formData, workMode: value })}
                          >
                            <SelectTrigger id="work-mode" data-testid="select-work-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="parallel">Parallel (Max Duration)</SelectItem>
                              <SelectItem value="sequential">Sequential (Sum Duration)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PMI Standard Duration Info */}
                  {task && (
                    <div className="space-y-3 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Duration Information (PMI Standard)
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Baseline Duration</Label>
                          <p className="text-sm font-medium">
                            {(task as any).baselineDuration 
                              ? `${(task as any).baselineDuration} days` 
                              : "Not set"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Computed Duration</Label>
                          <p className="text-sm font-medium">
                            {(task as any).computedDuration 
                              ? `${(task as any).computedDuration} days` 
                              : task.estimatedHours 
                                ? "Calculating..." 
                                : "Not calculated"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Actual Duration</Label>
                          <p className="text-sm font-medium">
                            {(task as any).actualDuration 
                              ? `${(task as any).actualDuration} days` 
                              : task.status === "completed" && (task as any).actualStartDate && (task as any).actualFinishDate
                                ? `${Math.ceil((new Date((task as any).actualFinishDate).getTime() - new Date((task as any).actualStartDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                                : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Meta, Status, Dates */}
                <div className="lg:col-span-1 space-y-6">
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-status">Status</Label>
                        <Select 
                          value={formData.status} 
                          onValueChange={(value: TaskStatus) => {
                            const today = new Date().toISOString().split('T')[0];
                            const updates: Partial<TaskFormData> = { status: value };
                            
                            if (value === 'in-progress' && !formData.actualStartDate) {
                              updates.actualStartDate = today;
                            }
                            
                            if (value === 'completed' && !formData.actualFinishDate) {
                              updates.actualFinishDate = today;
                              updates.progress = 100;
                            }
                            
                            setFormData({ ...formData, ...updates });
                          }}
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

                      <div className="space-y-2">
                        <Label htmlFor="task-progress" className="flex justify-between">
                          <span>Progress</span>
                          <span>{formData.progress}%</span>
                        </Label>
                        <Input
                          id="task-progress"
                          type="range"
                          min="0"
                          max="100"
                          value={formData.progress}
                          onChange={(e) => {
                            const newProgress = parseInt(e.target.value);
                            setFormData({ ...formData, progress: newProgress });
                            const today = new Date().toISOString().split('T')[0];
                            if (newProgress > 0 && newProgress < 100 && !formData.actualStartDate) {
                              setFormData(prev => ({ ...prev, actualStartDate: today }));
                            }
                            if (newProgress === 100 && !formData.actualFinishDate) {
                              setFormData(prev => ({ ...prev, actualFinishDate: today }));
                            }
                          }}
                          className="cursor-pointer"
                          data-testid="slider-task-progress"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="estimated-hours">Estimated Hours</Label>
                    <Input
                      id="estimated-hours"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.estimatedHours}
                      onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                      data-testid="input-estimated-hours"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="constraint-type">Constraint Type</Label>
                    <Select 
                      value={formData.constraintType} 
                      onValueChange={(value) => setFormData({ ...formData, constraintType: value })}
                    >
                      <SelectTrigger id="constraint-type" data-testid="select-constraint-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSTRAINT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dates Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">Planned</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="start-date" className="text-xs">Start</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            disabled={formData.progress === 100}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="end-date" className="text-xs">End</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            disabled={formData.progress === 100}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">Baseline</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="baseline-start" className="text-xs">Start</Label>
                          <Input
                            id="baseline-start"
                            type="date"
                            value={formData.baselineStart}
                            onChange={(e) => setFormData({ ...formData, baselineStart: e.target.value })}
                            disabled={!!(task as any)?.baselineStart}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="baseline-finish" className="text-xs">Finish</Label>
                          <Input
                            id="baseline-finish"
                            type="date"
                            value={formData.baselineFinish}
                            onChange={(e) => setFormData({ ...formData, baselineFinish: e.target.value })}
                            disabled={!!(task as any)?.baselineFinish}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">Actual</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="actual-start-date" className="text-xs">Start</Label>
                          <Input
                            id="actual-start-date"
                            type="date"
                            value={formData.actualStartDate}
                            onChange={(e) => setFormData({ ...formData, actualStartDate: e.target.value })}
                            disabled={formData.progress === 0}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="actual-finish-date" className="text-xs">Finish</Label>
                          <Input
                            id="actual-finish-date"
                            type="date"
                            value={formData.actualFinishDate}
                            onChange={(e) => setFormData({ ...formData, actualFinishDate: e.target.value })}
                            disabled={formData.progress < 100}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Task Dependencies</p>
                      <p className="text-xs text-muted-foreground">
                        Define predecessor (tasks that must finish before this task) and successor (tasks that wait for this task) relationships
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <ArrowLeft className="h-4 w-4 text-blue-500" />
                          Predecessors
                          <Badge variant="secondary" className="ml-1">{predecessors.length}</Badge>
                        </h4>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">Tasks that must complete before this task can start</p>
                      
                      <div className="space-y-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Add Predecessor</Label>
                          <Select value={selectedPredecessor} onValueChange={setSelectedPredecessor}>
                            <SelectTrigger data-testid="select-predecessor" className="w-full">
                              <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTasks
                                .filter(t => !predecessors.some(p => p.predecessorId === t.id))
                                .map((t) => (
                                  <SelectItem key={t.id} value={t.id.toString()}>
                                    <span className="font-mono text-xs">{t.wbsCode || `#${t.id}`}</span>
                                    <span className="ml-2">{t.name}</span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Type</Label>
                            <Select value={predecessorType} onValueChange={(v: DependencyType) => setPredecessorType(v)}>
                              <SelectTrigger data-testid="select-predecessor-type" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPENDENCY_TYPES.map((dt) => (
                                  <SelectItem key={dt.value} value={dt.value}>
                                    <span className="font-mono">{dt.value}</span>
                                    <span className="ml-2 text-muted-foreground text-xs">({dt.label})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-20">
                            <Label className="text-xs">Lag</Label>
                            <Input
                              type="number"
                              value={predecessorLag}
                              onChange={(e) => setPredecessorLag(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              data-testid="input-predecessor-lag"
                            />
                          </div>
                        </div>
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            if (!selectedPredecessor || !task) return;
                            addDependencyMutation.mutate({
                              predecessorId: parseInt(selectedPredecessor),
                              successorId: task.id,
                              type: predecessorType,
                              lagDays: predecessorLag,
                            });
                            setSelectedPredecessor("");
                            setPredecessorLag(0);
                          }}
                          disabled={!selectedPredecessor || addDependencyMutation.isPending}
                          data-testid="button-add-predecessor"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Predecessor
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {predecessors.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                            No predecessors defined
                          </p>
                        ) : (
                          predecessors.map((dep) => (
                            <div key={dep.id} className="group flex items-center gap-2 p-3 bg-card border rounded-lg hover-elevate">
                              {editingDependency === dep.id ? (
                                <div className="flex-1 flex items-center gap-2 flex-wrap">
                                  <Select
                                    value={dep.type}
                                    onValueChange={(v: DependencyType) => {
                                      updateDependencyMutation.mutate({ id: dep.id, type: v, lagDays: dep.lagDays || 0 });
                                    }}
                                  >
                                    <SelectTrigger className="w-20">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DEPENDENCY_TYPES.map((dt) => (
                                        <SelectItem key={dt.value} value={dt.value}>{dt.value}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-sm flex-1 truncate">{getTaskName(dep.predecessorId)}</span>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      className="w-16 h-8"
                                      defaultValue={dep.lagDays || 0}
                                      onBlur={(e) => {
                                        const newLag = parseInt(e.target.value) || 0;
                                        if (newLag !== dep.lagDays) {
                                          updateDependencyMutation.mutate({ id: dep.id, type: dep.type as DependencyType, lagDays: newLag });
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const newLag = parseInt((e.target as HTMLInputElement).value) || 0;
                                          updateDependencyMutation.mutate({ id: dep.id, type: dep.type as DependencyType, lagDays: newLag });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-muted-foreground">days</span>
                                  </div>
                                  <Button size="icon" variant="ghost" onClick={() => setEditingDependency(null)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Badge variant="outline" className="font-mono text-xs shrink-0">{dep.type}</Badge>
                                  <span className="text-sm flex-1 truncate">{getTaskName(dep.predecessorId)}</span>
                                  {dep.lagDays !== 0 && (
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      {dep.lagDays > 0 ? "+" : ""}{dep.lagDays}d
                                    </Badge>
                                  )}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingDependency(dep.id)}
                                      data-testid={`button-edit-predecessor-${dep.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => removeDependencyMutation.mutate(dep.id)}
                                      disabled={removeDependencyMutation.isPending}
                                      data-testid={`button-remove-predecessor-${dep.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-green-500" />
                          Successors
                          <Badge variant="secondary" className="ml-1">{successors.length}</Badge>
                        </h4>
                      </div>

                      <p className="text-xs text-muted-foreground">Tasks that wait for this task to complete</p>
                      
                      <div className="space-y-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Add Successor</Label>
                          <Select value={selectedSuccessor} onValueChange={setSelectedSuccessor}>
                            <SelectTrigger data-testid="select-successor" className="w-full">
                              <SelectValue placeholder="Select a task..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTasks
                                .filter(t => !successors.some(s => s.successorId === t.id))
                                .map((t) => (
                                  <SelectItem key={t.id} value={t.id.toString()}>
                                    <span className="font-mono text-xs">{t.wbsCode || `#${t.id}`}</span>
                                    <span className="ml-2">{t.name}</span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Type</Label>
                            <Select value={successorType} onValueChange={(v: DependencyType) => setSuccessorType(v)}>
                              <SelectTrigger data-testid="select-successor-type" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPENDENCY_TYPES.map((dt) => (
                                  <SelectItem key={dt.value} value={dt.value}>
                                    <span className="font-mono">{dt.value}</span>
                                    <span className="ml-2 text-muted-foreground text-xs">({dt.label})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-20">
                            <Label className="text-xs">Lag</Label>
                            <Input
                              type="number"
                              value={successorLag}
                              onChange={(e) => setSuccessorLag(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              data-testid="input-successor-lag"
                            />
                          </div>
                        </div>
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            if (!selectedSuccessor || !task) return;
                            addDependencyMutation.mutate({
                              predecessorId: task.id,
                              successorId: parseInt(selectedSuccessor),
                              type: successorType,
                              lagDays: successorLag,
                            });
                            setSelectedSuccessor("");
                            setSuccessorLag(0);
                          }}
                          disabled={!selectedSuccessor || addDependencyMutation.isPending}
                          data-testid="button-add-successor"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Successor
                        </Button>
                      </div>
                    
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {successors.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                            No successors defined
                          </p>
                        ) : (
                          successors.map((dep) => (
                            <div key={dep.id} className="group flex items-center gap-2 p-3 bg-card border rounded-lg hover-elevate">
                              {editingDependency === dep.id ? (
                                <div className="flex-1 flex items-center gap-2 flex-wrap">
                                  <Select
                                    value={dep.type}
                                    onValueChange={(v: DependencyType) => {
                                      updateDependencyMutation.mutate({ id: dep.id, type: v, lagDays: dep.lagDays || 0 });
                                    }}
                                  >
                                    <SelectTrigger className="w-20">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DEPENDENCY_TYPES.map((dt) => (
                                        <SelectItem key={dt.value} value={dt.value}>{dt.value}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-sm flex-1 truncate">{getTaskName(dep.successorId)}</span>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      className="w-16 h-8"
                                      defaultValue={dep.lagDays || 0}
                                      onBlur={(e) => {
                                        const newLag = parseInt(e.target.value) || 0;
                                        if (newLag !== dep.lagDays) {
                                          updateDependencyMutation.mutate({ id: dep.id, type: dep.type as DependencyType, lagDays: newLag });
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const newLag = parseInt((e.target as HTMLInputElement).value) || 0;
                                          updateDependencyMutation.mutate({ id: dep.id, type: dep.type as DependencyType, lagDays: newLag });
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-muted-foreground">days</span>
                                  </div>
                                  <Button size="icon" variant="ghost" onClick={() => setEditingDependency(null)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Badge variant="outline" className="font-mono text-xs shrink-0">{dep.type}</Badge>
                                  <span className="text-sm flex-1 truncate">{getTaskName(dep.successorId)}</span>
                                  {dep.lagDays !== 0 && (
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      {dep.lagDays > 0 ? "+" : ""}{dep.lagDays}d
                                    </Badge>
                                  )}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingDependency(dep.id)}
                                      data-testid={`button-edit-successor-${dep.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => removeDependencyMutation.mutate(dep.id)}
                                      disabled={removeDependencyMutation.isPending}
                                      data-testid={`button-remove-successor-${dep.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="resources" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Resource Assignments</p>
                      <p className="text-xs text-muted-foreground">Assign resources to this task. Inherited resources from parent tasks are shown below.</p>
                    </div>
                  </div>

                  {assignments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Directly Assigned Resources</h4>
                      {assignments.map((assignment) => {
                        const resource = resources.find(r => r.id === assignment.resourceId);
                        return (
                          <div key={assignment.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{resource?.name || `Resource #${assignment.resourceId}`}</p>
                                <p className="text-xs text-muted-foreground">{resource?.type} • {resource?.discipline}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{assignment.allocation}%</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeResourceMutation.mutate(assignment.id)}
                                disabled={removeResourceMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {inheritedResources.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Inherited from Parent Tasks
                      </h4>
                      {inheritedResources.map((ir: any) => (
                        <div key={`inherited-${ir.assignmentId}`} className="flex items-center justify-between p-3 border border-dashed rounded bg-muted/20">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{ir.resource?.name || `Resource #${ir.resourceId}`}</p>
                              <p className="text-xs text-muted-foreground">{ir.resource?.type} • {ir.resource?.discipline}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            From: {ir.sourceTask?.wbsCode || `#${ir.sourceTaskId}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Available Resources</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowResourceCreation(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create New Resource
                      </Button>
                    </div>
                    {resources.filter(r => !assignedResourceIds.includes(r.id)).length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground py-4 text-center">All resources are already assigned</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowResourceCreation(true)}
                          className="w-full gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Create New Resource
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {resources.filter(r => !assignedResourceIds.includes(r.id)).map((resource) => (
                          <Card key={resource.id} className="hover-elevate cursor-pointer" onClick={() => addResourceMutation.mutate({ resourceId: resource.id, allocation: 100 })}>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{resource.name}</p>
                                  <p className="text-xs text-muted-foreground">{resource.type} • {resource.discipline}</p>
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Linked Documents</p>
                      <p className="text-xs text-muted-foreground">Attach documents to this task. Inherited documents from parent tasks are shown below.</p>
                    </div>
                  </div>

                  {taskDocuments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Directly Attached Documents</h4>
                      {taskDocuments.map((td: any) => {
                        const doc = documents.find(d => d.id === td.documentId);
                        return (
                          <div key={td.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{doc?.title || `Document #${td.documentId}`}</p>
                                <p className="text-xs text-muted-foreground">{doc?.documentNumber} • {doc?.documentType}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDocumentMutation.mutate(td.documentId)}
                              disabled={removeDocumentMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {inheritedDocuments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Inherited from Parent Tasks
                      </h4>
                      {inheritedDocuments.map((id: any) => (
                        <div key={`inherited-doc-${id.taskDocumentId}`} className="flex items-center justify-between p-3 border border-dashed rounded bg-muted/20">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{id.document?.title || `Document #${id.documentId}`}</p>
                              <p className="text-xs text-muted-foreground">{id.document?.documentNumber} • {id.document?.documentType}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            From: {id.sourceTask?.wbsCode || `#${id.sourceTaskId}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Available Documents</h4>
                    {documents.filter(d => !linkedDocIds.includes(d.id)).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No documents available to link</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                        {documents.filter(d => !linkedDocIds.includes(d.id)).map((doc) => (
                          <Card key={doc.id} className="hover-elevate cursor-pointer" onClick={() => addDocumentMutation.mutate({ documentId: doc.id })}>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{doc.title}</p>
                                  <p className="text-xs text-muted-foreground">{doc.documentNumber} • Rev {doc.revision}</p>
                                </div>
                              </div>
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="risks" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Linked Risks</p>
                      <p className="text-xs text-muted-foreground">Associate risks with this task. Inherited risks from parent tasks are shown below.</p>
                    </div>
                  </div>

                  {taskRisks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Directly Associated Risks</h4>
                      {taskRisks.map((tr: any) => {
                        const risk = risks.find(r => r.id === tr.riskId);
                        return (
                          <div key={tr.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs">{risk?.code}</Badge>
                                  <p className="text-sm font-medium">{risk?.title}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Impact: {risk?.impact} • Status: {risk?.status}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRiskMutation.mutate(tr.riskId)}
                              disabled={removeRiskMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {inheritedRisks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Inherited from Parent Tasks
                      </h4>
                      {inheritedRisks.map((ir: any) => (
                        <div key={`inherited-risk-${ir.taskRiskId}`} className="flex items-center justify-between p-3 border border-dashed rounded bg-muted/20">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">{ir.risk?.code}</Badge>
                                <p className="text-sm font-medium">{ir.risk?.title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">Impact: {ir.risk?.impact} • Status: {ir.risk?.status}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            From: {ir.sourceTask?.wbsCode || `#${ir.sourceTaskId}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Available Risks</h4>
                    {risks.filter(r => !linkedRiskIds.includes(r.id)).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No risks available to link</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                        {risks.filter(r => !linkedRiskIds.includes(r.id)).map((risk) => (
                          <Card key={risk.id} className="hover-elevate cursor-pointer" onClick={() => addRiskMutation.mutate(risk.id)}>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs">{risk.code}</Badge>
                                    <p className="text-sm font-medium">{risk.title}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Impact: {risk.impact}</p>
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="issues" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">Linked Issues</p>
                      <p className="text-xs text-muted-foreground">Associate issues with this task. Inherited issues from parent tasks are shown below.</p>
                    </div>
                  </div>

                  {taskIssues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Directly Associated Issues</h4>
                      {taskIssues.map((ti: any) => {
                        const issue = issues.find(i => i.id === ti.issueId);
                        return (
                          <div key={ti.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-3">
                              <AlertCircle className="h-5 w-5 text-red-500" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs">{issue?.code}</Badge>
                                  <p className="text-sm font-medium">{issue?.title}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Priority: {issue?.priority} • Status: {issue?.status}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeIssueMutation.mutate(ti.issueId)}
                              disabled={removeIssueMutation.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {inheritedIssues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Inherited from Parent Tasks
                      </h4>
                      {inheritedIssues.map((ii: any) => (
                        <div key={`inherited-issue-${ii.taskIssueId}`} className="flex items-center justify-between p-3 border border-dashed rounded bg-muted/20">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">{ii.issue?.code}</Badge>
                                <p className="text-sm font-medium">{ii.issue?.title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">Priority: {ii.issue?.priority} • Status: {ii.issue?.status}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            From: {ii.sourceTask?.wbsCode || `#${ii.sourceTaskId}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Available Issues</h4>
                    {issues.filter(i => !linkedIssueIds.includes(i.id)).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No issues available to link</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                        {issues.filter(i => !linkedIssueIds.includes(i.id)).map((issue) => (
                          <Card key={issue.id} className="hover-elevate cursor-pointer" onClick={() => addIssueMutation.mutate(issue.id)}>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs">{issue.code}</Badge>
                                    <p className="text-sm font-medium">{issue.title}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Priority: {issue.priority}</p>
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chat" className="space-y-4 mt-0 h-full">
                {task ? <TaskChatTab taskId={task.id} /> : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-sm text-muted-foreground">Please save the task first to enable chat.</p>
                  </div>
                )}
              </TabsContent>
            </div>
        </Tabs>

        <DialogFooter className="gap-2 shrink-0 border-t p-4">
          <Button variant="outline" onClick={handleClose} disabled={isLoading} data-testid="button-cancel">
            Cancel
          </Button>
          {isEditing && task && (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    // Check if constraint is applied
                    const hasConstraint = formData.constraintType !== "asap" && (task as any).constraintDate;
                    
                    const baselineData: any = {
                      baselineStart: formData.startDate,
                      baselineFinish: formData.endDate,
                    };
                    
                    // Include computedDuration if available
                    if ((task as any).computedDuration) {
                      baselineData.baselineDuration = (task as any).computedDuration;
                    }
                    
                    const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, baselineData);
                    const updatedTask = await response.json();
                    
                    // Update formData with refreshed baseline dates
                    setFormData(prev => ({
                      ...prev,
                      baselineStart: updatedTask.baselineStart ? new Date(updatedTask.baselineStart).toISOString().split('T')[0] : prev.baselineStart,
                      baselineFinish: updatedTask.baselineFinish ? new Date(updatedTask.baselineFinish).toISOString().split('T')[0] : prev.baselineFinish,
                    }));
                    
                    queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
                    toast({
                      title: "Baseline Set",
                      description: hasConstraint 
                        ? "Baseline dates set from planned dates (constraint may override)."
                        : "Baseline dates set from planned dates.",
                    });
                  } catch (error: any) {
                    console.error("Set baseline error:", error);
                    toast({
                      title: "Error",
                      description: error?.message || "Failed to set baseline.",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={isLoading || !formData.startDate || !formData.endDate || formData.progress === 100}
                data-testid="button-set-baseline"
                title={!formData.startDate || !formData.endDate ? "Set planned dates first" : formData.progress === 100 ? "Task completed - baseline locked" : ""}
              >
                Set Baseline
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  try {
                    // Send current form data to update the task first, which triggers recalculation
                    // This ensures the calculation is based on the values currently in the form
                    // Note: Send decimals as strings to ensure compatibility with Zod schema for decimal columns
                    const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
                      ...formData,
                      estimatedHours: formData.estimatedHours ? String(formData.estimatedHours) : null,
                      weightFactor: formData.weightFactor !== undefined && formData.weightFactor !== null ? String(formData.weightFactor) : null,
                    });
                    
                    // Check if response is actually JSON
                    const contentType = response.headers.get("content-type");
                    if (!contentType || !contentType.includes("application/json")) {
                      const text = await response.text();
                      console.error("Non-JSON response received:", text.substring(0, 200));
                      throw new Error(`Server returned ${response.status}: Expected JSON but got ${contentType}`);
                    }
                    
                    // The PATCH endpoint returns the updated task object directly
                    const updatedTask = await response.json();
                    
                    // Update formData with refreshed task data, especially endDate and computedDuration
                    if (updatedTask) {
                      setFormData(prev => ({
                        ...prev,
                        endDate: updatedTask.endDate ? new Date(updatedTask.endDate).toISOString().split('T')[0] : prev.endDate,
                        startDate: updatedTask.startDate ? new Date(updatedTask.startDate).toISOString().split('T')[0] : prev.startDate,
                        estimatedHours: updatedTask.estimatedHours ? String(updatedTask.estimatedHours) : prev.estimatedHours,
                      }));
                    }
                    
                    toast({
                      title: "Schedule Recalculated",
                      description: "Task updated and schedule recalculated based on new values.",
                    });
                    
                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });
                  } catch (error: any) {
                    // Parse error message from the error string (format: "500: error message")
                    const errorMatch = error?.message?.match(/^\d+:\s*(.+)$/);
                    const errorMessage = errorMatch?.[1] || error?.message || "Failed to recalculate schedule.";
                    console.error("Recalculate schedule error:", error);
                    toast({
                      title: "Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  }
                }}
                disabled={isLoading || formData.progress === 100}
                data-testid="button-recalculate-schedule"
                title={formData.progress === 100 ? "Task completed - calculations disabled" : ""}
              >
                <Activity className="h-4 w-4 mr-2" />
                Recalculate Schedule
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={isLoading} data-testid="button-save-task">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update Task" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskChatTab({ taskId }: { taskId: number }) {
  const { user } = useAuth();
  const { data: conversation, isLoading } = useTaskConversation(taskId);
  const createConversation = useCreateConversation();

  const handleCreateConversation = async () => {
    if (!user) return;
    
    try {
      await createConversation.mutateAsync({
        type: "task",
        taskId,
        participantIds: [user.id],
      });
    } catch (error) {
      console.error("Failed to create task conversation:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">No conversation yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start a conversation about this task
          </p>
        </div>
        <Button onClick={handleCreateConversation} disabled={createConversation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          {createConversation.isPending ? "Creating..." : "Start Conversation"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[500px] border rounded-lg overflow-hidden">
      <ChatWindow conversation={conversation} />
    </div>
  );
}

