import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutTemplate, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  };
  templateData: any;
}

interface TemplateSelectorProps {
  onSelect: (template: ProjectTemplate) => void;
  selectedTemplateId?: number;
}

export function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
  });

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!templates?.length) {
    return <div className="text-center p-8 text-muted-foreground">No templates available.</div>;
  }

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];
  const filteredTemplates = categoryFilter === "all" 
    ? templates 
    : templates.filter(t => t.category === categoryFilter);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="capitalize min-h-[44px]">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollArea className="flex-1 min-h-0 pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className={cn(
                "cursor-pointer transition-all hover:border-primary min-h-[120px]",
                selectedTemplateId === template.id ? "border-primary ring-1 ring-primary" : ""
              )}
              onClick={() => onSelect(template)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="mb-2">{template.category}</Badge>
                  {selectedTemplateId === template.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </div>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded min-h-[28px]">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    {template.metadata?.taskCount || 0} Tasks
                  </div>
                  <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded capitalize min-h-[28px]">
                    {template.metadata?.complexity || "Medium"} Complexity
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

