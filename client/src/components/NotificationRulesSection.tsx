import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, MoreVertical, Search, Loader2, Bell, Clock, Calendar, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { NotificationRule } from "@shared/schema";
import { NotificationRuleModal } from "@/components/modals/NotificationRuleModal";

export function NotificationRulesSection() {
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<NotificationRule | null>(null);

  const projectId = selectedProject?.id;
  const organizationId = selectedProject?.organizationId;

  // Fetch notification rules
  const { data: projectRules = [], isLoading: projectRulesLoading } = useQuery<NotificationRule[]>({
    queryKey: ["/api/projects", projectId, "notification-rules"],
    enabled: Boolean(projectId),
  });

  const { data: orgRules = [], isLoading: orgRulesLoading } = useQuery<NotificationRule[]>({
    queryKey: ["/api/organizations", organizationId, "notification-rules"],
    enabled: Boolean(organizationId),
  });

  const allRules = [...projectRules, ...orgRules];
  const isLoading = projectRulesLoading || orgRulesLoading;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notification-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notification-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "notification-rules"] });
      toast({
        title: "Rule Deleted",
        description: "Notification rule has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/notification-rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notification-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", organizationId, "notification-rules"] });
      toast({
        title: "Rule Updated",
        description: "Notification rule status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
  };

  const handleDelete = (rule: NotificationRule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setRuleModalOpen(true);
  };

  const filteredRules = allRules.filter((rule) =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTriggerDescription = (rule: NotificationRule): string => {
    const config = rule.triggerConfig;
    if (!config) return "No trigger configured";

    switch (rule.triggerType) {
      case "time-based":
        if (config.triggerOn === "baseline-start" && config.daysBefore) {
          return `${config.daysBefore} days before baseline start`;
        }
        if (config.triggerOn === "baseline-finish" && config.daysBefore) {
          return `${config.daysBefore} days before baseline finish`;
        }
        if (config.triggerOn === "project-start" && config.daysBefore) {
          return `${config.daysBefore} days before project start`;
        }
        if (config.triggerOn === "project-end" && config.daysBefore) {
          return `${config.daysBefore} days before project end`;
        }
        return `Time-based: ${config.triggerOn || "Unknown"}`;
      case "event-based":
        return `Event: ${config.eventType || "Unknown"}`;
      case "threshold-based":
        return `Threshold: ${config.thresholdType || "Unknown"}`;
      case "custom-date":
        return `Custom date: ${config.customDate ? new Date(config.customDate).toLocaleDateString() : "Not set"}`;
      default:
        return "Unknown trigger";
    }
  };

  const getRecipientDescription = (rule: NotificationRule): string => {
    const recipients = rule.recipients;
    if (!recipients) return "No recipients";

    switch (rule.recipientType) {
      case "individual":
        const count = (recipients.stakeholderIds?.length || 0) +
                     (recipients.resourceIds?.length || 0) +
                     (recipients.contactIds?.length || 0) +
                     (recipients.userIds?.length || 0);
        return `${count} individual(s)`;
      case "raci-based":
        return `RACI: ${recipients.raciTypes?.join(", ") || "All"}`;
      case "role-based":
        return `Roles: ${recipients.roles?.join(", ") || "All"}`;
      case "group":
        return `${recipients.groupIds?.length || 0} group(s)`;
      default:
        return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Automation & Notification Rules
              </CardTitle>
              <CardDescription>
                Configure automated notifications for tasks, risks, issues, and project events.
                Rules can be set at project or organization level.
              </CardDescription>
            </div>
            <Button onClick={handleCreate} data-testid="button-create-notification-rule">
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-rules"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                {searchQuery ? "No rules match your search." : "No notification rules configured."}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Rule
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-muted-foreground mt-1">{rule.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {rule.triggerType === "time-based" && <Clock className="h-4 w-4 text-muted-foreground" />}
                        {rule.triggerType === "event-based" && <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                        {rule.triggerType === "custom-date" && <Calendar className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm">{getTriggerDescription(rule)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getRecipientDescription(rule)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.frequency || "one-time"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {rule.projectId ? "Project" : rule.organizationId ? "Organization" : "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: rule.id, isActive: checked })
                          }
                          disabled={toggleActiveMutation.isPending}
                        />
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.lastTriggeredAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(rule)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {ruleModalOpen && (
        <NotificationRuleModal
          open={ruleModalOpen}
          onOpenChange={setRuleModalOpen}
          rule={editingRule}
          projectId={projectId}
          organizationId={organizationId}
          onSuccess={() => {
            setRuleModalOpen(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

