import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LessonLearned } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Plus, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProject } from "@/contexts/ProjectContext";

interface RiskSuggestionsProps {
  titleQuery: string;
  onApplySuggestion: (lesson: LessonLearned) => void;
}

export function RiskSuggestions({ titleQuery, onApplySuggestion }: RiskSuggestionsProps) {
  const { selectedOrgId } = useProject();
  const [debouncedQuery, setDebouncedQuery] = useState(titleQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleQuery.length >= 3) {
        setDebouncedQuery(titleQuery);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [titleQuery]);

  const { data: lessons, isLoading } = useQuery<LessonLearned[]>({
    queryKey: ["lessons-search", selectedOrgId, debouncedQuery],
    queryFn: async () => {
      if (!selectedOrgId || debouncedQuery.length < 3) return [];
      const res = await fetch(`/api/organizations/${selectedOrgId}/lessons/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedOrgId && debouncedQuery.length >= 3,
  });

  if (!titleQuery || titleQuery.length < 3) return null;
  if (isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Searching knowledge base...</div>;
  if (!lessons || lessons.length === 0) return null;

  return (
    <div className="mt-2 border rounded-md bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-amber-600">
        <Lightbulb className="h-4 w-4" />
        <span>Found {lessons.length} related lessons in Knowledge Base</span>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <Card key={lesson.id} className="bg-background border-l-4 border-l-amber-500">
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm">{lesson.title}</div>
                  <Badge variant="outline" className="text-[10px]">{lesson.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {lesson.outcome || lesson.description}
                </p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full h-7 text-xs"
                  onClick={() => onApplySuggestion(lesson)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Apply to Risk
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

