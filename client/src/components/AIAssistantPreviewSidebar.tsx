import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Loader2, 
  Edit3,
  FileText,
  AlertTriangle,
  Calendar,
  DollarSign,
  Building2,
  ListChecks,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionPreview } from "./AIActionPreviewModal";

interface AIAssistantPreviewSidebarProps {
  preview: ActionPreview | null;
  functionName: string;
  args: any;
  onModify: (message: string) => void;
  onApprove?: () => void;
  onDismiss?: () => void;
}

export function AIAssistantPreviewSidebar({
  preview,
  functionName,
  args,
  onModify,
  onApprove,
  onDismiss,
}: AIAssistantPreviewSidebarProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [isModifying, setIsModifying] = useState(false);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview available");
      const response = await apiRequest("POST", "/api/ai/execute-action", {
        actionId: preview.actionId,
        functionName,
        args,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries();
      toast({
        title: "Project Created",
        description: "Your project has been created successfully!",
      });
      
      // Navigate to the new project if we have project data
      if (data?.result) {
        try {
          const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (result.project?.id) {
            navigate(`/projects/${result.project.id}`);
          } else if (result.summary?.projectId) {
            navigate(`/projects/${result.summary.projectId}`);
          }
        } catch (e) {
          // If navigation fails, just refresh projects list
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        }
      }
      
      onApprove?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Execution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleModify = () => {
    setIsModifying(true);
    // Focus on the message input in the parent component
    // The parent will handle the actual message sending
    onModify("Please modify the project based on my feedback:");
  };

  if (!preview) return null;

  // Extract project data from preview
  const projectData = preview.preview?.summary || preview.preview?.project || args;
  const tasksCount = preview.preview?.summary?.tasksCreated || preview.preview?.summary?.tasksCount || args?.initialTasks?.length || 0;
  const risksCount = preview.preview?.summary?.risksCreated || preview.preview?.summary?.risksCount || args?.initialRisks?.length || 0;

  return (
    <Card className="w-96 h-full flex flex-col border-l">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Project Preview
          </CardTitle>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDismiss}
            >
              ×
            </Button>
          )}
        </div>
        <Badge variant="outline" className="w-fit">
          {preview.type === 'create' ? 'CREATE' : preview.type.toUpperCase()}
        </Badge>
      </CardHeader>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          {/* Project Overview Section */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('overview')}
              className="w-full flex items-center justify-between text-sm font-semibold hover:text-primary transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Project Overview
              </div>
              {expandedSections.has('overview') ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {expandedSections.has('overview') && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  {projectData?.projectName || args?.name ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Name</p>
                      <p className="text-sm font-medium">{projectData?.projectName || args?.name}</p>
                    </div>
                  ) : null}
                  
                  {projectData?.code || args?.code ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Code</p>
                      <p className="text-sm font-medium">{projectData?.code || args?.code}</p>
                    </div>
                  ) : null}
                  
                  {projectData?.description || args?.description ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm text-xs line-clamp-3">{projectData?.description || args?.description}</p>
                    </div>
                  ) : null}
                  
                  <div className="grid grid-cols-2 gap-3">
                    {args?.startDate && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Start Date
                        </p>
                        <p className="text-sm font-medium">
                          {new Date(args.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    
                    {args?.endDate && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          End Date
                        </p>
                        <p className="text-sm font-medium">
                          {new Date(args.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {args?.budget && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Budget
                      </p>
                      <p className="text-sm font-medium">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: args?.currency || 'USD',
                          minimumFractionDigits: 0,
                        }).format(args.budget)}
                      </p>
                    </div>
                  )}
                  
                  {args?.status && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge variant="outline" className="capitalize">{args.status}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Tasks Section */}
          {tasksCount > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('tasks')}
                className="w-full flex items-center justify-between text-sm font-semibold hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Tasks ({tasksCount})
                </div>
                {expandedSections.has('tasks') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {expandedSections.has('tasks') && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    {args?.initialTasks && Array.isArray(args.initialTasks) ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {args.initialTasks.slice(0, 10).map((task: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {args.initialTasks.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{args.initialTasks.length - 10} more tasks
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {tasksCount} tasks will be created
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Separator />

          {/* Risks Section */}
          {risksCount > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('risks')}
                className="w-full flex items-center justify-between text-sm font-semibold hover:text-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risks ({risksCount})
                </div>
                {expandedSections.has('risks') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {expandedSections.has('risks') && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    {args?.initialRisks && Array.isArray(args.initialRisks) ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {args.initialRisks.slice(0, 10).map((risk: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{risk.title}</p>
                              {risk.category && (
                                <p className="text-xs text-muted-foreground">{risk.category}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {args.initialRisks.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{args.initialRisks.length - 10} more risks
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {risksCount} risks will be created
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </p>
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-4">
                    <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                      {preview.warnings.map((warning, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-0.5">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="p-4 border-t space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleModify}
          disabled={executeMutation.isPending || isModifying}
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Modify with AI
        </Button>
        <Button
          className="w-full"
          onClick={() => executeMutation.mutate()}
          disabled={executeMutation.isPending}
        >
          {executeMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve & Create
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

