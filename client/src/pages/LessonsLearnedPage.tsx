import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LessonLearned } from "@shared/schema";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, BookOpen, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TagInput } from "@/components/ui/tag-input";

export default function LessonsLearnedPage() {
  const { selectedOrgId, terminology } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lessons, isLoading } = useQuery<LessonLearned[]>({
    queryKey: ["lessons", selectedOrgId, searchQuery],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const url = searchQuery
        ? `/api/organizations/${selectedOrgId}/lessons/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/organizations/${selectedOrgId}/lessons`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch lessons");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const createLessonMutation = useMutation({
    mutationFn: async (newLesson: any) => {
      const res = await fetch(`/api/organizations/${selectedOrgId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newLesson, organizationId: selectedOrgId }),
      });
      if (!res.ok) throw new Error("Failed to create lesson");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", selectedOrgId] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Lesson learned added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create lesson: " + error.message,
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState({
    title: "",
    category: "General",
    description: "",
    rootCause: "",
    actionTaken: "",
    outcome: "",
    impactRating: 3,
    applicability: "global",
    tags: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLessonMutation.mutate(formData);
  };

  if (!selectedOrgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Select {terminology.topLevel}</CardTitle>
            <CardDescription>
              Please select an {terminology.topLevel} to view lessons learned.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Capture and share lessons learned across the {terminology.topLevel}
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Lesson
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lesson Learned</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Vendor Delay on Concrete Delivery"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Procurement">Procurement</SelectItem>
                      <SelectItem value="Safety">Safety</SelectItem>
                      <SelectItem value="Quality">Quality</SelectItem>
                      <SelectItem value="Schedule">Schedule</SelectItem>
                      <SelectItem value="Cost">Cost</SelectItem>
                      <SelectItem value="Technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Situation / Context</Label>
                <Textarea
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what happened..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rootCause">Root Cause</Label>
                <Textarea
                  id="rootCause"
                  value={formData.rootCause}
                  onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                  placeholder="Why did it happen?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionTaken">Action Taken</Label>
                <Textarea
                  id="actionTaken"
                  value={formData.actionTaken}
                  onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  placeholder="What did you do about it?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome / Recommendation</Label>
                <Textarea
                  id="outcome"
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  placeholder="What was the result? What do you recommend for future?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="impact">Impact Rating (1-5)</Label>
                  <Select
                    value={formData.impactRating.toString()}
                    onValueChange={(value) => setFormData({ ...formData, impactRating: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Low Impact</SelectItem>
                      <SelectItem value="2">2 - Minor Impact</SelectItem>
                      <SelectItem value="3">3 - Moderate Impact</SelectItem>
                      <SelectItem value="4">4 - High Impact</SelectItem>
                      <SelectItem value="5">5 - Critical Impact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicability">Applicability</Label>
                  <Select
                    value={formData.applicability}
                    onValueChange={(value) => setFormData({ ...formData, applicability: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (All Projects)</SelectItem>
                      <SelectItem value="project_specific">Project Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput
                  placeholder="Add tags..."
                  tags={formData.tags.map(t => ({ id: 0, name: t, color: "#000", usageCount: 0, organizationId: selectedOrgId! }))}
                  setTags={(newTags) => setFormData({ ...formData, tags: newTags.map(t => t.name) })}
                  organizationId={selectedOrgId}
                  enableCreate={true}
                />
                <p className="text-xs text-muted-foreground">
                  Tags help the AI Assistant find this lesson when analyzing similar situations.
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createLessonMutation.isPending}>
                  {createLessonMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Lesson
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {lessons?.map((lesson) => (
              <Card key={lesson.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{lesson.category}</Badge>
                      {lesson.impactRating && lesson.impactRating >= 4 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> High Impact
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(lesson.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-2">{lesson.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {lesson.description}
                  </div>
                  
                  {lesson.outcome && (
                    <div className="bg-muted/50 p-3 rounded-md text-sm">
                      <p className="font-medium flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-600" /> Recommendation
                      </p>
                      <p className="text-muted-foreground line-clamp-2">{lesson.outcome}</p>
                    </div>
                  )}

                  <div className="mt-auto pt-2 flex flex-wrap gap-1">
                    {lesson.tags?.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {lessons?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No lessons learned found</h3>
                <p className="text-muted-foreground max-w-sm mt-2">
                  Start building your organization's knowledge base by adding your first lesson learned.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

