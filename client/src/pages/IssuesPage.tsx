import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TableRowCard } from "@/components/TableRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Edit, Trash2, AlertCircle, Calendar, CheckCircle2, AlertTriangle, DollarSign, Clock, Shield, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Issue } from "@shared/schema";

const ISSUE_TYPES = [
  { value: "design", label: "Design" },
  { value: "procurement", label: "Procurement" },
  { value: "construction", label: "Construction" },
  { value: "commissioning", label: "Commissioning" },
  { value: "hse", label: "HSE" },
  { value: "quality", label: "Quality" },
  { value: "commercial", label: "Commercial" },
  { value: "interface", label: "Interface" },
  { value: "resource", label: "Resource" },
];

const ROOT_CAUSE_CATEGORIES = [
  { value: "design-error", label: "Design Error" },
  { value: "material-defect", label: "Material Defect" },
  { value: "workmanship", label: "Workmanship" },
  { value: "equipment-failure", label: "Equipment Failure" },
  { value: "communication", label: "Communication" },
  { value: "planning", label: "Planning" },
  { value: "external-factors", label: "External Factors" },
  { value: "unknown", label: "Unknown" },
];

const ESCALATION_LEVELS = [
  { value: "project", label: "Project Level", description: "Resolved within project team" },
  { value: "program", label: "Program Level", description: "Escalated to program management" },
  { value: "executive", label: "Executive Level", description: "Requires executive decision" },
  { value: "client", label: "Client Level", description: "Client involvement required" },
];

const DISCIPLINES = [
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "electrical", label: "Electrical" },
  { value: "piping", label: "Piping" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "hvac", label: "HVAC" },
  { value: "architectural", label: "Architectural" },
  { value: "general", label: "General" },
];

interface IssueFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in-progress" | "resolved" | "closed";
  assignedTo: string;
  issueType: string;
  impactCost: boolean;
  impactSchedule: boolean;
  impactQuality: boolean;
  impactSafety: boolean;
  rootCauseCategory: string;
  rootCauseAnalysis: string;
  escalationLevel: string;
  targetResolutionDate: string;
  verificationRequired: boolean;
  resolution: string;
  discipline: string;
  areaCode: string;
}

const initialFormData: IssueFormData = {
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  assignedTo: "",
  issueType: "design",
  impactCost: false,
  impactSchedule: false,
  impactQuality: false,
  impactSafety: false,
  rootCauseCategory: "",
  rootCauseAnalysis: "",
  escalationLevel: "project",
  targetResolutionDate: "",
  verificationRequired: false,
  resolution: "",
  discipline: "general",
  areaCode: "",
};

