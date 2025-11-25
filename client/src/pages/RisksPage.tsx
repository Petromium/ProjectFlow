import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TableRowCard } from "@/components/TableRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Edit, Trash2, AlertCircle, DollarSign, Clock, Calendar, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Risk } from "@shared/schema";

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

const RISK_CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "external", label: "External" },
  { value: "organizational", label: "Organizational" },
  { value: "project-management", label: "Project Management" },
  { value: "commercial", label: "Commercial" },
  { value: "hse", label: "HSE" },
  { value: "quality", label: "Quality" },
  { value: "schedule", label: "Schedule" },
  { value: "resource", label: "Resource" },
];

const RESPONSE_STRATEGIES = [
  { value: "avoid", label: "Avoid", description: "Eliminate the threat entirely" },
  { value: "transfer", label: "Transfer", description: "Shift to third party (insurance, contract)" },
  { value: "mitigate", label: "Mitigate", description: "Reduce probability or impact" },
  { value: "accept", label: "Accept", description: "Acknowledge and monitor" },
  { value: "escalate", label: "Escalate", description: "Raise to higher authority" },
];

interface RiskFormData {
  title: string;
  description: string;
  probability: number;
  impact: "low" | "medium" | "high" | "critical";
  status: "identified" | "assessed" | "mitigating" | "closed";
  mitigationPlan: string;
  owner: string;
  categoryEpc: string;
  responseStrategy: string;
  costImpact: string;
  scheduleImpact: string;
  triggerEvents: string;
  contingencyReserve: string;
  secondaryRisks: string;
  residualProbability: string;
  residualImpact: string;
  reviewDate: string;
  discipline: string;
}

const initialFormData: RiskFormData = {
  title: "",
  description: "",
  probability: 3,
  impact: "medium",
  status: "identified",
  mitigationPlan: "",
  owner: "",
  categoryEpc: "technical",
  responseStrategy: "mitigate",
  costImpact: "",
  scheduleImpact: "",
  triggerEvents: "",
  contingencyReserve: "",
  secondaryRisks: "",
  residualProbability: "",
  residualImpact: "",
  reviewDate: "",
  discipline: "general",
};

