import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionPreview {
  actionId: string;
  type: 'create' | 'update' | 'delete' | 'bulk';
  entity: string;
  description: string;
  changes: ActionChange[];
  affectedIds?: number[];
  warnings?: string[];
  preview?: any;
}

export interface ActionChange {
  field: string;
  oldValue?: any;
  newValue: any;
  type: 'add' | 'modify' | 'remove';
}

interface AIActionPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ActionPreview | null;
  functionName: string;
  args: any;
  onApproved?: () => void;
}

export function AIActionPreviewModal({
  open,
  onOpenChange,
  preview,
  functionName,
  args,
  onApproved,
}: AIActionPreviewModalProps) {
  const { toast } = useToast();

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview available");
      return await apiRequest("POST", "/api/ai/execute-action", {
        actionId: preview.actionId,
        functionName,
        args,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(); // Invalidate all queries to refresh data
      toast({
        title: "Action Executed",
        description: preview?.description || "Action completed successfully",
      });
      onApproved?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Execution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview available");
      return await apiRequest("POST", "/api/ai/reject-action", {
        actionId: preview.actionId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Action Rejected",
        description: "The action has been cancelled",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!preview) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'update': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'delete': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'bulk': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      default: return 'bg-muted';
    }
  };

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'add': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'modify': return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      case 'remove': return <X className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review AI Action
            <Badge className={getTypeColor(preview.type)}>
              {preview.type.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>{preview.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {preview.warnings.map((warning, idx) => (
                      <p key={idx}>{warning}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Changes List */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Changes to be made:</h4>
              <div className="space-y-2">
                {preview.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border",
                      change.type === 'add' && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                      change.type === 'modify' && "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
                      change.type === 'remove' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getChangeTypeIcon(change.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{change.field}</p>
                        {change.type === 'modify' && change.oldValue !== undefined && (
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground line-through">
                              {change.oldValue === null ? 'null' : String(change.oldValue)}
                            </p>
                            <p className="text-xs font-medium">
                              → {change.newValue === null ? 'null' : String(change.newValue)}
                            </p>
                          </div>
                        )}
                        {change.type === 'add' && (
                          <p className="text-xs font-medium mt-1">
                            {change.newValue === null ? 'null' : String(change.newValue)}
                          </p>
                        )}
                        {change.type === 'remove' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {change.oldValue === null ? 'null' : String(change.oldValue)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affected Entities */}
            {preview.affectedIds && preview.affectedIds.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">
                  Affected Items: {preview.affectedIds.length}
                </h4>
                {preview.type === 'bulk' && preview.affectedIds.length > 5 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {preview.affectedIds.slice(0, 5).map((id, idx) => (
                        <Badge key={idx} variant="outline">
                          ID: {id}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="bg-muted">
                        +{preview.affectedIds.length - 5} more
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This will affect {preview.affectedIds.length} items total
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preview.affectedIds.map((id, idx) => (
                      <Badge key={idx} variant="outline">
                        ID: {id}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Preview Data */}
            {preview.preview && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Preview:</h4>
                {/* Special handling for project creation */}
                {preview.preview.summary && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      {preview.preview.summary.tasksCount !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Initial Tasks</p>
                          <p className="text-lg font-semibold">{preview.preview.summary.tasksCount}</p>
                        </div>
                      )}
                      {preview.preview.summary.risksCount !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Initial Risks</p>
                          <p className="text-lg font-semibold">{preview.preview.summary.risksCount}</p>
                        </div>
                      )}
                    </div>
                    {preview.preview.project && (
                      <div className="pt-2 border-t space-y-1">
                        <p className="text-xs font-medium">Project: {preview.preview.project.name}</p>
                        {preview.preview.project.code && (
                          <p className="text-xs text-muted-foreground">Code: {preview.preview.project.code}</p>
                        )}
                        {preview.preview.project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{preview.preview.project.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Fallback to JSON for other previews */}
                {!preview.preview.summary && (
                  <div className="p-3 bg-muted rounded-lg">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(preview.preview, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => rejectMutation.mutate()}
            disabled={executeMutation.isPending || rejectMutation.isPending}
          >
            {rejectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              "Reject"
            )}
          </Button>
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending || rejectMutation.isPending}
            variant={preview.type === 'delete' ? 'destructive' : 'default'}
          >
            {executeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              `Approve & ${preview.type === 'delete' ? 'Delete' : 'Execute'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

