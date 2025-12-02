import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, AlertTriangle, Calendar, Users, Mail, FileText, Repeat } from "lucide-react";
import type { NotificationRule, EmailTemplate, Task, Stakeholder, Resource, Contact } from "@shared/schema";
import { insertNotificationRuleSchema } from "@shared/schema";

interface NotificationRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: NotificationRule | null;
  projectId?: number;
  organizationId?: number;
  onSuccess?: () => void;
}

export function NotificationRuleModal({
  open,
  onOpenChange,
  rule,
  projectId,
  organizationId,
  onSuccess,
}: NotificationRuleModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("trigger");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "time-based" as "time-based" | "event-based" | "threshold-based" | "custom-date",
    triggerConfig: {} as any,
    scopeType: "all-tasks" as "all-tasks" | "specific-tasks" | "project-level" | "calendar-event",
    taskIds: [] as number[],
    recipientType: "individual" as "individual" | "role-based" | "raci-based" | "group",
    recipients: {} as any,
    emailTemplateId: null as number | null,
    reportType: null as string | null,
    documentIds: [] as number[],
    customMessage: "",
    frequency: "one-time" as "one-time" | "daily" | "weekly" | "monthly",
    maxOccurrences: null as number | null,
    isActive: true,
  });

  // Fetch email templates
  const { data: emailTemplates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/organizations", organizationId, "email-templates"],
    enabled: Boolean(organizationId),
  });

  // Fetch tasks for scope selection
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: Boolean(projectId) && formData.scopeType === "specific-tasks",
  });

  // Fetch stakeholders, resources, contacts for recipients
  const { data: stakeholders = [] } = useQuery<Stakeholder[]>({
    queryKey: ["/api/projects", projectId, "stakeholders"],
    enabled: Boolean(projectId),
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["/api/projects", projectId, "resources"],
    enabled: Boolean(projectId),
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/organizations", organizationId, "contacts"],
    enabled: Boolean(organizationId),
  });

  // Initialize form data from rule
  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || "",
        description: rule.description || "",
        triggerType: rule.triggerType || "time-based",
        triggerConfig: rule.triggerConfig || {},
        scopeType: rule.scopeType || "all-tasks",
        taskIds: rule.taskIds || [],
        recipientType: rule.recipientType || "individual",
        recipients: rule.recipients || {},
        emailTemplateId: rule.emailTemplateId || null,
        reportType: rule.reportType || null,
        documentIds: rule.documentIds || [],
        customMessage: rule.customMessage || "",
        frequency: rule.frequency || "one-time",
        maxOccurrences: rule.maxOccurrences || null,
        isActive: rule.isActive ?? true,
      });
    } else {
      // Reset form for new rule
      setFormData({
        name: "",
        description: "",
        triggerType: "time-based",
        triggerConfig: {},
        scopeType: "all-tasks",
        taskIds: [],
        recipientType: "individual",
        recipients: {},
        emailTemplateId: null,
        reportType: null,
        documentIds: [],
        customMessage: "",
        frequency: "one-time",
        maxOccurrences: null,
        isActive: true,
      });
    }
  }, [rule, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        projectId: formData.scopeType === "project-level" || formData.scopeType === "all-tasks" || formData.scopeType === "specific-tasks" ? projectId : null,
        organizationId: formData.scopeType === "project-level" ? null : organizationId,
      };
      await apiRequest("POST", "/api/notification-rules", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notification-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "notification-rules"] });
      toast({
        title: "Rule Created",
        description: "Notification rule has been created successfully.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/notification-rules/${rule!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notification-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "notification-rules"] });
      toast({
        title: "Rule Updated",
        description: "Notification rule has been updated successfully.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Rule name is required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description || null,
      triggerType: formData.triggerType,
      triggerConfig: formData.triggerConfig,
      scopeType: formData.scopeType,
      taskIds: formData.taskIds.length > 0 ? formData.taskIds : null,
      recipientType: formData.recipientType,
      recipients: formData.recipients,
      emailTemplateId: formData.emailTemplateId || null,
      reportType: formData.reportType || null,
      documentIds: formData.documentIds.length > 0 ? formData.documentIds : null,
      customMessage: formData.customMessage || null,
      frequency: formData.frequency,
      maxOccurrences: formData.maxOccurrences || null,
      isActive: formData.isActive,
      projectId: formData.scopeType === "project-level" || formData.scopeType === "all-tasks" || formData.scopeType === "specific-tasks" ? projectId : null,
      organizationId: formData.scopeType === "project-level" ? null : organizationId,
    };

    const result = insertNotificationRuleSchema.safeParse(payload);
    if (!result.success) {
      const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
      toast({
        title: "Validation Error",
        description: "Please check the following fields:\n" + errorMessages,
        variant: "destructive",
      });
      return;
    }

    if (rule) {
      updateMutation.mutate(result.data);
    } else {
      createMutation.mutate(result.data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit Notification Rule: ${rule.name}` : "Create Notification Rule"}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="trigger">Trigger</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Trigger Tab */}
            <TabsContent value="trigger" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>When to Send</CardTitle>
                  <CardDescription>Configure what triggers this notification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select
                      value={formData.triggerType}
                      onValueChange={(value: any) => {
                        setFormData({ ...formData, triggerType: value, triggerConfig: {} });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time-based">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Time-Based (Relative to Dates)
                          </div>
                        </SelectItem>
                        <SelectItem value="event-based">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Event-Based (State Changes)
                          </div>
                        </SelectItem>
                        <SelectItem value="custom-date">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Custom Date
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.triggerType === "time-based" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Trigger On</Label>
                          <Select
                            value={formData.triggerConfig?.triggerOn || ""}
                            onValueChange={(value) => {
                              setFormData({
                                ...formData,
                                triggerConfig: { ...formData.triggerConfig, triggerOn: value },
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select event" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="baseline-start">Baseline Start</SelectItem>
                              <SelectItem value="baseline-finish">Baseline Finish</SelectItem>
                              <SelectItem value="actual-start">Actual Start</SelectItem>
                              <SelectItem value="actual-finish">Actual Finish</SelectItem>
                              <SelectItem value="project-start">Project Start</SelectItem>
                              <SelectItem value="project-end">Project End</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Days Before</Label>
                          <Input
                            type="number"
                            value={formData.triggerConfig?.daysBefore || ""}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                triggerConfig: {
                                  ...formData.triggerConfig,
                                  daysBefore: e.target.value ? parseInt(e.target.value) : undefined,
                                },
                              });
                            }}
                            placeholder="e.g., 7"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.triggerType === "event-based" && (
                    <div className="space-y-2">
                      <Label>Event Type</Label>
                      <Select
                        value={formData.triggerConfig?.eventType || ""}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            triggerConfig: { ...formData.triggerConfig, eventType: value },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="task-status-change">Task Status Change</SelectItem>
                          <SelectItem value="task-progress-milestone">Task Progress Milestone</SelectItem>
                          <SelectItem value="risk-created">Risk Created</SelectItem>
                          <SelectItem value="risk-impact-changed">Risk Impact Changed</SelectItem>
                          <SelectItem value="issue-created">Issue Created</SelectItem>
                          <SelectItem value="issue-resolved">Issue Resolved</SelectItem>
                          <SelectItem value="change-request-submitted">Change Request Submitted</SelectItem>
                          <SelectItem value="change-request-approved">Change Request Approved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.triggerType === "custom-date" && (
                    <div className="space-y-2">
                      <Label>Custom Date</Label>
                      <Input
                        type="date"
                        value={formData.triggerConfig?.customDate || ""}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            triggerConfig: { ...formData.triggerConfig, customDate: e.target.value },
                          });
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scope Tab */}
            <TabsContent value="scope" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Where to Apply</CardTitle>
                  <CardDescription>Define the scope of this notification rule</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Scope Type</Label>
                    <Select
                      value={formData.scopeType}
                      onValueChange={(value: any) => {
                        setFormData({ ...formData, scopeType: value, taskIds: [] });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-tasks">All Tasks in Project</SelectItem>
                        <SelectItem value="specific-tasks">Specific Tasks</SelectItem>
                        <SelectItem value="project-level">Project Level</SelectItem>
                        <SelectItem value="calendar-event">Calendar Events</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.scopeType === "specific-tasks" && (
                    <div className="space-y-2">
                      <Label>Select Tasks</Label>
                      <ScrollArea className="h-48 border rounded-md p-2">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              checked={formData.taskIds.includes(task.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    taskIds: [...formData.taskIds, task.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    taskIds: formData.taskIds.filter((id) => id !== task.id),
                                  });
                                }
                              }}
                            />
                            <Label className="text-sm">
                              {task.wbsCode} - {task.name}
                            </Label>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recipients Tab */}
            <TabsContent value="recipients" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Who Receives</CardTitle>
                  <CardDescription>Select recipients for this notification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recipient Type</Label>
                    <Select
                      value={formData.recipientType}
                      onValueChange={(value: any) => {
                        setFormData({ ...formData, recipientType: value, recipients: {} });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual Selection</SelectItem>
                        <SelectItem value="raci-based">RACI-Based (Task Assignments)</SelectItem>
                        <SelectItem value="role-based">Role-Based</SelectItem>
                        <SelectItem value="group">Group (Future)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.recipientType === "individual" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Stakeholders</Label>
                        <ScrollArea className="h-32 border rounded-md p-2">
                          {stakeholders.map((stakeholder) => (
                            <div key={stakeholder.id} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                checked={formData.recipients?.stakeholderIds?.includes(stakeholder.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentIds = formData.recipients?.stakeholderIds || [];
                                  setFormData({
                                    ...formData,
                                    recipients: {
                                      ...formData.recipients,
                                      stakeholderIds: checked
                                        ? [...currentIds, stakeholder.id]
                                        : currentIds.filter((id) => id !== stakeholder.id),
                                    },
                                  });
                                }}
                              />
                              <Label className="text-sm">{stakeholder.name}</Label>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                      <div className="space-y-2">
                        <Label>Resources</Label>
                        <ScrollArea className="h-32 border rounded-md p-2">
                          {resources.filter((r) => r.type === "human").map((resource) => (
                            <div key={resource.id} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                checked={formData.recipients?.resourceIds?.includes(resource.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentIds = formData.recipients?.resourceIds || [];
                                  setFormData({
                                    ...formData,
                                    recipients: {
                                      ...formData.recipients,
                                      resourceIds: checked
                                        ? [...currentIds, resource.id]
                                        : currentIds.filter((id) => id !== resource.id),
                                    },
                                  });
                                }}
                              />
                              <Label className="text-sm">{resource.name}</Label>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    </div>
                  )}

                  {formData.recipientType === "raci-based" && (
                    <div className="space-y-2">
                      <Label>RACI Types</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["R", "A", "C", "I"].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              checked={formData.recipients?.raciTypes?.includes(type) || false}
                              onCheckedChange={(checked) => {
                                const currentTypes = formData.recipients?.raciTypes || [];
                                setFormData({
                                  ...formData,
                                  recipients: {
                                    ...formData.recipients,
                                    raciTypes: checked
                                      ? [...currentTypes, type]
                                      : currentTypes.filter((t) => t !== type),
                                  },
                                });
                              }}
                            />
                            <Label className="text-sm">
                              {type === "R" && "Responsible"}
                              {type === "A" && "Accountable"}
                              {type === "C" && "Consulted"}
                              {type === "I" && "Informed"}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.recipientType === "role-based" && (
                    <div className="space-y-2">
                      <Label>Roles</Label>
                      <Input
                        placeholder="Enter roles (comma-separated)"
                        value={formData.recipients?.roles?.join(", ") || ""}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            recipients: {
                              ...formData.recipients,
                              roles: e.target.value.split(",").map((r) => r.trim()).filter(Boolean),
                            },
                          });
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>What to Send</CardTitle>
                  <CardDescription>Configure the content of the notification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Template</Label>
                    <Select
                      value={formData.emailTemplateId?.toString() || ""}
                      onValueChange={(value) => {
                        setFormData({
                          ...formData,
                          emailTemplateId: value ? parseInt(value) : null,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select email template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {emailTemplates
                          .filter((t) => t.isActive)
                          .map((template) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Report Type (Optional)</Label>
                    <Select
                      value={formData.reportType || ""}
                      onValueChange={(value) => {
                        setFormData({ ...formData, reportType: value || null });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="task-summary">Task Summary</SelectItem>
                        <SelectItem value="progress-report">Progress Report</SelectItem>
                        <SelectItem value="risk-report">Risk Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Message (Optional)</Label>
                    <Textarea
                      value={formData.customMessage}
                      onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                      placeholder="Additional message to include in the notification..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule & Frequency</CardTitle>
                  <CardDescription>Configure how often to send notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Rule Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Task Start Reminder"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this rule does..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value: any) => {
                        setFormData({ ...formData, frequency: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-time">One-Time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.frequency !== "one-time" && (
                    <div className="space-y-2">
                      <Label>Max Occurrences (Optional)</Label>
                      <Input
                        type="number"
                        value={formData.maxOccurrences || ""}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            maxOccurrences: e.target.value ? parseInt(e.target.value) : null,
                          });
                        }}
                        placeholder="Leave empty for unlimited"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                    <Label>Active</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {rule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

