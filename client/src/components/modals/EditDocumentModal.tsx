import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import type { Document } from "@shared/schema";

interface EditDocumentModalProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdDocument?: Document) => void;
}

const DOCUMENT_TYPES = [
  { value: "drawing", label: "Drawing" },
  { value: "specification", label: "Specification" },
  { value: "datasheet", label: "Datasheet" },
  { value: "calculation", label: "Calculation" },
  { value: "report", label: "Report" },
  { value: "procedure", label: "Procedure" },
  { value: "other", label: "Other" },
];

const DISCIPLINES = [
  { value: "general", label: "General" },
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "electrical", label: "Electrical" },
  { value: "piping", label: "Piping" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "architectural", label: "Architectural" },
];

const DOCUMENT_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ifa", label: "Issued for Approval" },
  { value: "ifc", label: "Issued for Construction" },
  { value: "as-built", label: "As Built" },
  { value: "superseded", label: "Superseded" },
  { value: "cancelled", label: "Cancelled" },
];

export function EditDocumentModal({ document, open, onOpenChange, onSuccess }: EditDocumentModalProps) {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const isEditing = !!document;

  const [formData, setFormData] = useState({
    documentNumber: "",
    title: "",
    description: "",
    discipline: "general",
    documentType: "drawing",
    revision: "0",
    status: "draft",
  });

  useEffect(() => {
    if (document) {
      setFormData({
        documentNumber: document.documentNumber,
        title: document.title,
        description: document.description || "",
        discipline: document.discipline || "general",
        documentType: document.documentType || "drawing",
        revision: document.revision || "0",
        status: document.status || "draft",
      });
    } else {
      resetForm();
    }
  }, [document, open]);

  const resetForm = () => {
    setFormData({
      documentNumber: "",
      title: "",
      description: "",
      discipline: "general",
      documentType: "drawing",
      revision: "0",
      status: "draft",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/documents", {
        ...data,
        projectId: selectedProjectId,
      });
      return await response.json();
    },
    onSuccess: (createdDocument: Document) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "documents"] });
      toast({ title: "Success", description: "Document created successfully" });
      onOpenChange(false);
      onSuccess?.(createdDocument);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create document", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/documents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "documents"] });
      toast({ title: "Success", description: "Document updated successfully" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update document", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.documentNumber.trim()) {
      toast({ title: "Validation Error", description: "Document number is required", variant: "destructive" });
      return;
    }
    if (!formData.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }

    const data = {
      ...formData,
      description: formData.description?.trim() || null,
    };

    if (isEditing && document) {
      updateMutation.mutate({ id: document.id, data });
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
            <FileText className="h-5 w-5 text-muted-foreground" />
            {isEditing ? "Edit Document" : "Add New Document"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-number">Document Number *</Label>
              <Input
                id="doc-number"
                placeholder="e.g. DWG-001"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revision">Revision</Label>
              <Input
                id="revision"
                value={formData.revision}
                onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Document title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.documentType} onValueChange={(v) => setFormData({ ...formData, documentType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             <div className="space-y-2">
              <Label>Discipline</Label>
              <Select value={formData.discipline} onValueChange={(v) => setFormData({ ...formData, discipline: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map((disc) => (
                    <SelectItem key={disc.value} value={disc.value}>{disc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description"
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
            {isEditing ? "Update" : "Create"} Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

