import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/contexts/ProjectContext";
import { DocumentProvider, useDocuments } from "@/contexts/DocumentContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, AlertTriangle, Loader2, FileText, Search, 
  MoreHorizontal, Pencil, Trash2, Download, Filter,
  FolderOpen, File, Clock, User, ArrowUpDown, Upload, X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@shared/schema";

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

const DOC_TYPE_CATEGORIES = [
  {
    label: "Technical",
    types: [
      { value: "drawing", label: "Drawing" },
      { value: "specification", label: "Specification" },
      { value: "datasheet", label: "Datasheet" },
      { value: "calculation", label: "Calculation" },
      { value: "report", label: "Report" },
    ]
  },
  {
    label: "Procedures",
    types: [
      { value: "sop", label: "SOP" },
      { value: "procedure", label: "Procedure" },
      { value: "work-instruction", label: "Work Instruction" },
      { value: "checklist", label: "Checklist" },
    ]
  },
  {
    label: "Commercial",
    types: [
      { value: "invoice", label: "Invoice" },
      { value: "rfp", label: "RFP" },
      { value: "contract", label: "Contract" },
      { value: "purchase-order", label: "Purchase Order" },
      { value: "quote", label: "Quote" },
    ]
  },
  {
    label: "Vendor",
    types: [
      { value: "vendor-doc", label: "Vendor Document" },
      { value: "certificate", label: "Certificate" },
      { value: "warranty", label: "Warranty" },
    ]
  },
  {
    label: "Project",
    types: [
      { value: "lessons-learned", label: "Lessons Learned" },
      { value: "bulletin", label: "Bulletin" },
      { value: "meeting-minutes", label: "Meeting Minutes" },
      { value: "transmittal", label: "Transmittal" },
    ]
  },
  {
    label: "Correspondence",
    types: [
      { value: "correspondence", label: "Correspondence" },
      { value: "rfi", label: "RFI" },
      { value: "ncr", label: "NCR" },
    ]
  },
  {
    label: "Other",
    types: [
      { value: "other", label: "Other" },
    ]
  }
];

const DOC_TYPES = DOC_TYPE_CATEGORIES.flatMap(cat => cat.types);

const DOC_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ifa", label: "Issued for Approval (IFA)" },
  { value: "ifc", label: "Issued for Construction (IFC)" },
  { value: "as-built", label: "As-Built" },
  { value: "superseded", label: "Superseded" },
  { value: "cancelled", label: "Cancelled" },
];

interface DocumentFormData {
  documentNumber: string;
  title: string;
  discipline: string;
  documentType: string;
  revision: string;
  status: string;
  description: string;
  file: File | null;
  filePath: string | null;
  fileSize: number | null;
}