export default function RisksPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [selectedRisks, setSelectedRisks] = useState<number[]>([]);
  const [formData, setFormData] = useState<RiskFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");

  const { 
    data: risks = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<Risk[]>({
    queryKey: [`/api/projects/${selectedProjectId}/risks`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  const filteredRisks = useMemo(() => {
    if (!searchQuery) return risks;
    const query = searchQuery.toLowerCase();
    return risks.filter(risk => 
      risk.title.toLowerCase().includes(query) ||
      risk.description?.toLowerCase().includes(query) ||
      risk.code?.toLowerCase().includes(query)
    );
  }, [risks, searchQuery]);

  const calculateRiskExposure = (probability: number, impact: string, costImpact: string): number => {
    const impactMultiplier: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    const cost = parseFloat(costImpact) || 0;
    return (probability / 5) * (impactMultiplier[impact] || 1) * cost;
  };

  const riskExposure = useMemo(() => {
    return calculateRiskExposure(formData.probability, formData.impact, formData.costImpact);
  }, [formData.probability, formData.impact, formData.costImpact]);

  const createMutation = useMutation({
    mutationFn: async (data: RiskFormData) => {
      if (!selectedProjectId) throw new Error("No project selected");
      const payload = {
        ...data,
        projectId: selectedProjectId,
        costImpact: data.costImpact || null,
        scheduleImpact: data.scheduleImpact ? parseInt(data.scheduleImpact) : null,
        contingencyReserve: data.contingencyReserve || null,
        residualProbability: data.residualProbability ? parseInt(data.residualProbability) : null,
        residualImpact: data.residualImpact || null,
        reviewDate: data.reviewDate || null,
        riskExposure: riskExposure > 0 ? riskExposure.toFixed(2) : null,
      };
      await apiRequest("POST", "/api/risks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/risks`] });
      setDialogOpen(false);
      setEditingRisk(null);
      resetForm();
      toast({ title: "Success", description: "Risk added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RiskFormData }) => {
      const payload = {
        ...data,
        costImpact: data.costImpact || null,
        scheduleImpact: data.scheduleImpact ? parseInt(data.scheduleImpact) : null,
        contingencyReserve: data.contingencyReserve || null,
        residualProbability: data.residualProbability ? parseInt(data.residualProbability) : null,
        residualImpact: data.residualImpact || null,
        reviewDate: data.reviewDate || null,
        riskExposure: riskExposure > 0 ? riskExposure.toFixed(2) : null,
      };
      await apiRequest("PATCH", `/api/risks/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/risks`] });
      setDialogOpen(false);
      setEditingRisk(null);
      resetForm();
      toast({ title: "Success", description: "Risk updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/risks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/risks`] });
      toast({ title: "Success", description: "Risk deleted successfully" });
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
    if (editingRisk) {
      updateMutation.mutate({ id: editingRisk.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (risk: Risk) => {
    setEditingRisk(risk);
    setFormData({
      title: risk.title,
      description: risk.description || "",
      probability: risk.probability,
      impact: risk.impact as RiskFormData["impact"],
      status: risk.status as RiskFormData["status"],
      mitigationPlan: risk.mitigationPlan || "",
      owner: risk.owner || "",
      categoryEpc: risk.categoryEpc || "technical",
      responseStrategy: risk.responseStrategy || "mitigate",
      costImpact: risk.costImpact?.toString() || "",
      scheduleImpact: risk.scheduleImpact?.toString() || "",
      triggerEvents: risk.triggerEvents || "",
      contingencyReserve: risk.contingencyReserve?.toString() || "",
      secondaryRisks: risk.secondaryRisks || "",
      residualProbability: risk.residualProbability?.toString() || "",
      residualImpact: risk.residualImpact || "",
      reviewDate: risk.reviewDate ? new Date(risk.reviewDate).toISOString().split('T')[0] : "",
      discipline: risk.discipline || "general",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this risk?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingRisk(null);
    resetForm();
    setDialogOpen(true);
  };

  const getRiskLevel = (probability: number, impact: string) => {
    if ((probability >= 4 && (impact === "high" || impact === "critical")) || (probability === 5)) {
      return { level: "Critical", variant: "destructive" as const };
    }
    if ((probability >= 3 && (impact === "high" || impact === "critical")) || (probability >= 4 && impact === "medium")) {
      return { level: "High", variant: "default" as const };
    }
    if ((probability >= 2 && impact === "medium") || (probability >= 3 && impact === "low")) {
      return { level: "Medium", variant: "secondary" as const };
    }
    return { level: "Low", variant: "outline" as const };
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "-";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
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
          <h1 className="text-3xl font-semibold">Risk Register</h1>
          <p className="text-muted-foreground">EPC Risk Management with Cost & Schedule Impact Analysis</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-risk">Add Risk</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load risks. {(error as Error).message}</span>
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
          placeholder="Search risks..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-risks"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading risks...</p>
        </div>
      ) : filteredRisks.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Risks Found</h2>
          <p className="text-muted-foreground mb-4">Get started by adding risks to your project</p>
          <Button onClick={handleAddNew} data-testid="button-add-first-risk">Add Risk</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[60px,3fr,1fr,1fr,1fr,1fr,1fr,100px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div>Code</div>
            <div>Risk</div>
            <div>Category</div>
            <div>Risk Level</div>
            <div>Response</div>
            <div>Exposure</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          {filteredRisks.map((risk) => {
            const riskLevel = getRiskLevel(risk.probability, risk.impact);
            const exposure = risk.riskExposure ? parseFloat(risk.riskExposure.toString()) : 
              calculateRiskExposure(risk.probability, risk.impact, risk.costImpact?.toString() || "0");
            return (
              <TableRowCard
                key={risk.id}
                id={risk.id.toString()}
                selected={selectedRisks.includes(risk.id)}
                onSelect={(selected) => {
                  setSelectedRisks(prev =>
                    selected ? [...prev, risk.id] : prev.filter(id => id !== risk.id)
                  );
                }}
                data-testid={`row-risk-${risk.id}`}
              >
                <div className="grid grid-cols-[60px,3fr,1fr,1fr,1fr,1fr,1fr,100px] gap-4 items-center flex-1">
                  <div className="text-sm font-mono text-muted-foreground">{risk.code}</div>
                  <div>
                    <div className="font-medium">{risk.title}</div>
                    {risk.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{risk.description}</div>
                    )}
                    {risk.discipline && (
                      <Badge variant="outline" className="mt-1 text-xs capitalize">{risk.discipline}</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="capitalize">{risk.categoryEpc || "technical"}</Badge>
                  <Badge variant={riskLevel.variant}>{riskLevel.level}</Badge>
                  <Badge variant="secondary" className="capitalize">{risk.responseStrategy || "mitigate"}</Badge>
                  <div className="font-mono text-sm">
                    {exposure > 0 ? formatCurrency(exposure) : "-"}
                  </div>
                  <Badge variant={risk.status === "closed" ? "secondary" : "default"} className="capitalize">
                    {risk.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-actions-${risk.id}`}>
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(risk)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(risk.id)} className="text-destructive">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-risk">
          <DialogHeader>
            <DialogTitle>{editingRisk ? "Edit Risk" : "Add Risk"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
                <TabsTrigger value="response">Response & Residual</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="title">Risk Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief description of the risk"
                      required
                      data-testid="input-risk-title"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of the risk, its causes and potential consequences"
                      rows={3}
                      data-testid="input-risk-description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoryEpc">Risk Category (AACE)</Label>
                    <Select
                      value={formData.categoryEpc}
                      onValueChange={(value) => setFormData({ ...formData, categoryEpc: value })}
                    >
                      <SelectTrigger data-testid="select-risk-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
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
                      <SelectTrigger data-testid="select-risk-discipline">
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
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: RiskFormData["status"]) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger data-testid="select-risk-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identified">Identified</SelectItem>
                        <SelectItem value="assessed">Assessed</SelectItem>
                        <SelectItem value="mitigating">Mitigating</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner">Risk Owner</Label>
                    <Input
                      id="owner"
                      value={formData.owner}
                      onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                      placeholder="Person responsible for this risk"
                      data-testid="input-risk-owner"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="impact" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="probability">Probability (1-5)</Label>
                    <Select
                      value={formData.probability.toString()}
                      onValueChange={(value) => setFormData({ ...formData, probability: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-risk-probability">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Very Unlikely (≤10%)</SelectItem>
                        <SelectItem value="2">2 - Unlikely (11-30%)</SelectItem>
                        <SelectItem value="3">3 - Possible (31-50%)</SelectItem>
                        <SelectItem value="4">4 - Likely (51-70%)</SelectItem>
                        <SelectItem value="5">5 - Very Likely (&gt;70%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="impact">Impact Severity</Label>
                    <Select
                      value={formData.impact}
                      onValueChange={(value: RiskFormData["impact"]) => setFormData({ ...formData, impact: value })}
                    >
                      <SelectTrigger data-testid="select-risk-impact">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Minor impact</SelectItem>
                        <SelectItem value="medium">Medium - Moderate impact</SelectItem>
                        <SelectItem value="high">High - Major impact</SelectItem>
                        <SelectItem value="critical">Critical - Severe impact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costImpact">
                      <DollarSign className="inline h-4 w-4 mr-1" />
                      Cost Impact ($)
                    </Label>
                    <Input
                      id="costImpact"
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.costImpact}
                      onChange={(e) => setFormData({ ...formData, costImpact: e.target.value })}
                      placeholder="Estimated cost if risk occurs"
                      data-testid="input-risk-cost-impact"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduleImpact">
                      <Clock className="inline h-4 w-4 mr-1" />
                      Schedule Impact (days)
                    </Label>
                    <Input
                      id="scheduleImpact"
                      type="number"
                      min="0"
                      value={formData.scheduleImpact}
                      onChange={(e) => setFormData({ ...formData, scheduleImpact: e.target.value })}
                      placeholder="Days delay if risk occurs"
                      data-testid="input-risk-schedule-impact"
                    />
                  </div>

                  <div className="col-span-2 p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Risk Exposure (Calculated)</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(riskExposure)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      P × Impact × Cost = {formData.probability}/5 × {formData.impact} × {formatCurrency(parseFloat(formData.costImpact) || 0)}
                    </p>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="triggerEvents">Trigger Events</Label>
                    <Textarea
                      id="triggerEvents"
                      value={formData.triggerEvents}
                      onChange={(e) => setFormData({ ...formData, triggerEvents: e.target.value })}
                      placeholder="Conditions or events that would activate this risk"
                      rows={2}
                      data-testid="input-risk-triggers"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="response" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responseStrategy">Response Strategy</Label>
                    <Select
                      value={formData.responseStrategy}
                      onValueChange={(value) => setFormData({ ...formData, responseStrategy: value })}
                    >
                      <SelectTrigger data-testid="select-risk-response">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESPONSE_STRATEGIES.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            <div className="flex flex-col">
                              <span>{strategy.label}</span>
                              <span className="text-xs text-muted-foreground">{strategy.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contingencyReserve">
                      <DollarSign className="inline h-4 w-4 mr-1" />
                      Contingency Reserve ($)
                    </Label>
                    <Input
                      id="contingencyReserve"
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.contingencyReserve}
                      onChange={(e) => setFormData({ ...formData, contingencyReserve: e.target.value })}
                      placeholder="Budget allocated for this risk"
                      data-testid="input-risk-contingency"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="mitigationPlan">Mitigation Plan</Label>
                    <Textarea
                      id="mitigationPlan"
                      value={formData.mitigationPlan}
                      onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
                      placeholder="Specific actions to reduce probability or impact"
                      rows={3}
                      data-testid="input-risk-mitigation"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="secondaryRisks">Secondary Risks</Label>
                    <Textarea
                      id="secondaryRisks"
                      value={formData.secondaryRisks}
                      onChange={(e) => setFormData({ ...formData, secondaryRisks: e.target.value })}
                      placeholder="New risks that may arise from mitigation actions"
                      rows={2}
                      data-testid="input-risk-secondary"
                    />
                  </div>

                  <Separator className="col-span-2" />

                  <div className="col-span-2">
                    <h4 className="font-medium mb-3">Residual Risk (After Mitigation)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="residualProbability">Residual Probability (1-5)</Label>
                        <Select
                          value={formData.residualProbability}
                          onValueChange={(value) => setFormData({ ...formData, residualProbability: value })}
                        >
                          <SelectTrigger data-testid="select-risk-residual-probability">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Very Unlikely</SelectItem>
                            <SelectItem value="2">2 - Unlikely</SelectItem>
                            <SelectItem value="3">3 - Possible</SelectItem>
                            <SelectItem value="4">4 - Likely</SelectItem>
                            <SelectItem value="5">5 - Very Likely</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="residualImpact">Residual Impact</Label>
                        <Select
                          value={formData.residualImpact}
                          onValueChange={(value) => setFormData({ ...formData, residualImpact: value })}
                        >
                          <SelectTrigger data-testid="select-risk-residual-impact">
                            <SelectValue placeholder="Select..." />
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewDate">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Next Review Date
                    </Label>
                    <Input
                      id="reviewDate"
                      type="date"
                      value={formData.reviewDate}
                      onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                      data-testid="input-risk-review-date"
                    />
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
                  : editingRisk
                    ? "Update Risk"
                    : "Add Risk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
