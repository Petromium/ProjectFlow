import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, Calendar, User, Tag, 
  Download, ExternalLink, Clock, File
} from "lucide-react";
import { useDocumentsOptional } from "@/contexts/DocumentContext";
import { format } from "date-fns";

const DOC_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "draft": { label: "Draft", variant: "secondary" },
  "ifa": { label: "Issued for Approval", variant: "outline" },
  "ifc": { label: "Issued for Construction", variant: "default" },
  "as-built": { label: "As-Built", variant: "default" },
  "superseded": { label: "Superseded", variant: "destructive" },
  "cancelled": { label: "Cancelled", variant: "destructive" },
};

const DISCIPLINES: Record<string, string> = {
  "civil": "Civil",
  "structural": "Structural",
  "mechanical": "Mechanical",
  "electrical": "Electrical",
  "instrumentation": "Instrumentation",
  "piping": "Piping",
  "process": "Process",
  "hse": "HSE",
  "project-controls": "Project Controls",
  "construction": "Construction",
  "commissioning": "Commissioning",
  "general": "General",
};

const DOC_TYPES: Record<string, string> = {
  "drawing": "Drawing",
  "specification": "Specification",
  "datasheet": "Datasheet",
  "calculation": "Calculation",
  "report": "Report",
  "sop": "SOP",
  "procedure": "Procedure",
  "work-instruction": "Work Instruction",
  "checklist": "Checklist",
  "invoice": "Invoice",
  "rfp": "RFP",
  "contract": "Contract",
  "purchase-order": "Purchase Order",
  "quote": "Quote",
  "warranty": "Warranty",
  "vendor-doc": "Vendor Document",
  "certificate": "Certificate",
  "lessons-learned": "Lessons Learned",
  "bulletin": "Bulletin",
  "meeting-minutes": "Meeting Minutes",
  "transmittal": "Transmittal",
  "rfi": "RFI",
  "ncr": "NCR",
  "letter": "Letter",
  "email": "Email",
  "memo": "Memo",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function DocumentDetails() {
  const context = useDocumentsOptional();
  
  if (!context) {
    return null;
  }

  const { selectedDocument } = context;

  if (!selectedDocument) {
    return (
      <Card data-testid="widget-document-details">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Select a document from the list to view its details
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = DOC_STATUSES[selectedDocument.status || "draft"] || DOC_STATUSES.draft;
  const discipline = DISCIPLINES[selectedDocument.discipline || "general"] || selectedDocument.discipline || "General";
  const docType = DOC_TYPES[selectedDocument.documentType || "drawing"] || selectedDocument.documentType || "Document";

  return (
    <Card data-testid="widget-document-details">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Document Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Document Number</p>
          <p className="text-sm font-medium">{selectedDocument.documentNumber}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Title</p>
          <p className="text-sm">{selectedDocument.title}</p>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Type
            </p>
            <p className="text-sm">{docType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discipline</p>
            <p className="text-sm">{discipline}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Revision</p>
            <p className="text-sm font-medium">{selectedDocument.revision || "A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusInfo.variant} className="mt-0.5">
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {selectedDocument.description && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm text-muted-foreground mt-1">{selectedDocument.description}</p>
            </div>
          </>
        )}

        {selectedDocument.filePath && (
          <>
            <Separator />
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs">Attached File</p>
                  {selectedDocument.fileSize && (
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedDocument.fileSize)}</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-download-file">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {selectedDocument.createdAt && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {format(new Date(selectedDocument.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
