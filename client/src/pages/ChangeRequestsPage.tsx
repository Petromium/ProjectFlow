import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TableRowCard } from "@/components/TableRowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Edit, Trash2, FileEdit, DollarSign, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, BarChart3, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeRequest } from "@shared/schema";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted", color: "default" },
  { value: "under-review", label: "Under Review", color: "secondary" },
  { value: "approved", label: "Approved", color: "outline" },
  { value: "rejected", label: "Rejected", color: "destructive" },
  { value: "implemented", label: "Implemented", color: "outline" },
];

interface ChangeRequestFormData {
  title: string;
  description: string;
  justification: string;
  status: "submitted" | "under-review" | "approved" | "rejected" | "implemented";
  impactAssessment: string;
  costImpact: string;
  scheduleImpact: string;
}

const initialFormData: ChangeRequestFormData = {
  title: "",
  description: "",
  justification: "",
  status: "submitted",
  impactAssessment: "",
  costImpact: "",
  scheduleImpact: "",
};

export default function ChangeRequestsPage() {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCr, setEditingCr] = useState<ChangeRequest | null>(null);
  const [selectedCrs, setSelectedCrs] = useState<number[]>([]);
  const [formData, setFormData] = useState<ChangeRequestFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      setTimeout(() => {
        setFormData(initialFormData);
        setEditingCr(null);
        setDialogOpen(true);
      }, 100);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: [`/api/projects/${selectedProjectId}/change-requests/analytics`],
    enabled: !!selectedProjectId && activeTab === "analytics",
    retry: 1,
  });

  const { 
    data: changeRequests = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ChangeRequest[]>({
    queryKey: [`/api/projects/${selectedProjectId}/change-requests`],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  const filteredChangeRequests = useMemo(() => {
    if (!searchQuery) return changeRequests;
    const query = searchQuery.toLowerCase();
    return changeRequests.filter(cr => 
      cr.title.toLowerCase().includes(query) ||
      cr.description?.toLowerCase().includes(query) ||
      cr.code?.toLowerCase().includes(query)
    );
  }, [changeRequests, searchQuery]);

  const createMutation = useMutation({
    mutationFn: async (data: ChangeRequestFormData) => {
      if (!selectedProjectId) throw new Error("No project selected");
      const payload = {
        ...data,
        projectId: selectedProjectId,
        costImpact: data.costImpact ? parseFloat(data.costImpact) : null,
        scheduleImpact: data.scheduleImpact ? parseInt(data.scheduleImpact) : null,
        impactAssessment: data.impactAssessment || null,
        justification: data.justification || null,
      };
      await apiRequest("POST", "/api/change-requests", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/change-requests`] });
      setDialogOpen(false);
      setEditingCr(null);
      resetForm();
      toast({ title: "Success", description: "Change request submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ChangeRequestFormData }) => {
      const payload = {
        ...data,
        costImpact: data.costImpact ? parseFloat(data.costImpact) : null,
        scheduleImpact: data.scheduleImpact ? parseInt(data.scheduleImpact) : null,
        impactAssessment: data.impactAssessment || null,
        justification: data.justification || null,
      };
      await apiRequest("PATCH", `/api/change-requests/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/change-requests`] });
      setDialogOpen(false);
      setEditingCr(null);
      resetForm();
      toast({ title: "Success", description: "Change request updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/change-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/change-requests`] });
      toast({ title: "Success", description: "Change request deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCr) {
      updateMutation.mutate({ id: editingCr.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (cr: ChangeRequest) => {
    setEditingCr(cr);
    setFormData({
      title: cr.title,
      description: cr.description || "",
      justification: cr.justification || "",
      status: cr.status as ChangeRequestFormData["status"],
      impactAssessment: cr.impactAssessment || "",
      costImpact: cr.costImpact ? cr.costImpact.toString() : "",
      scheduleImpact: cr.scheduleImpact ? cr.scheduleImpact.toString() : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this change request?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingCr(null);
    resetForm();
    setDialogOpen(true);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "submitted": return "default" as const;
      case "under-review": return "secondary" as const;
      case "approved": return "outline" as const;
      case "rejected": return "destructive" as const;
      case "implemented": return "outline" as const;
      default: return "default" as const;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return CheckCircle2;
      case "rejected": return XCircle;
      case "under-review": return AlertCircle;
      default: return FileEdit;
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project from the dropdown above</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Change Requests</h1>
          <p className="text-muted-foreground">Management of Change (MOC) - Track and manage project change requests</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-change-request">
          <FileEdit className="mr-2 h-4 w-4" />
          Submit Change Request
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Change Requests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics & Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load change requests. {(error as Error).message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search change requests..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-search-change-requests"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading change requests...</p>
        </div>
      ) : filteredChangeRequests.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">No Change Requests Found</h2>
          <p className="text-muted-foreground mb-4">Get started by submitting a change request</p>
          <Button onClick={handleAddNew}>Submit Change Request</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[80px,3fr,1.5fr,1fr,1fr,100px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
            <div>Code</div>
            <div>Title</div>
            <div>Impact</div>
            <div>Cost</div>
            <div>Schedule</div>
            <div>Status</div>
          </div>
          {filteredChangeRequests.map((cr) => {
            const StatusIcon = getStatusIcon(cr.status);
            return (
              <TableRowCard
                key={cr.id}
                id={cr.id.toString()}
                selected={selectedCrs.includes(cr.id)}
                onSelect={(selected) => {
                  setSelectedCrs(prev =>
                    selected ? [...prev, cr.id] : prev.filter(id => id !== cr.id)
                  );
                }}
              >
                <div className="grid grid-cols-[80px,3fr,1.5fr,1fr,1fr,100px] gap-4 items-center flex-1">
                  <div className="text-sm font-mono text-muted-foreground">{cr.code}</div>
                  <div>
                    <div className="font-medium">{cr.title}</div>
                    {cr.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">{cr.description}</div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cr.impactAssessment ? (
                      <span className="line-clamp-2">{cr.impactAssessment}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="text-sm">
                    {cr.costImpact ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {parseFloat(cr.costImpact.toString()).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="text-sm">
                    {cr.scheduleImpact ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {cr.scheduleImpact} days
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(cr.status)} className="capitalize">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {cr.status.replace("-", " ")}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          ...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(cr)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(cr.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </TableRowCard>
            );
          })}
        </div>
      )}
        </TabsContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCr ? "Edit Change Request" : "Submit Change Request"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Change Request Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the requested change"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the change"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  placeholder="Why is this change necessary?"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costImpact">Cost Impact ($)</Label>
                  <Input
                    id="costImpact"
                    type="number"
                    step="0.01"
                    value={formData.costImpact}
                    onChange={(e) => setFormData({ ...formData, costImpact: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduleImpact">Schedule Impact (days)</Label>
                  <Input
                    id="scheduleImpact"
                    type="number"
                    value={formData.scheduleImpact}
                    onChange={(e) => setFormData({ ...formData, scheduleImpact: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="impactAssessment">Impact Assessment</Label>
                <Textarea
                  id="impactAssessment"
                  value={formData.impactAssessment}
                  onChange={(e) => setFormData({ ...formData, impactAssessment: e.target.value })}
                  placeholder="Assessment of overall impact on project scope, quality, resources, etc."
                  rows={4}
                />
              </div>

              {editingCr && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: ChangeRequestFormData["status"]) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCr ? "Update" : "Submit"} Change Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total CRs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.summary.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{analytics.summary.byStatus.approved}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {analytics.summary.byStatus.submitted + analytics.summary.byStatus["under-review"]}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost Impact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${analytics.summary.totalCostImpact.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Schedule Impact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.summary.totalScheduleImpact} days
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Approval Statistics */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Approval Rate</CardTitle>
                    <CardDescription>Overall approval statistics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Approval Rate</span>
                        <span className="text-sm font-bold">{analytics.approvals.approvalRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={analytics.approvals.approvalRate} className="h-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">{analytics.approvals.approved}</div>
                        <div className="text-xs text-muted-foreground">Approved</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{analytics.approvals.rejected}</div>
                        <div className="text-xs text-muted-foreground">Rejected</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">{analytics.approvals.pending}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Processing Time</CardTitle>
                    <CardDescription>Time from submission to decision</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Average Approval Time</span>
                        <span className="text-sm font-bold">{analytics.trends.avgApprovalTime} days</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Average Rejection Time</span>
                        <span className="text-sm font-bold">{analytics.trends.avgRejectionTime} days</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Status Distribution</CardTitle>
                    <CardDescription>Change requests by status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Approved", value: analytics.summary.byStatus.approved, color: "#22c55e" },
                            { name: "Rejected", value: analytics.summary.byStatus.rejected, color: "#ef4444" },
                            { name: "Under Review", value: analytics.summary.byStatus["under-review"], color: "#eab308" },
                            { name: "Submitted", value: analytics.summary.byStatus.submitted, color: "#64748b" },
                            { name: "Implemented", value: analytics.summary.byStatus.implemented, color: "#3b82f6" },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: "Approved", value: analytics.summary.byStatus.approved, color: "#22c55e" },
                            { name: "Rejected", value: analytics.summary.byStatus.rejected, color: "#ef4444" },
                            { name: "Under Review", value: analytics.summary.byStatus["under-review"], color: "#eab308" },
                            { name: "Submitted", value: analytics.summary.byStatus.submitted, color: "#64748b" },
                            { name: "Implemented", value: analytics.summary.byStatus.implemented, color: "#3b82f6" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Change Request Trends</CardTitle>
                  <CardDescription>Monthly submission and approval trends (last 12 months)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={Object.entries(analytics.trends.monthly).map(([month, data]) => ({
                      month,
                      submitted: data.submitted,
                      approved: data.approved,
                      rejected: data.rejected,
                    })).sort((a, b) => a.month.localeCompare(b.month))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="submitted" stackId="1" stroke="#64748b" fill="#64748b" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="approved" stackId="2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="rejected" stackId="3" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cost Impact by Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Impact by Status</CardTitle>
                  <CardDescription>Total cost impact broken down by change request status</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { status: "Submitted", cost: analytics.costImpact.byStatus.submitted },
                      { status: "Under Review", cost: analytics.costImpact.byStatus["under-review"] },
                      { status: "Approved", cost: analytics.costImpact.byStatus.approved },
                      { status: "Rejected", cost: analytics.costImpact.byStatus.rejected },
                      { status: "Implemented", cost: analytics.costImpact.byStatus.implemented },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="cost" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No analytics data available</p>
            </div>
            )}
          </TabsContent>
      </Tabs>
    </div>
  );
}

