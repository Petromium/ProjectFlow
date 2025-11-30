import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle, Clock, Users, BarChart } from "lucide-react";

interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  metadata: {
    estimatedDuration?: number;
    complexity?: string;
    industry?: string;
    taskCount?: number;
    typicalTeamSize?: number;
  };
  templateData: {
    tasks?: Array<{ name: string; wbsCode: string; description?: string; status?: string }>;
    risks?: Array<{ title: string; impact?: string; probability?: number }>;
  };
}

interface TemplatePreviewProps {
  template: ProjectTemplate | null;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  if (!template) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed p-6 min-h-[200px]">
        <div className="text-center">
          <p className="text-sm">Select a template to preview details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 space-y-4">
      <Card className="flex-shrink-0">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg break-words">{template.name}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge>{template.category}</Badge>
                {template.metadata.industry && (
                  <Badge variant="outline" className="capitalize">{template.metadata.industry}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground break-words">{template.description}</p>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col items-center p-2 bg-muted rounded min-h-[60px] justify-center">
              <Clock className="h-4 w-4 mb-1 text-blue-500" />
              <span className="font-medium">{template.metadata.estimatedDuration || "-"} Days</span>
              <span className="text-muted-foreground text-[10px]">Est. Duration</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-muted rounded min-h-[60px] justify-center">
              <BarChart className="h-4 w-4 mb-1 text-orange-500" />
              <span className="font-medium capitalize text-[10px]">{template.metadata.complexity || "Medium"}</span>
              <span className="text-muted-foreground text-[10px]">Complexity</span>
            </div>
            <div className="flex flex-col items-center p-2 bg-muted rounded min-h-[60px] justify-center">
              <Users className="h-4 w-4 mb-1 text-green-500" />
              <span className="font-medium">{template.metadata.typicalTeamSize || "-"}</span>
              <span className="text-muted-foreground text-[10px]">Team Size</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
        <Card className="flex flex-col overflow-hidden flex-1 min-h-0">
          <CardHeader className="py-3 px-4 bg-muted/30 flex-shrink-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Included Tasks ({template.templateData.tasks?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
            <ScrollArea className="h-full p-4">
              <div className="space-y-3">
                {template.templateData.tasks?.map((task, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground min-w-[24px] mt-0.5 flex-shrink-0">{task.wbsCode}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-none break-words">{task.name}</p>
                      {task.description && <p className="text-xs text-muted-foreground mt-1 break-words">{task.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {template.templateData.risks && template.templateData.risks.length > 0 && (
          <Card className="flex flex-col overflow-hidden flex-shrink-0">
            <CardHeader className="py-3 px-4 bg-muted/30 flex-shrink-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Common Risks ({template.templateData.risks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
              <ScrollArea className="h-[150px] p-4">
                <div className="space-y-3">
                  {template.templateData.risks.map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <Badge variant={risk.impact === 'critical' || risk.impact === 'high' ? 'destructive' : 'outline'} className="h-5 px-1.5 text-[10px] capitalize mt-0.5 flex-shrink-0">
                        {risk.impact || 'Medium'}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-none break-words">{risk.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