function DocumentsPageContent() {
  const { selectedProjectId } = useProject();
  const { documents, isLoading, selectedDocumentId, setSelectedDocumentId } = useDocuments();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<string>("all");
  const [filterDocType, setFilterDocType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formData, setFormData] = useState<DocumentFormData>({
    documentNumber: "",
    title: "",
    discipline: "civil",
    documentType: "drawing",
    revision: "A",
    status: "draft",
    description: "",
    file: null,
    filePath: null,
    fileSize: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/documents`, {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "documents"] });
      toast({
        title: "Success",
        description: "Document created successfully",
      });
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create document",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/documents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "documents"] });
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = searchTerm === "" || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDiscipline = filterDiscipline === "all" || doc.discipline === filterDiscipline;
      const matchesDocType = filterDocType === "all" || doc.documentType === filterDocType;
      const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
      return matchesSearch && matchesDiscipline && matchesDocType && matchesStatus;
    });
  }, [documents, searchTerm, filterDiscipline, filterDocType, filterStatus]);

  const docsByDiscipline = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    DISCIPLINES.forEach(d => { grouped[d.value] = []; });
    filteredDocs.forEach(doc => {
      const discipline = doc.discipline || "other";
      if (!grouped[discipline]) grouped[discipline] = [];
      grouped[discipline].push(doc);
    });
    return grouped;
  }, [filteredDocs]);

  const handleOpenModal = (doc?: Document) => {
    if (doc) {
      setEditingDoc(doc);
      setFormData({
        documentNumber: doc.documentNumber,
        title: doc.title,
        discipline: doc.discipline || "civil",
        documentType: doc.documentType || "drawing",
        revision: doc.revision || "A",
        status: doc.status || "draft",
        description: doc.description || "",
        file: null,
        filePath: doc.filePath || null,
        fileSize: doc.fileSize || null,
      });
    } else {
      setEditingDoc(null);
      setFormData({
        documentNumber: "",
        title: "",
        discipline: "civil",
        documentType: "drawing",
        revision: "A",
        status: "draft",
        description: "",
        file: null,
        filePath: null,
        fileSize: null,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        file,
        fileSize: file.size,
      }));
    }
  };

  const removeSelectedFile = () => {
    setFormData(prev => ({
      ...prev,
      file: null,
      fileSize: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFile = async (file: File): Promise<{ filePath: string; fileSize: number } | null> => {
    try {
      const uploadUrlRes = await apiRequest("POST", `/api/projects/${selectedProjectId}/files/upload-url`, {
        fileSize: file.size
      });
      const { uploadURL, objectId } = await uploadUrlRes.json();

      await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      await apiRequest("POST", `/api/projects/${selectedProjectId}/files`, {
        name: objectId,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        objectPath: objectId,
        category: 'document',
        description: `Attachment for ${formData.documentNumber}`,
      });

      return { filePath: objectId, fileSize: file.size };
    } catch (error) {
      console.error("File upload error:", error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!formData.documentNumber.trim() || !formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Document number and title are required",
        variant: "destructive",
      });
      return;
    }

    let filePath = formData.filePath;
    let fileSize = formData.fileSize;

    if (formData.file) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadFile(formData.file);
        if (uploadResult) {
          filePath = uploadResult.filePath;
          fileSize = uploadResult.fileSize;
        }
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const data = {
      documentNumber: formData.documentNumber,
      title: formData.title,
      discipline: formData.discipline,
      documentType: formData.documentType,
      revision: formData.revision,
      status: formData.status,
      description: formData.description || null,
      filePath: filePath || null,
      fileSize: fileSize || null,
    };

    if (editingDoc) {
      updateMutation.mutate({ id: editingDoc.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (doc: Document) => {
    if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = DOC_STATUSES.find(s => s.value === status);
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "draft": "secondary",
      "ifa": "outline",
      "ifc": "default",
      "as-built": "default",
      "superseded": "destructive",
      "cancelled": "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const isLoading2 = createMutation.isPending || updateMutation.isPending || isUploading;

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select a project from the dropdown above to view documents.
          </AlertDescription>
        </Alert>
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="page-title-documents">Document Register</h1>
          <p className="text-muted-foreground">Manage project documents, drawings, and procedures</p>
        </div>
        <Button onClick={() => handleOpenModal()} data-testid="button-add-document">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-discipline">
            <SelectValue placeholder="Discipline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Disciplines</SelectItem>
            {DISCIPLINES.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDocType} onValueChange={setFilterDocType}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-doctype">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPE_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat.label}</div>
                {cat.types.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DOC_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <File className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {documents.filter(d => d.status === "ifc").length}
                </p>
                <p className="text-sm text-muted-foreground">Issued for Construction</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {documents.filter(d => d.status === "ifa").length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredDocs.length}</p>
                <p className="text-sm text-muted-foreground">Showing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Documents Yet</h2>
            <p className="text-muted-foreground mb-4">
              Start by adding project documents, drawings, and procedures.
            </p>
            <Button onClick={() => handleOpenModal()} data-testid="button-add-first-document">
              <Plus className="h-4 w-4 mr-2" />
              Add First Document
            </Button>
          </CardContent>
        </Card>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Results Found</h2>
            <p className="text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Document No.</th>
                    <th className="text-left p-4 font-medium">Title</th>
                    <th className="text-left p-4 font-medium">Discipline</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Rev</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr 
                      key={doc.id} 
                      className={`border-b cursor-pointer transition-colors ${
                        selectedDocumentId === doc.id 
                          ? "bg-primary/10 hover:bg-primary/15" 
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() => setSelectedDocumentId(doc.id)}
                      data-testid={`document-row-${doc.id}`}
                    >
                      <td className="p-4 font-mono text-sm">{doc.documentNumber}</td>
                      <td className="p-4">
                        <div className="font-medium">{doc.title}</div>
                        {doc.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {doc.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">
                          {DISCIPLINES.find(d => d.value === doc.discipline)?.label || doc.discipline}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        {DOC_TYPES.find(t => t.value === doc.documentType)?.label || doc.documentType}
                      </td>
                      <td className="p-4 font-mono">{doc.revision}</td>
                      <td className="p-4">{getStatusBadge(doc.status)}</td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-doc-actions-${doc.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenModal(doc)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(doc)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg" data-testid="modal-document">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Document" : "Add Document"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doc-number">Document Number *</Label>
                <Input
                  id="doc-number"
                  placeholder="e.g., DWG-CIV-001"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                  data-testid="input-doc-number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revision">Revision</Label>
                <Input
                  id="revision"
                  placeholder="e.g., A, B, 01"
                  value={formData.revision}
                  onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                  data-testid="input-revision"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter document title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-doc-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discipline">Discipline</Label>
                <Select 
                  value={formData.discipline} 
                  onValueChange={(value) => setFormData({ ...formData, discipline: value })}
                >
                  <SelectTrigger id="discipline" data-testid="select-doc-discipline">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-type">Type</Label>
                <Select 
                  value={formData.documentType} 
                  onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                >
                  <SelectTrigger id="doc-type" data-testid="select-doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status" data-testid="select-doc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter document description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="textarea-doc-description"
              />
            </div>

            <div className="space-y-2">
              <Label>File Attachment</Label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              {formData.file ? (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                  <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{formData.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(formData.file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeSelectedFile}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : formData.filePath ? (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                  <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">Existing file attached</p>
                    {formData.fileSize && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(formData.fileSize)}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-replace-file"
                  >
                    Replace
                  </Button>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-file"
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload a file</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, DWG up to 50MB</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseModal} disabled={isLoading2} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading2} data-testid="button-save-document">
              {isLoading2 && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDoc ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <DocumentProvider>
      <DocumentsPageContent />
    </DocumentProvider>
  );
}
