import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/MetricCard";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Plus, Pencil, Trash2, FolderKanban, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CostItem, Task } from "@shared/schema";

const COST_CATEGORIES = ['labor', 'materials', 'equipment', 'subcontractor', 'overhead', 'other'] as const;

interface CostFormData {
  category: string;
  description: string;
  budgeted: string;
  actual: string;
  committed: string;
  forecast: string;
  currency: string;
  status: string;
  referenceNumber: string;
  date: string;
  invoiceDate: string;
  paidDate: string;
  taskId?: number;
}

function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function parseNumeric(value: string): number {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

interface CategoryBreakdown {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  itemCount: number;
}

function aggregateCostsByCategory(costItems: CostItem[]): CategoryBreakdown[] {
  const categoryMap = new Map<string, { budgeted: number; actual: number; committed: number; forecast: number; count: number }>();
  
  costItems.forEach(item => {
    const cat = item.category || 'other';
    const existing = categoryMap.get(cat) || { budgeted: 0, actual: 0, committed: 0, forecast: 0, count: 0 };
    existing.budgeted += parseNumeric(item.budgeted);
    existing.actual += parseNumeric(item.actual);
    existing.committed += parseNumeric(item.committed || '0');
    existing.forecast += parseNumeric(item.forecast || '0');
    existing.count += 1;
    categoryMap.set(cat, existing);
  });
  
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      budgeted: data.budgeted,
      actual: data.actual,
      committed: data.committed,
      forecast: data.forecast,
      variance: data.actual - data.budgeted,
      itemCount: data.count
    }))
    .sort((a, b) => b.budgeted - a.budgeted);
}

interface EarnedValueMetrics {
  pv: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  cv: number;
  sv: number;
}

function calculateEarnedValue(
  costItems: CostItem[],
  tasks: Task[]
): EarnedValueMetrics {
  const totalBudget = costItems.reduce((sum, c) => sum + parseNumeric(c.budgeted), 0);
  const actualCost = costItems.reduce((sum, c) => sum + parseNumeric(c.actual), 0);
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const avgProgress = totalTasks > 0 
    ? tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks / 100
    : 0;
  
  const plannedProgress = totalTasks > 0 
    ? tasks.filter(t => {
        if (!t.endDate) return false;
        return new Date(t.endDate) <= new Date();
      }).length / totalTasks
    : 0.5;
  
  const pv = totalBudget * Math.max(plannedProgress, 0.1);
  const ev = totalBudget * avgProgress;
  const ac = actualCost;
  
  const cpi = ac > 0 ? ev / ac : (ev > 0 ? 1 : 0);
  const spi = pv > 0 ? ev / pv : (ev > 0 ? 1 : 0);
  const cv = ev - ac;
  const sv = ev - pv;
  
  return { pv, ev, ac, cpi, spi, cv, sv };
}

