import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { format, startOfMonth, eachMonthOfInterval, differenceInDays, addDays, isBefore, isAfter } from "date-fns";
import type { Task } from "@shared/schema";

interface SCurveChartProps {
  tasks: Task[];
  projectStartDate: Date;
  projectEndDate: Date;
}

interface SCurveDataPoint {
  date: string;
  month: string;
  planned: number;
  actual: number;
  earned: number;
}

function calculateSCurveData(
  tasks: Task[],
  projectStart: Date,
  projectEnd: Date
): SCurveDataPoint[] {
  if (tasks.length === 0) return [];

  if (!projectStart || !projectEnd || isNaN(projectStart.getTime()) || isNaN(projectEnd.getTime())) {
    return [];
  }

  if (differenceInDays(projectEnd, projectStart) <= 0) {
    return [];
  }

  const months = eachMonthOfInterval({
    start: startOfMonth(projectStart),
    end: startOfMonth(projectEnd)
  });

  const tasksWithDates = tasks.filter(task => {
    const start = task.baselineStart || task.startDate;
    const end = task.baselineFinish || task.endDate;
    return start && end;
  });

  if (tasksWithDates.length === 0) {
    return months.map(monthDate => ({
      date: format(monthDate, 'yyyy-MM-dd'),
      month: format(monthDate, 'MMM yyyy'),
      planned: 0,
      actual: 0,
      earned: 0
    }));
  }

  const totalWeight = tasksWithDates.reduce((sum, t) => {
    const w = Number(t.weightFactor);
    return sum + (isNaN(w) || w <= 0 ? 1 : w);
  }, 0);

  const today = new Date();

  return months.map(monthDate => {
    const monthEnd = addDays(startOfMonth(addDays(monthDate, 32)), -1);
    
    let plannedProgress = 0;
    let actualProgress = 0;
    let earnedProgress = 0;

    tasksWithDates.forEach(task => {
      const rawWeight = Number(task.weightFactor);
      const weight = (isNaN(rawWeight) || rawWeight <= 0 ? 1 : rawWeight) / totalWeight;
      
      const taskStart = task.baselineStart ? new Date(task.baselineStart) : 
                       (task.startDate ? new Date(task.startDate) : null);
      const taskEnd = task.baselineFinish ? new Date(task.baselineFinish) : 
                     (task.endDate ? new Date(task.endDate) : null);

      if (taskStart && taskEnd && !isNaN(taskStart.getTime()) && !isNaN(taskEnd.getTime())) {
        const taskDuration = differenceInDays(taskEnd, taskStart) || 1;
        
        if (isBefore(monthEnd, taskStart)) {
          // Task hasn't started by this month - planned is 0
        } else if (isAfter(monthEnd, taskEnd)) {
          plannedProgress += weight * 100;
        } else {
          const daysElapsed = differenceInDays(monthEnd, taskStart);
          const fraction = Math.min(1, Math.max(0, daysElapsed / taskDuration));
          plannedProgress += weight * 100 * fraction;
        }

        const progress = typeof task.progress === 'number' ? task.progress : 0;
        
        if (isBefore(monthEnd, today) || format(monthEnd, 'yyyy-MM') === format(today, 'yyyy-MM')) {
          actualProgress += weight * 100 * (progress / 100);
        }

        const baselineCost = Number(task.baselineCost) || 0;
        const earnedValue = Number(task.earnedValue) || 0;
        
        if (isBefore(monthEnd, today) || format(monthEnd, 'yyyy-MM') === format(today, 'yyyy-MM')) {
          if (earnedValue > 0 && baselineCost > 0) {
            earnedProgress += weight * 100 * (earnedValue / baselineCost);
          } else {
            earnedProgress += weight * 100 * (progress / 100);
          }
        }
      }
    });

    return {
      date: format(monthDate, 'yyyy-MM-dd'),
      month: format(monthDate, 'MMM yyyy'),
      planned: Math.round(plannedProgress * 10) / 10,
      actual: Math.round(actualProgress * 10) / 10,
      earned: Math.round(earnedProgress * 10) / 10
    };
  });
}

export function SCurveChart({ tasks, projectStartDate, projectEndDate }: SCurveChartProps) {
  const data = useMemo(() => 
    calculateSCurveData(tasks, projectStartDate, projectEndDate),
    [tasks, projectStartDate, projectEndDate]
  );

  const todayMonth = format(new Date(), 'MMM yyyy');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">S-Curve Progress</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">
            Add tasks with planned dates to see the S-Curve
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentData = data.find(d => d.month === todayMonth);
  const variance = currentData 
    ? (currentData.actual - currentData.planned).toFixed(1)
    : "0";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">S-Curve Progress</CardTitle>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Earned</span>
            </div>
          </div>
        </div>
        {currentData && (
          <p className="text-sm text-muted-foreground">
            Current variance: <span className={Number(variance) >= 0 ? "text-emerald-500" : "text-red-500"}>
              {Number(variance) >= 0 ? "+" : ""}{variance}%
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => [`${value}%`, '']}
              />
              <ReferenceLine 
                x={todayMonth} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="5 5"
                label={{ value: 'Today', position: 'top', fontSize: 10 }}
              />
              <Line 
                type="monotone" 
                dataKey="planned" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Planned"
              />
              <Line 
                type="monotone" 
                dataKey="actual" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Actual"
              />
              <Line 
                type="monotone" 
                dataKey="earned" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Earned"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
