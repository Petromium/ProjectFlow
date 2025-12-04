/**
 * Dashboard Builder Component
 * Epic 16: Advanced Features - Custom Dashboard Builder UI
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Layout, X } from 'lucide-react';
import { DraggableDashboard, WidgetConfig, DashboardLayout, WIDGET_TYPES, WidgetType } from '@/components/dashboard/DraggableWidget';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface DashboardBuilderProps {
  onSave?: () => void;
}

const WIDGET_DISPLAY_NAMES: Record<WidgetType, string> = {
  [WIDGET_TYPES.METRIC_CARD]: 'Metric Card',
  [WIDGET_TYPES.COST_SNAPSHOT]: 'Cost Snapshot',
  [WIDGET_TYPES.RESOURCE_SNAPSHOT]: 'Resource Snapshot',
  [WIDGET_TYPES.RISK_SNAPSHOT]: 'Risk Snapshot',
  [WIDGET_TYPES.DOCUMENT_STATS]: 'Document Statistics',
  [WIDGET_TYPES.PORTFOLIO_SIGNALS]: 'Portfolio Signals',
  [WIDGET_TYPES.UPCOMING_EVENTS]: 'Upcoming Events',
  [WIDGET_TYPES.WBS_LINKAGE]: 'WBS Linkage',
  [WIDGET_TYPES.S_CURVE]: 'S-Curve Chart',
  [WIDGET_TYPES.EVA_GAUGES]: 'EVA Performance Gauges',
};

export function DashboardBuilder({ onSave }: DashboardBuilderProps) {
  const { user } = useAuth();
  const { selectedProject } = useProject();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('My Dashboard');
  const [layout, setLayout] = useState<DashboardLayout>({ widgets: [] });
  const [newWidgetType, setNewWidgetType] = useState<WidgetType | ''>('');

  // Fetch existing dashboard layout
  const { data: existingDashboard } = useQuery({
    queryKey: ['/api/dashboards', selectedProject?.id, user?.id],
    enabled: !!user?.id && !!selectedProject?.id,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/dashboards?projectId=${selectedProject?.id}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Load existing layout if available
  useEffect(() => {
    if (existingDashboard?.layout) {
      setLayout(existingDashboard.layout);
      setDashboardName(existingDashboard.name || 'My Dashboard');
    }
  }, [existingDashboard]);

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; layout: DashboardLayout }) => {
      const res = await apiRequest('POST', '/api/dashboards', {
        projectId: selectedProject?.id || null,
        name: data.name,
        layout: data.layout,
        isDefault: true,
      });
      if (!res.ok) throw new Error('Failed to save dashboard');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Dashboard saved',
        description: 'Your custom dashboard layout has been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards'] });
      setIsOpen(false);
      onSave?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addWidget = () => {
    if (!newWidgetType) return;

    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: newWidgetType,
      position: layout.widgets.length,
      size: 'medium',
    };

    setLayout({
      widgets: [...layout.widgets, newWidget],
    });
    setNewWidgetType('');
  };

  const removeWidget = (id: string) => {
    setLayout({
      widgets: layout.widgets.filter((w) => w.id !== id).map((w, idx) => ({ ...w, position: idx })),
    });
  };

  const handleSave = () => {
    if (layout.widgets.length === 0) {
      toast({
        title: 'No widgets',
        description: 'Please add at least one widget to your dashboard.',
        variant: 'destructive',
      });
      return;
    }

    saveMutation.mutate({
      name: dashboardName,
      layout,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layout className="h-4 w-4 mr-2" />
          Customize Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="dashboard-name">Dashboard Name</Label>
              <Input
                id="dashboard-name"
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                placeholder="My Dashboard"
              />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Widget</h3>
              <div className="flex gap-2">
                <Select value={newWidgetType} onValueChange={(value) => setNewWidgetType(value as WidgetType)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select widget type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WIDGET_DISPLAY_NAMES).map(([type, name]) => (
                      <SelectItem key={type} value={type}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addWidget} disabled={!newWidgetType}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {layout.widgets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No widgets added yet. Add widgets to build your custom dashboard.</p>
              </div>
            ) : (
              <DraggableDashboard
                layout={layout}
                onLayoutChange={setLayout}
                onRemoveWidget={removeWidget}
              >
                {(widget) => (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{WIDGET_DISPLAY_NAMES[widget.type as WidgetType] || widget.type}</Badge>
                      <Badge variant="secondary">{widget.size}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Widget preview will appear here
                    </div>
                  </div>
                )}
              </DraggableDashboard>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

