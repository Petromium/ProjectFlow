import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import type { Issue } from "@shared/schema";

interface EditIssueModalProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdIssue?: Issue) => void;
}

const ISSUE_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

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

export function EditIssueModal({ issue, open, onOpenChange, onSuccess }: EditIssueModalProps) {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const isEditing = !!issue;

  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    status: "open",
    priority: "medium",
    issueType: "design",
    impactCost: false,
    impactSchedule: false,
  });

  useEffect(() => {
    if (issue) {
      setFormData({
        code: issue.code,
        title: issue.title,
        description: issue.description || "",
        status: issue.status || "open",
        priority: issue.priority || "medium",
        issueType: issue.issueType || "design",
        impactCost: issue.impactCost || false,
        impactSchedule: issue.impactSchedule || false,
      });
    } else {
      resetForm();
    }
  }, [issue, open]);

  const resetForm = () => {
    setFormData({
      code: "",
      title: "",
      description: "",
      status: "open",
      priority: "medium",
      issueType: "design",
      impactCost: false,
      impactSchedule: false,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/issues", {
        ...data,
        projectId: selectedProjectId,
      });
      return await response.json();
    },
    onSuccess: (createdIssue: Issue) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "issues"] });
      toast({ title: "Success", description: "Issue created successfully" });
      onOpenChange(false);
      onSuccess?.(createdIssue);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create issue", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/issues/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "issues"] });
      toast({ title: "Success", description: "Issue updated successfully" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update issue", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }

    const data = {
      ...formData,
      description: formData.description?.trim() || null,
    };

    if (isEditing && issue) {
      updateMutation.mutate({ id: issue.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            {isEditing ? "Edit Issue" : "Report New Issue"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Issue title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                  {ISSUE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

           <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.issueType} onValueChange={(v) => setFormData({ ...formData, issueType: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-6 py-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="impact-cost" 
                checked={formData.impactCost}
                onCheckedChange={(checked) => setFormData({ ...formData, impactCost: !!checked })}
              />
              <Label htmlFor="impact-cost" className="font-normal cursor-pointer">Cost Impact</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="impact-schedule" 
                checked={formData.impactSchedule}
                onCheckedChange={(checked) => setFormData({ ...formData, impactSchedule: !!checked })}
              />
              <Label htmlFor="impact-schedule" className="font-normal cursor-pointer">Schedule Impact</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Issue description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Report"} Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

