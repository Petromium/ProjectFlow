import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import type { Risk, InsertRisk } from "@shared/schema";
import { insertRiskSchema } from "@shared/schema";
import { TagInput } from "@/components/ui/tag-input";
import { RiskSuggestions } from "@/components/RiskSuggestions";
import type { LessonLearned } from "@shared/schema";

interface EditRiskModalProps {
  risk: Risk | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdRisk?: Risk) => void;
}

const RISK_STATUSES = [
  { value: "identified", label: "Identified" },
  { value: "assessed", label: "Assessed" },
  { value: "mitigating", label: "Mitigating" },
  { value: "closed", label: "Closed" },
];

const IMPACT_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const RESPONSE_STRATEGIES = [
  { value: "avoid", label: "Avoid" },
  { value: "transfer", label: "Transfer" },
  { value: "mitigate", label: "Mitigate" },
  { value: "accept", label: "Accept" },
  { value: "escalate", label: "Escalate" },
];

export function EditRiskModal({ risk, open, onOpenChange, onSuccess }: EditRiskModalProps) {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const isEditing = !!risk;

  const [formData, setFormData] = useState<Partial<InsertRisk>>({
    code: "",
    title: "",
    description: "",
    status: "identified",
    probability: 3,
    impact: "medium",
    mitigationPlan: "",
    responseStrategy: "mitigate",
  });

  useEffect(() => {
    if (risk) {
      setFormData({
        code: risk.code,
        title: risk.title,
        description: risk.description || "",
        status: risk.status || "identified",
        probability: risk.probability || 3,
        impact: risk.impact || "medium",
        mitigationPlan: risk.mitigationPlan || "",
        responseStrategy: risk.responseStrategy || "mitigate",
      });
    } else {
      resetForm();
    }
  }, [risk, open]);

  const resetForm = () => {
    setFormData({
      code: "",
      title: "",
      description: "",
      status: "identified",
      probability: 3,
      impact: "medium",
      mitigationPlan: "",
      responseStrategy: "mitigate",
    });
  };

  const createMutation = useMutation<Risk, Error, InsertRisk>({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", "/api/risks", {
        ...data,
        projectId: selectedProjectId,
      });
      return await response.json();
    },
    onSuccess: (createdRisk) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "risks"] });
      toast({ title: "Success", description: "Risk created successfully" });
      onOpenChange(false);
      onSuccess?.(createdRisk);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create risk", variant: "destructive" });
    },
  });

  const updateMutation = useMutation<Risk, Error, Partial<InsertRisk>>({
    mutationFn: async (data) => {
      const response = await apiRequest("PATCH", `/api/risks/${risk?.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "risks"] });
      toast({ title: "Success", description: "Risk updated successfully" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update risk", variant: "destructive" });
    },
  });

  const handleSave = () => {
    // Validate using shared schema
    const payload = {
      ...formData,
      projectId: selectedProjectId,
      // Ensure probability is a number if it comes as string from input
      probability: Number(formData.probability),
      description: formData.description?.trim() || null,
      mitigationPlan: formData.mitigationPlan?.trim() || null,
      // Ensure non-empty strings
      code: formData.code || "", 
      title: formData.title || "",
    };

    const result = insertRiskSchema.safeParse(payload);

    if (!result.success) {
      const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
      toast({
        title: "Validation Error",
        description: "Please check the following fields:\n" + errorMessages,
        variant: "destructive",
      });
      return;
    }

    if (isEditing && risk) {
      updateMutation.mutate(result.data);
    } else {
      createMutation.mutate(result.data as InsertRisk);
    }
  };

  const handleApplySuggestion = (lesson: LessonLearned) => {
    setFormData(prev => ({
      ...prev,
      mitigationPlan: (prev.mitigationPlan ? prev.mitigationPlan + "\n\n" : "") + 
        `[Based on Lesson Learned: ${lesson.title}]\nRecommendation: ${lesson.outcome || lesson.actionTaken}`,
      description: (prev.description ? prev.description : "") || lesson.description,
    }));
    toast({
      title: "Suggestion Applied",
      description: "Risk details updated from Lesson Learned.",
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {isEditing ? "Edit Risk" : "Add New Risk"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Risk title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <RiskSuggestions 
              titleQuery={formData.title || ""} 
              onApplySuggestion={handleApplySuggestion} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={formData.responseStrategy} onValueChange={(v) => setFormData({ ...formData, responseStrategy: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_STRATEGIES.map((strategy) => (
                    <SelectItem key={strategy.value} value={strategy.value}>{strategy.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Probability (1-5)</Label>
              <Input 
                type="number" 
                min="1" 
                max="5" 
                value={formData.probability} 
                onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 1 })}
              />
            </div>

             <div className="space-y-2">
              <Label>Impact</Label>
              <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Risk description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mitigation">Mitigation Plan</Label>
            <Textarea
              id="mitigation"
              placeholder="Plan to address this risk"
              value={formData.mitigationPlan}
              onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              rows={3}
            />
          </div>

          {risk && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                entityType="risk"
                entityId={risk.id}
                placeholder="Add tags to categorize this risk..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Create"} Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

