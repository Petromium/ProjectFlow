import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Risk } from "@shared/schema";

interface RiskExposureSummaryProps {
  risks: Risk[];
  totalBudget?: number;
}

interface RiskSummary {
  totalExposure: number;
  totalContingency: number;
  exposurePercentage: number;
  topRisks: Array<{
    id: number;
    title: string;
    exposure: number;
    probability: number;
    impact: string;
    status: string;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
    exposure: number;
  }>;
  openCount: number;
  closedCount: number;
  mitigatingCount: number;
}

const IMPACT_MULTIPLIER: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function calculateRiskExposure(risk: Risk): number {
  const rawCostImpact = Number(risk.costImpact);
  const costImpact = isNaN(rawCostImpact) ? 0 : rawCostImpact;
  
  const rawProb = typeof risk.probability === 'number' ? risk.probability : 3;
  const probability = (isNaN(rawProb) ? 3 : rawProb) / 5;
  
  const impactMult = IMPACT_MULTIPLIER[risk.impact || 'medium'] || 2;
  
  if (costImpact > 0) {
    return costImpact * probability;
  }
  return impactMult * probability * 10000;
}

function calculateRiskSummary(risks: Risk[], totalBudget: number): RiskSummary {
  const openRisks = risks.filter(r => r.status !== 'closed');
  
  let totalExposure = 0;
  let totalContingency = 0;
  
  const topRisks = openRisks
    .map(risk => {
      const rawExposure = Number(risk.riskExposure);
      const exposure = isNaN(rawExposure) || rawExposure === 0 ? calculateRiskExposure(risk) : rawExposure;
      
      const rawContingency = Number(risk.contingencyReserve);
      const contingency = isNaN(rawContingency) ? 0 : rawContingency;
      
      totalExposure += exposure;
      totalContingency += contingency;
      
      return {
        id: risk.id,
        title: risk.title,
        exposure,
        probability: typeof risk.probability === 'number' ? risk.probability : 0,
        impact: risk.impact || 'medium',
        status: risk.status || 'identified',
      };
    })
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 5);

  const categoryMap = new Map<string, { count: number; exposure: number }>();
  openRisks.forEach(risk => {
    const category = risk.categoryEpc || 'technical';
    const current = categoryMap.get(category) || { count: 0, exposure: 0 };
    current.count++;
    
    const rawExposure = Number(risk.riskExposure);
    const exposure = isNaN(rawExposure) || rawExposure === 0 ? calculateRiskExposure(risk) : rawExposure;
    current.exposure += exposure;
    
    categoryMap.set(category, current);
  });

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      exposure: data.exposure,
    }))
    .sort((a, b) => b.exposure - a.exposure);

  return {
    totalExposure,
    totalContingency,
    exposurePercentage: totalBudget > 0 ? (totalExposure / totalBudget) * 100 : 0,
    topRisks,
    byCategory,
    openCount: risks.filter(r => r.status !== 'closed').length,
    closedCount: risks.filter(r => r.status === 'closed').length,
    mitigatingCount: risks.filter(r => r.status === 'mitigating').length,
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  external: "External",
  organizational: "Organizational",
  "project-management": "Project Mgmt",
  commercial: "Commercial",
  hse: "HSE",
  quality: "Quality",
  schedule: "Schedule",
  resource: "Resource",
};

export function RiskExposureSummary({ risks, totalBudget = 0 }: RiskExposureSummaryProps) {
  const summary = useMemo(() => calculateRiskSummary(risks, totalBudget), [risks, totalBudget]);

  if (risks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Exposure
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No risks identified</p>
        </CardContent>
      </Card>
    );
  }

  const contingencyCoverage = summary.totalExposure > 0 
    ? (summary.totalContingency / summary.totalExposure) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Risk Exposure Summary
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="destructive">{summary.openCount} Open</Badge>
            <Badge variant="secondary">{summary.mitigatingCount} Mitigating</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Total Exposure
            </div>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(summary.totalExposure)}
            </div>
            {totalBudget > 0 && (
              <div className="text-xs text-muted-foreground">
                {summary.exposurePercentage.toFixed(1)}% of budget
              </div>
            )}
          </div>
          
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingDown className="h-4 w-4" />
              Contingency Reserve
            </div>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(summary.totalContingency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {contingencyCoverage.toFixed(0)}% coverage
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Top Risk Exposures</h4>
          <div className="space-y-3">
            {summary.topRisks.map((risk, index) => (
              <div key={risk.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{risk.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>P: {risk.probability}/5</span>
                    <span className="capitalize">I: {risk.impact}</span>
                  </div>
                </div>
                <span className={cn(
                  "font-mono text-sm font-semibold",
                  risk.exposure > 100000 ? "text-red-500" : 
                  risk.exposure > 50000 ? "text-amber-500" : "text-emerald-500"
                )}>
                  {formatCurrency(risk.exposure)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {summary.byCategory.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Exposure by Category</h4>
            <div className="space-y-2">
              {summary.byCategory.slice(0, 4).map((cat) => {
                const percentage = summary.totalExposure > 0 
                  ? (cat.exposure / summary.totalExposure) * 100 
                  : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize">{CATEGORY_LABELS[cat.category] || cat.category}</span>
                      <span className="text-muted-foreground">{cat.count} risks</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
