import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { insertProjectSchema, type InsertProject, type Project } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus, LayoutTemplate, Sparkles, Upload, ArrowLeft, Loader2 } from "lucide-react";
import { ImportFieldMapper } from "./ImportFieldMapper";

import { TemplateSelector } from "./TemplateSelector";
import { TemplatePreview } from "./TemplatePreview";
import { CreateProjectAIStep } from "./CreateProjectAIStep";

// Extend shared schema for UI specific needs (e.g. optional code for templates)
const projectSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
});

// Schema for Template Project (no code required, matches existing behavior)
const templateProjectSchema = insertProjectSchema.extend({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CreationMethod = 'empty' | 'template' | 'ai' | 'import';

export function CreateProjectWizard({ open, onOpenChange }: CreateProjectWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [method, setMethod] = useState<CreationMethod | null>(null);
  const { toast } = useToast();
  const { selectedOrgId } = useProject();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      // Small delay to allow animation to finish
      const timer = setTimeout(() => {
        setStep(1);
        setMethod(null);
        setSelectedTemplate(null);
        form.reset();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(method === 'template' ? templateProjectSchema : projectSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "planning",
    },
  });

  const createMutation = useMutation<Project, Error, ProjectFormValues>({
    mutationFn: async (data: ProjectFormValues) => {
      if (!selectedOrgId) {
        throw new Error("No organization selected. Please select an organization first.");
      }
      
      const res = await apiRequest("POST", "/api/projects", {
        ...data,
        organizationId: selectedOrgId,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Success", description: "Project created successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const templateMutation = useMutation({
    mutationFn: async (data: { name: string; startDate: string }) => {
      if (!selectedOrgId || !selectedTemplate) {
        throw new Error("Missing required data");
      }
      
      const res = await apiRequest("POST", `/api/project-templates/${selectedTemplate.id}/create-project`, {
        name: data.name,
        organizationId: selectedOrgId,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Success", description: "Project created from template successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProjectFormValues) => {
    // Extra validation layer using the shared schema before submitting
    // Although hook-form uses the schema, this is a double check and handles manual mutation calls safer
    if (method === 'template') {
      if (!selectedTemplate) {
         toast({ title: "Error", description: "Please select a template", variant: "destructive" });
         return;
      }
      templateMutation.mutate({ name: data.name, startDate: data.startDate || "" });
    } else {
      const payload = {
        ...data,
        organizationId: selectedOrgId,
        // Dates need to be Date objects for the schema validation if we were to run it manually here
        // but for the API call, strings are fine if the API handles them or we convert in mutationFn
      };
      createMutation.mutate(data);
    }
  };

  const handleMethodSelect = (selectedMethod: CreationMethod) => {
    setMethod(selectedMethod);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setMethod(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[1200px] lg:max-w-[1400px] max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? "Create New Project" : 
               method === 'empty' ? "Project Details" :
               method === 'template' ? "Select Template" :
               method === 'ai' ? "Generate with AI" :
               "Import Project Data"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? "Choose how you would like to start your new project." : 
               method === 'empty' ? "Enter the basic details for your project." :
               method === 'template' ? "Start from a pre-built industry template." :
               method === 'ai' ? "Describe your project and let AI build the structure." :
               "Upload a JSON file and map your data fields."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === 1 && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <MethodCard
                icon={FilePlus}
                title="Create Empty Project"
                description="Start with a blank project and build from scratch."
                onClick={() => handleMethodSelect('empty')}
              />
              <MethodCard
                icon={LayoutTemplate}
                title="Create from Template"
                description="Choose from pre-built templates or your saved projects."
                onClick={() => handleMethodSelect('template')}
              />
              <MethodCard
                icon={Sparkles}
                title="Create from AI"
                description="Describe your project and let AI generate the structure."
                onClick={() => handleMethodSelect('ai')}
              />
              <MethodCard
                icon={Upload}
                title="Create from Import"
                description="Upload a JSON file and map fields to your project structure."
                onClick={() => handleMethodSelect('import')}
              />
            </div>
          </div>
        )}

        {step === 2 && method === 'empty' && (
          <div className="px-6 pb-6 flex-1 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Refinery Expansion" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. P-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Project details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        )}
        {step === 2 && method === 'empty' && (
          <DialogFooter className="px-6 pb-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </DialogFooter>
        )}

        {step === 2 && method === 'template' && (
          <>
            <div className="px-6 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
                  <TemplateSelector onSelect={setSelectedTemplate} selectedTemplateId={selectedTemplate?.id} />
                </div>
                <div className="lg:col-span-1 flex flex-col min-h-0 overflow-hidden lg:border-l lg:pl-6 pt-4 lg:pt-0">
                  <TemplatePreview template={selectedTemplate} />
                </div>
              </div>
            </div>
            {selectedTemplate && (
              <DialogFooter className="px-6 pb-6 pt-4 border-t flex-col sm:flex-row gap-3 sm:gap-2">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4 sm:space-y-0">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-sm">Project Name</FormLabel>
                            <FormControl>
                              <Input placeholder={`e.g. ${selectedTemplate.name}`} {...field} className="min-h-[44px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="sm:w-[200px]">
                            <FormLabel className="text-sm">Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="min-h-[44px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 sm:gap-0 pt-2">
                      <Button type="button" variant="outline" onClick={handleBack} className="min-h-[44px]">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={templateMutation.isPending || !form.watch("name")} className="min-h-[44px]">
                          {templateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Project
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </DialogFooter>
            )}
            {!selectedTemplate && (
              <DialogFooter className="px-6 pb-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleBack} className="min-h-[44px]">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
                  Cancel
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {step === 2 && method === 'import' && (
          <div className="px-6 pb-6 flex-1 overflow-y-auto">
            <ImportFieldMapper onBack={handleBack} onClose={() => onOpenChange(false)} />
          </div>
        )}

        {step === 2 && method === 'ai' && selectedOrgId && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <CreateProjectAIStep
              organizationId={selectedOrgId}
              onBack={handleBack}
              onCancel={() => onOpenChange(false)}
              onProjectCreated={(projectId) => {
                onOpenChange(false);
                navigate(`/projects/${projectId}`);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MethodCardProps {
  icon: any;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}

function MethodCard({ icon: Icon, title, description, onClick, disabled, badge }: MethodCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          {badge && (
            <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full">{badge}</span>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