export default function IssuesPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<number[]>([]);
  const [formData, setFormData] = useState<IssueFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");

  const { 
    data: issues = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Issue[]>({
    queryKey: [`/api/projects/${selectedProjectId}/issues`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  const filteredIssues = useMemo(() => {
    if (!searchQuery) return issues;
    const query = searchQuery.toLowerCase();
    return issues.filter(issue => 
      issue.title.toLowerCase().includes(query) ||
      issue.description?.toLowerCase().includes(query) ||
      issue.code?.toLowerCase().includes(query)
    );
  }, [issues, searchQuery]);

  const createMutation = useMutation({
    mutationFn: async (data: IssueFormData) => {
      if (!selectedProjectId) throw new Error("No project selected");
      const payload = {
        ...data,
        projectId: selectedProjectId,
        rootCauseCategory: data.rootCauseCategory || null,
        targetResolutionDate: data.targetResolutionDate || null,
        discipline: data.discipline || null,
        areaCode: data.areaCode || null,
      };
      await apiRequest("POST", "/api/issues", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/issues`] });
      setDialogOpen(false);
      setEditingIssue(null);
      resetForm();
      toast({ title: "Success", description: "Issue reported successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: IssueFormData }) => {
      const payload = {
        ...data,
        rootCauseCategory: data.rootCauseCategory || null,
        targetResolutionDate: data.targetResolutionDate || null,
        discipline: data.discipline || null,
        areaCode: data.areaCode || null,
      };
      await apiRequest("PATCH", `/api/issues/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/issues`] });
      setDialogOpen(false);
      setEditingIssue(null);
      resetForm();
      toast({ title: "Success", description: "Issue updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/issues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/issues`] });
      toast({ title: "Success", description: "Issue deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIssue) {
      updateMutation.mutate({ id: editingIssue.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (issue: Issue) => {
    setEditingIssue(issue);
    setFormData({
      title: issue.title,
      description: issue.description || "",
      priority: issue.priority as IssueFormData["priority"],
      status: issue.status as IssueFormData["status"],
      assignedTo: issue.assignedTo || "",
      issueType: issue.issueType || "design",
      impactCost: issue.impactCost || false,
      impactSchedule: issue.impactSchedule || false,
      impactQuality: issue.impactQuality || false,
      impactSafety: issue.impactSafety || false,
      rootCauseCategory: issue.rootCauseCategory || "",
      rootCauseAnalysis: issue.rootCauseAnalysis || "",
      escalationLevel: issue.escalationLevel || "project",
      targetResolutionDate: issue.targetResolutionDate ? new Date(issue.targetResolutionDate).toISOString().split('T')[0] : "",
      verificationRequired: issue.verificationRequired || false,
      resolution: issue.resolution || "",
      discipline: issue.discipline || "general",
      areaCode: issue.areaCode || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this issue?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingIssue(null);
    resetForm();
    setDialogOpen(true);
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive" as const;
      case "high": return "default" as const;
      case "medium": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "open": return "destructive" as const;
      case "in-progress": return "default" as const;
      case "resolved": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  const getImpactIcons = (issue: Issue) => {
    const impacts = [];
    if (issue.impactCost) impacts.push({ icon: DollarSign, label: "Cost", color: "text-amber-500" });
    if (issue.impactSchedule) impacts.push({ icon: Clock, label: "Schedule", color: "text-blue-500" });
    if (issue.impactQuality) impacts.push({ icon: Wrench, label: "Quality", color: "text-purple-500" });
    if (issue.impactSafety) impacts.push({ icon: Shield, label: "Safety", color: "text-red-500" });
    return impacts;
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
          <h1 className="text-3xl font-semibold">Issue Log</h1>
          <p className="text-muted-foreground">EPC Issue Tracking with Impact Assessment & Root Cause Analysis</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-issue">Report Issue</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load issues. {(error as Error).message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search issues..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-issues"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading issues...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Issues Found</h2>
          <p className="text-muted-foreground mb-4">Get started by reporting issues to your project</p>
          <Button onClick={handleAddNew} data-testid="button-add-first-issue">Report Issue</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[60px,3fr,1fr,1fr,1fr,1fr,100px,100px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div>Code</div>
            <div>Issue</div>
            <div>Type</div>
            <div>Priority</div>
            <div>Impacts</div>
            <div>Escalation</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          {filteredIssues.map((issue) => {
            const impacts = getImpactIcons(issue);
            return (
              <TableRowCard
                key={issue.id}
                id={issue.id.toString()}
                selected={selectedIssues.includes(issue.id)}
                onSelect={(selected) => {
                  setSelectedIssues(prev =>
                    selected ? [...prev, issue.id] : prev.filter(id => id !== issue.id)
                  );
                }}
                data-testid={`row-issue-${issue.id}`}
              >
                <div className="grid grid-cols-[60px,3fr,1fr,1fr,1fr,1fr,100px,100px] gap-4 items-center flex-1">
                  <div className="text-sm font-mono text-muted-foreground">{issue.code}</div>
                  <div>
                    <div className="font-medium">{issue.title}</div>
                    {issue.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{issue.description}</div>
                    )}
                    {issue.discipline && (
                      <Badge variant="outline" className="mt-1 text-xs capitalize">{issue.discipline}</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="capitalize">{issue.issueType || "design"}</Badge>
                  <Badge variant={getPriorityVariant(issue.priority)} className="capitalize">
                    {issue.priority}
                  </Badge>
                  <div className="flex gap-1">
                    {impacts.length > 0 ? (
                      impacts.map((impact, idx) => (
                        <span key={idx} title={impact.label}>
                          <impact.icon className={`h-4 w-4 ${impact.color}`} />
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="capitalize">{issue.escalationLevel || "project"}</Badge>
                  <Badge variant={getStatusVariant(issue.status)} className="capitalize">
                    {issue.status.replace("-", " ")}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-actions-${issue.id}`}>
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(issue)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(issue.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableRowCard>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-issue">
          <DialogHeader>
            <DialogTitle>{editingIssue ? "Edit Issue" : "Report Issue"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
                <TabsTrigger value="resolution">Resolution</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="title">Issue Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief description of the issue"
                      required
                      data-testid="input-issue-title"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of the issue, when it was discovered, and current situation"
                      rows={3}
                      data-testid="input-issue-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issueType">Issue Type</Label>
                    <Select
                      value={formData.issueType}
                      onValueChange={(value) => setFormData({ ...formData, issueType: value })}
                    >
                      <SelectTrigger data-testid="select-issue-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ISSUE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discipline">Discipline</Label>
                    <Select
                      value={formData.discipline}
                      onValueChange={(value) => setFormData({ ...formData, discipline: value })}
                    >
                      <SelectTrigger data-testid="select-issue-discipline">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCIPLINES.map((disc) => (
                          <SelectItem key={disc.value} value={disc.value}>{disc.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: IssueFormData["priority"]) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger data-testid="select-issue-priority">
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
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: IssueFormData["status"]) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger data-testid="select-issue-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="areaCode">Area/Zone Code</Label>
                    <Input
                      id="areaCode"
                      value={formData.areaCode}
                      onChange={(e) => setFormData({ ...formData, areaCode: e.target.value })}
                      placeholder="e.g., AREA-100, ZONE-A"
                      data-testid="input-issue-area"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input
                      id="assignedTo"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Person responsible for resolution"
                      data-testid="input-issue-assigned"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="impact" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label className="mb-3 block">Impact Assessment</Label>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="impactCost"
                          checked={formData.impactCost}
                          onCheckedChange={(checked) => setFormData({ ...formData, impactCost: !!checked })}
                          data-testid="checkbox-impact-cost"
                        />
                        <Label htmlFor="impactCost" className="flex items-center gap-2 cursor-pointer">
                          <DollarSign className="h-4 w-4 text-amber-500" />
                          Cost Impact
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="impactSchedule"
                          checked={formData.impactSchedule}
                          onCheckedChange={(checked) => setFormData({ ...formData, impactSchedule: !!checked })}
                          data-testid="checkbox-impact-schedule"
                        />
                        <Label htmlFor="impactSchedule" className="flex items-center gap-2 cursor-pointer">
                          <Clock className="h-4 w-4 text-blue-500" />
                          Schedule Impact
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="impactQuality"
                          checked={formData.impactQuality}
                          onCheckedChange={(checked) => setFormData({ ...formData, impactQuality: !!checked })}
                          data-testid="checkbox-impact-quality"
                        />
                        <Label htmlFor="impactQuality" className="flex items-center gap-2 cursor-pointer">
                          <Wrench className="h-4 w-4 text-purple-500" />
                          Quality Impact
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="impactSafety"
                          checked={formData.impactSafety}
                          onCheckedChange={(checked) => setFormData({ ...formData, impactSafety: !!checked })}
                          data-testid="checkbox-impact-safety"
                        />
                        <Label htmlFor="impactSafety" className="flex items-center gap-2 cursor-pointer">
                          <Shield className="h-4 w-4 text-red-500" />
                          Safety Impact
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="escalationLevel">Escalation Level</Label>
                    <Select
                      value={formData.escalationLevel}
                      onValueChange={(value) => setFormData({ ...formData, escalationLevel: value })}
                    >
                      <SelectTrigger data-testid="select-issue-escalation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESCALATION_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            <div className="flex flex-col">
                              <span>{level.label}</span>
                              <span className="text-xs text-muted-foreground">{level.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetResolutionDate">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Target Resolution Date
                    </Label>
                    <Input
                      id="targetResolutionDate"
                      type="date"
                      value={formData.targetResolutionDate}
                      onChange={(e) => setFormData({ ...formData, targetResolutionDate: e.target.value })}
                      data-testid="input-issue-target-date"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="col-span-2">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Root Cause Analysis
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rootCauseCategory">Root Cause Category</Label>
                    <Select
                      value={formData.rootCauseCategory}
                      onValueChange={(value) => setFormData({ ...formData, rootCauseCategory: value })}
                    >
                      <SelectTrigger data-testid="select-issue-root-cause">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOT_CAUSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="rootCauseAnalysis">Root Cause Analysis (5 Whys)</Label>
                    <Textarea
                      id="rootCauseAnalysis"
                      value={formData.rootCauseAnalysis}
                      onChange={(e) => setFormData({ ...formData, rootCauseAnalysis: e.target.value })}
                      placeholder="Document the 5 Whys analysis or other root cause investigation"
                      rows={4}
                      data-testid="input-issue-root-analysis"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="resolution" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="resolution">Resolution / Corrective Action</Label>
                    <Textarea
                      id="resolution"
                      value={formData.resolution}
                      onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                      placeholder="Describe the actions taken to resolve this issue"
                      rows={4}
                      data-testid="input-issue-resolution"
                    />
                  </div>

                  <div className="col-span-2 p-4 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="verificationRequired"
                        checked={formData.verificationRequired}
                        onCheckedChange={(checked) => setFormData({ ...formData, verificationRequired: !!checked })}
                        data-testid="checkbox-verification-required"
                      />
                      <Label htmlFor="verificationRequired" className="flex items-center gap-2 cursor-pointer">
                        <CheckCircle2 className="h-4 w-4" />
                        Verification Required
                        <span className="text-muted-foreground text-sm">(Does the fix require independent verification?)</span>
                      </Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingIssue
                    ? "Update Issue"
                    : "Report Issue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
