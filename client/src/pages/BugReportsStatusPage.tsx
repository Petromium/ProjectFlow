import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Bug, Sparkles, MessageSquare, HelpCircle, CheckCircle2, XCircle, Clock, Eye, AlertCircle, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function BugReportsStatusPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/bug-reports/:id");
  const reportId = params?.id ? parseInt(params.id, 10) : null;

  // Fetch all reports or a specific report
  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: reportId ? ["/api/bug-reports", reportId] : ["/api/bug-reports"],
    queryFn: async () => {
      if (reportId) {
        // Fetch specific report
        const response = await apiRequest("GET", `/api/bug-reports/${reportId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Report not found");
          }
          throw new Error("Failed to load report");
        }
        const report = await response.json();
        return [report]; // Return as array for consistent rendering
      } else {
        // Fetch all reports
        const response = await apiRequest("GET", "/api/bug-reports");
        return response.json();
      }
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      reviewing: "secondary",
      "in-progress": "default",
      resolved: "default",
      rejected: "destructive",
      duplicate: "secondary",
    };
    const icons: Record<string, any> = {
      pending: Clock,
      reviewing: Eye,
      "in-progress": Clock,
      resolved: CheckCircle2,
      rejected: XCircle,
      duplicate: XCircle,
    };
    const Icon = icons[status] || AlertCircle;
    return (
      <Badge variant={variants[status] || "outline"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      bug: Bug,
      "feature-request": Sparkles,
      feedback: MessageSquare,
      other: HelpCircle,
    };
    return icons[category] || HelpCircle;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "text-green-600";
      case "in-progress":
        return "text-blue-600";
      case "rejected":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error Loading Report</h3>
                <p className="text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "An error occurred while loading the report."}
                </p>
                <Button onClick={() => setLocation("/bug-reports")}>
                  View All Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {reportId ? `Bug Report #${reportId}` : "My Bug Reports"}
            </h1>
            <p className="text-muted-foreground">
              {reportId 
                ? "View details of your submitted report"
                : "Track the status of your submitted reports and feedback"}
            </p>
          </div>
          <div className="flex gap-2">
            {reportId && (
              <Button variant="outline" onClick={() => setLocation("/bug-reports")}>
                Back to All Reports
              </Button>
            )}
            <Button onClick={() => setLocation("/bug-report")}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </div>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't submitted any bug reports or feedback yet.
                </p>
                <Button onClick={() => setLocation("/bug-report")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Submit Your First Report
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report: any) => {
              const CategoryIcon = getCategoryIcon(report.category);
              return (
                <Card key={report.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-xl">{report.title}</CardTitle>
                        </div>
                        <CardDescription>
                          Report #{report.id} • {format(new Date(report.createdAt), "PPpp")}
                        </CardDescription>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                          {report.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant="outline" className="capitalize">
                          {report.category}
                        </Badge>
                        {report.severity && (
                          <Badge variant="outline" className="capitalize">
                            {report.severity} severity
                          </Badge>
                        )}
                        {report.resolvedAt && (
                          <span className="text-muted-foreground">
                            Resolved {format(new Date(report.resolvedAt), "PP")}
                          </span>
                        )}
                      </div>

                      {report.resolutionNotes && (
                        <Alert className={getStatusColor(report.status)}>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Resolution:</strong> {report.resolutionNotes}
                          </AlertDescription>
                        </Alert>
                      )}

                      {report.status === "pending" && (
                        <Alert>
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            Your report is pending review. Our team typically responds within 2-3 business days.
                          </AlertDescription>
                        </Alert>
                      )}

                      {report.status === "in-progress" && (
                        <Alert>
                          <Eye className="h-4 w-4" />
                          <AlertDescription>
                            Your report is being actively worked on by our team.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