export default function CostPage() {
  const { selectedProject } = useProject();
  const { toast } = useToast();
  const projectId = selectedProject?.id;
  const projectCurrency = selectedProject?.currency || 'USD';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);
  const [formData, setFormData] = useState<CostFormData>({
    category: 'labor',
    description: '',
    budgeted: '',
    actual: '0',
    currency: projectCurrency,
    taskId: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [searchTerm, setSearchTerm] = useState("");

  const { data: costItems = [], isLoading } = useQuery<CostItem[]>({
    queryKey: ['/api/projects', projectId, 'costs'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/costs`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    }
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    enabled: !!projectId,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    }
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    
    const budgetedNum = parseFloat(formData.budgeted);
    if (isNaN(budgetedNum) || budgetedNum < 0) {
      errors.budgeted = 'Please enter a valid positive number';
    }
    
    const actualNum = parseFloat(formData.actual);
    if (formData.actual && (isNaN(actualNum) || actualNum < 0)) {
      errors.actual = 'Please enter a valid positive number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: CostFormData) => {
      const budgetedNum = parseFloat(data.budgeted) || 0;
      const actualNum = parseFloat(data.actual) || 0;
      
      const response = await apiRequest('POST', `/api/costs`, {
        projectId,
        category: data.category,
        description: data.description.trim(),
        budgeted: budgetedNum.toString(),
        actual: actualNum.toString(),
        currency: data.currency,
        taskId: data.taskId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Cost item created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'costs'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create cost item', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CostFormData }) => {
      const budgetedNum = parseFloat(data.budgeted) || 0;
      const actualNum = parseFloat(data.actual) || 0;
      const committedNum = parseFloat(data.committed) || 0;
      const forecastNum = data.forecast ? parseFloat(data.forecast) : null;
      
      const response = await apiRequest('PATCH', `/api/costs/${id}`, {
        category: data.category,
        description: data.description.trim(),
        budgeted: budgetedNum.toString(),
        actual: actualNum.toString(),
        committed: committedNum.toString(),
        forecast: forecastNum?.toString() || null,
        currency: data.currency,
        status: data.status,
        referenceNumber: data.referenceNumber.trim() || null,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate).toISOString() : null,
        paidDate: data.paidDate ? new Date(data.paidDate).toISOString() : null,
        taskId: data.taskId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Cost item updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'costs'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update cost item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/costs/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Cost item deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'costs'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete cost item', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenDialog = (item?: CostItem) => {
    setFormErrors({});
    if (item) {
      setEditingItem(item);
      const itemDate = item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const itemInvoiceDate = item.invoiceDate ? new Date(item.invoiceDate).toISOString().split('T')[0] : '';
      const itemPaidDate = item.paidDate ? new Date(item.paidDate).toISOString().split('T')[0] : '';
      setFormData({
        category: item.category,
        description: item.description,
        budgeted: item.budgeted,
        actual: item.actual || '0',
        committed: item.committed?.toString() || '0',
        forecast: item.forecast?.toString() || '',
        currency: item.currency,
        status: item.status || 'planned',
        referenceNumber: item.referenceNumber || '',
        date: itemDate,
        invoiceDate: itemInvoiceDate,
        paidDate: itemPaidDate,
        taskId: item.taskId || undefined,
      });
    } else {
      setEditingItem(null);
      setFormData({
        category: 'labor',
        description: '',
        budgeted: '',
        actual: '0',
        committed: '0',
        forecast: '',
        currency: projectCurrency,
        status: 'planned',
        referenceNumber: '',
        date: new Date().toISOString().split('T')[0],
        invoiceDate: '',
        paidDate: '',
        taskId: undefined,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormErrors({});
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!selectedProject) {
    return (
      <div className="p-6">
        <Alert>
          <FolderKanban className="h-4 w-4" />
          <AlertDescription>
            Please select a project to view cost management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalBudget = costItems.reduce((sum, c) => sum + parseNumeric(c.budgeted), 0);
  const totalActual = costItems.reduce((sum, c) => sum + parseNumeric(c.actual), 0);
  const totalCommitted = costItems.reduce((sum, c) => sum + parseNumeric(c.committed || '0'), 0);
  const totalForecast = costItems.reduce((sum, c) => sum + parseNumeric(c.forecast || '0'), 0);
  const variance = totalActual - totalBudget;
  const variancePercent = totalBudget > 0 ? Math.round((variance / totalBudget) * 100) : 0;

  const categoryBreakdown = aggregateCostsByCategory(costItems);
  const earnedValue = calculateEarnedValue(costItems, tasks);

  const filteredCostItems = costItems.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.referenceNumber && item.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-cost-title">Cost Management</h1>
          <p className="text-muted-foreground">Budget tracking and cost analytics</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-cost">
          <Plus className="h-4 w-4 mr-2" />
          Add Cost Item
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 shrink-0">
          <MetricCard
            title="Total Budget"
            value={formatShortCurrency(totalBudget)}
            icon={DollarSign}
            data-testid="metric-total-budget"
          />
          <MetricCard
            title="Actual Cost"
            value={formatShortCurrency(totalActual)}
            change={variancePercent < 0 ? Math.abs(variancePercent) : undefined}
            icon={TrendingDown}
            data-testid="metric-actual-cost"
          />
          <MetricCard
            title="Budget Remaining"
            value={formatShortCurrency(Math.max(0, totalBudget - totalActual))}
            change={variancePercent > 0 ? -variancePercent : undefined}
            icon={TrendingUp}
            data-testid="metric-remaining"
          />
          <MetricCard
            title="Committed"
            value={formatShortCurrency(totalCommitted)}
            icon={DollarSign}
            data-testid="metric-committed"
          />
          <MetricCard
            title="Forecast"
            value={formatShortCurrency(totalForecast || totalBudget)}
            icon={TrendingUp}
            data-testid="metric-forecast"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cost Items</CardTitle>
                  <CardDescription>All cost line items for this project</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search costs..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : filteredCostItems.length > 0 ? (
                <div className="space-y-2">
                  {filteredCostItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card hover-elevate"
                      data-testid={`cost-item-${item.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.description}</span>
                          <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span>Budget: {formatCurrency(parseNumeric(item.budgeted), item.currency)}</span>
                          <span>Actual: {formatCurrency(parseNumeric(item.actual), item.currency)}</span>
                          {parseNumeric(item.committed || '0') > 0 && (
                            <span>Committed: {formatCurrency(parseNumeric(item.committed || '0'), item.currency)}</span>
                          )}
                          {item.status && (
                            <Badge variant="outline" className="text-xs">{item.status}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(item)}
                          data-testid={`button-edit-cost-${item.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(item.id)}
                          data-testid={`button-delete-cost-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No cost items found.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((cat) => {
                  const budgetUsed = cat.budgeted > 0 ? (cat.actual / cat.budgeted) * 100 : 0;
                  const catVariancePercent = cat.budgeted > 0 ? (cat.variance / cat.budgeted) * 100 : 0;

                  return (
                    <div key={cat.category} className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-semibold capitalize text-sm">{cat.category}</h3>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(cat.actual, projectCurrency)} / {formatCurrency(cat.budgeted, projectCurrency)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={cat.variance > 0 ? "destructive" : "default"}
                            className="text-xs px-1.5 py-0"
                          >
                            {cat.variance > 0 ? "+" : ""}
                            {catVariancePercent.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Progress 
                          value={Math.min(budgetUsed, 100)} 
                          className={`h-1.5 ${budgetUsed > 100 ? 'bg-destructive/20' : ''}`}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No data available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Earned Value Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Planned Value (PV)</span>
                    <span className="font-semibold font-mono text-sm">{formatCurrency(earnedValue.pv, projectCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Earned Value (EV)</span>
                    <span className="font-semibold font-mono text-sm">{formatCurrency(earnedValue.ev, projectCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Actual Cost (AC)</span>
                    <span className="font-semibold font-mono text-sm">{formatCurrency(earnedValue.ac, projectCurrency)}</span>
                  </div>
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">CPI</span>
                      <Badge variant={earnedValue.cpi >= 1 ? "default" : "destructive"}>
                        {earnedValue.cpi.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">SPI</span>
                      <Badge variant={earnedValue.spi >= 1 ? "default" : "secondary"}>
                        {earnedValue.spi.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Cost Item' : 'Add Cost Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the cost item details.' : 'Add a new cost item to track budget and expenses.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (formErrors.description) setFormErrors({ ...formErrors, description: '' });
                }}
                placeholder="Enter cost description"
                data-testid="input-description"
                className={formErrors.description ? 'border-destructive' : ''}
              />
              {formErrors.description && (
                <p className="text-xs text-destructive">{formErrors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgeted">Budgeted Amount *</Label>
                <Input
                  id="budgeted"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.budgeted}
                  onChange={(e) => {
                    setFormData({ ...formData, budgeted: e.target.value });
                    if (formErrors.budgeted) setFormErrors({ ...formErrors, budgeted: '' });
                  }}
                  placeholder="0"
                  data-testid="input-budgeted"
                  className={formErrors.budgeted ? 'border-destructive' : ''}
                />
                {formErrors.budgeted && (
                  <p className="text-xs text-destructive">{formErrors.budgeted}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Amount</Label>
                <Input
                  id="actual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.actual}
                  onChange={(e) => {
                    setFormData({ ...formData, actual: e.target.value });
                    if (formErrors.actual) setFormErrors({ ...formErrors, actual: '' });
                  }}
                  placeholder="0"
                  data-testid="input-actual"
                  className={formErrors.actual ? 'border-destructive' : ''}
                />
                {formErrors.actual && (
                  <p className="text-xs text-destructive">{formErrors.actual}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="committed">Committed Amount</Label>
                <Input
                  id="committed"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.committed}
                  onChange={(e) => setFormData({ ...formData, committed: e.target.value })}
                  placeholder="0"
                  data-testid="input-committed"
                />
                <p className="text-xs text-muted-foreground">POs, contracts not yet invoiced</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forecast">Forecast Amount</Label>
                <Input
                  id="forecast"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.forecast}
                  onChange={(e) => setFormData({ ...formData, forecast: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-forecast"
                />
                <p className="text-xs text-muted-foreground">Projected future cost</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="committed">Committed</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number (PO/Invoice)</Label>
              <Input
                id="referenceNumber"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="PO-12345 or INV-67890"
                data-testid="input-reference"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  data-testid="input-invoice-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paidDate">Paid Date</Label>
                <Input
                  id="paidDate"
                  type="date"
                  value={formData.paidDate}
                  onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
                  data-testid="input-paid-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task">Link to Task (optional)</Label>
              <Select
                value={formData.taskId?.toString() || 'none'}
                onValueChange={(v) => setFormData({ ...formData, taskId: v && v !== 'none' ? parseInt(v) : undefined })}
              >
                <SelectTrigger data-testid="select-task">
                  <SelectValue placeholder="Select task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.wbsCode} - {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-cost"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
