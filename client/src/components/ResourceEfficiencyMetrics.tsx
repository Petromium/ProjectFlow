import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Activity, DollarSign, Clock } from "lucide-react";

interface ResourceEfficiencyProps {
  stats: {
    cpi: number; // Cost Performance Index
    efficiency: number; // Time Efficiency
    totalBudgetedHours: number;
    totalActualHours: number;
    costVariance: number;
  };
}

export function ResourceEfficiencyMetrics({ stats }: ResourceEfficiencyProps) {
  // CPI > 1 = Under Budget (Good), < 1 = Over Budget (Bad)
  const cpiColor = stats.cpi >= 1 ? "text-green-500" : "text-red-500";
  const cpiIcon = stats.cpi >= 1 ? TrendingUp : TrendingDown;
  
  // Efficiency > 100% = Faster than expected
  const efficiencyColor = stats.efficiency >= 100 ? "text-green-500" : "text-amber-500";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cost Performance Index (CPI)</CardTitle>
          <DollarSign className={`h-4 w-4 ${cpiColor}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${cpiColor}`}>{stats.cpi.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            EV / AC (Target: &gt; 1.0)
          </p>
          <Progress 
            value={Math.min(stats.cpi * 50, 100)} 
            className={`h-2 mt-2 ${stats.cpi < 1 ? "bg-red-100" : "bg-green-100"}`} 
            indicatorClassName={stats.cpi < 1 ? "bg-red-500" : "bg-green-500"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Time Efficiency</CardTitle>
          <Clock className={`h-4 w-4 ${efficiencyColor}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${efficiencyColor}`}>{stats.efficiency.toFixed(0)}%</div>
          <p className="text-xs text-muted-foreground">
            Budgeted vs Actual Hours
          </p>
          <div className="text-xs mt-2 flex justify-between">
            <span>{stats.totalActualHours}h Actual</span>
            <span>{stats.totalBudgetedHours}h Planned</span>
          </div>
          <Progress value={Math.min(stats.efficiency, 100)} className="h-2 mt-1" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.costVariance >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stats.costVariance >= 0 ? "+" : ""}{stats.costVariance.toFixed(0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Budget Surplus/Deficit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

