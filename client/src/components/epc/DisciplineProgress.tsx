import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import type { Task } from "@shared/schema";

interface DisciplineProgressProps {
  tasks: Task[];
  showChart?: boolean;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  civil: "#3b82f6",       // blue
  structural: "#6366f1",   // indigo
  mechanical: "#8b5cf6",   // violet
  electrical: "#f59e0b",   // amber
  piping: "#10b981",       // emerald
  instrumentation: "#ef4444", // red
  process: "#06b6d4",      // cyan
  hvac: "#ec4899",         // pink
  architectural: "#84cc16", // lime
  general: "#6b7280",      // gray
};

const DISCIPLINE_LABELS: Record<string, string> = {
  civil: "Civil",
  structural: "Structural",
  mechanical: "Mechanical",
  electrical: "Electrical",
  piping: "Piping",
  instrumentation: "Instrumentation",
  process: "Process",
  hvac: "HVAC",
  architectural: "Architectural",
  general: "General",
};

interface DisciplineData {
  discipline: string;
  label: string;
  taskCount: number;
  completedTasks: number;
  progress: number;
  color: string;
}

function calculateDisciplineProgress(tasks: Task[]): DisciplineData[] {
  if (tasks.length === 0) {
    return [];
  }

  const disciplineMap = new Map<string, { total: number; completed: number; progressSum: number }>();

  tasks.forEach(task => {
    const discipline = task.discipline || "general";
    const current = disciplineMap.get(discipline) || { total: 0, completed: 0, progressSum: 0 };
    
    current.total++;
    if (task.status === "completed") current.completed++;
    
    const progress = typeof task.progress === 'number' && !isNaN(task.progress) ? task.progress : 0;
    current.progressSum += progress;
    
    disciplineMap.set(discipline, current);
  });

  return Array.from(disciplineMap.entries())
    .map(([discipline, data]) => {
      const avgProgress = data.total > 0 ? data.progressSum / data.total : 0;
      return {
        discipline,
        label: DISCIPLINE_LABELS[discipline] || discipline,
        taskCount: data.total,
        completedTasks: data.completed,
        progress: isNaN(avgProgress) ? 0 : Math.round(avgProgress),
        color: DISCIPLINE_COLORS[discipline] || "#6b7280",
      };
    })
    .sort((a, b) => b.taskCount - a.taskCount);
}

export function DisciplineProgress({ tasks, showChart = true }: DisciplineProgressProps) {
  const data = useMemo(() => calculateDisciplineProgress(tasks), [tasks]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Discipline Progress</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">
            No tasks with disciplines assigned
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalTasks = data.reduce((sum, d) => sum + d.taskCount, 0);
  const overallProgress = Math.round(data.reduce((sum, d) => sum + d.progress * d.taskCount, 0) / totalTasks);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Discipline Progress</CardTitle>
          <Badge variant="secondary">{overallProgress}% Overall</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {showChart && data.length > 1 && (
          <div className="h-[180px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={55} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value: number, name: string) => [`${value}%`, 'Progress']}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-3">
          {data.slice(0, 6).map((item) => (
            <div key={item.discipline}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.taskCount} tasks
                  </Badge>
                </div>
                <span className="text-sm font-semibold">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
