import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import {
  FolderKanban,
  BarChart3,
  Users,
  Calendar,
  Shield,
  Zap,
  Globe,
  Brain,
  ArrowRight,
  Check,
  Building2,
  HardDrive,
  Mail,
  CloudCog,
  FileText,
  Sun,
  Moon
} from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface PricingTierProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  badge?: string;
  highlighted?: boolean;
}

function PricingTier({ name, price, description, features, badge, highlighted }: PricingTierProps) {
  return (
    <Card className={`relative ${highlighted ? 'border-primary shadow-lg' : ''}`}>
      {badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge>{badge}</Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          {price !== 'Custom' && <span className="text-muted-foreground">/month</span>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button className="w-full" variant={highlighted ? 'default' : 'outline'}>
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">ProjectFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button onClick={handleLogin} data-testid="button-login">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            EPC-Focused Project Management
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Streamline Your EPC Projects
            <br />
            <span className="text-primary">From Concept to Completion</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            A comprehensive Project Management Information System designed for Engineering, Procurement, 
            and Construction projects. Track WBS, manage costs, assess risks, and collaborate in real-time.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required. Free tier includes 5 projects.
          </p>
        </div>
      </section>

      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need for EPC Success</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From work breakdown structures to earned value analysis, we provide the tools 
              engineering firms need to deliver projects on time and within budget.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<FolderKanban className="h-5 w-5" />}
              title="5-Level WBS Management"
              description="Create and manage hierarchical work breakdown structures with up to 5 levels of detail. Drag-and-drop organization with automatic WBS code generation."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Gantt Charts"
              description="Interactive Gantt charts with all dependency types (FS, SS, FF, SF). Visualize critical path, track progress, and identify schedule risks."
            />
            <FeatureCard
              icon={<Calendar className="h-5 w-5" />}
              title="Kanban & Calendar Views"
              description="Multiple view options including Kanban boards for agile workflows and calendar views for deadline tracking and resource planning."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Risk & Issue Management"
              description="Comprehensive logs for risks, issues, and change requests. Track mitigation strategies, assign owners, and monitor status."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Cost Analytics"
              description="Multi-currency support with earned value analysis. Track PV, EV, AC, CPI, SPI, and variance across all cost categories."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5" />}
              title="Resource Management"
              description="Assign team members to tasks, track utilization, and balance workloads. Stakeholder management with RACI matrix support."
            />
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="AI-Powered Assistant"
              description="OpenAI-powered assistant that understands your project context. Get insights, generate reports, and automate routine tasks."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Real-Time Collaboration"
              description="WebSocket-based updates ensure your team always sees the latest changes. See who's online and get instant notifications."
            />
            <FeatureCard
              icon={<Globe className="h-5 w-5" />}
              title="Offline PWA Support"
              description="Work offline with Progressive Web App capabilities. Changes sync automatically when you reconnect."
            />
            <FeatureCard
              icon={<CloudCog className="h-5 w-5" />}
              title="Cloud Storage Integration"
              description="Connect your Google Drive, OneDrive, or Dropbox accounts. Sync project documents and attachments seamlessly."
            />
            <FeatureCard
              icon={<FileText className="h-5 w-5" />}
              title="Professional Reports"
              description="Generate PDF reports for project status, risk registers, and earned value analysis. Send email notifications with customizable templates."
            />
            <FeatureCard
              icon={<Building2 className="h-5 w-5" />}
              title="Multi-Tenant Architecture"
              description="Designed for organizations managing multiple projects. Role-based access control with organization-level isolation."
            />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start free and scale as you grow. All plans include core project management features.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            <PricingTier
              name="Free"
              price="$0"
              description="Perfect for small teams and individual projects"
              features={[
                "5 projects",
                "100 tasks per project",
                "100K AI tokens/month",
                "1GB storage",
                "1K emails/month",
                "Basic support"
              ]}
            />
            <PricingTier
              name="Pro"
              price="$49"
              description="For growing teams managing multiple projects"
              features={[
                "50 projects",
                "1,000 tasks per project",
                "1M AI tokens/month",
                "10GB storage",
                "10K emails/month",
                "Priority support",
                "Cloud storage integration"
              ]}
              badge="Most Popular"
              highlighted
            />
            <PricingTier
              name="Enterprise"
              price="Custom"
              description="For large organizations with complex needs"
              features={[
                "100 projects",
                "10,000 tasks per project",
                "10M AI tokens/month",
                "100GB storage",
                "Unlimited emails",
                "Dedicated support",
                "Custom integrations",
                "On-premise option"
              ]}
            />
          </div>
        </div>
      </section>

      <section id="about" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Built for Engineering Excellence</h2>
            <p className="text-muted-foreground mb-8">
              ProjectFlow was designed from the ground up for EPC (Engineering, Procurement, and Construction) 
              projects. We understand the unique challenges of managing complex engineering projects with 
              multiple stakeholders, strict deadlines, and significant budgets.
            </p>
            <div className="grid gap-6 md:grid-cols-3 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">100+</div>
                <p className="text-sm text-muted-foreground">Organizations Supported</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">1000+</div>
                <p className="text-sm text-muted-foreground">Projects Managed</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
                <p className="text-sm text-muted-foreground">Uptime SLA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Project Management?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join hundreds of engineering teams already using ProjectFlow to deliver projects 
            on time and within budget.
          </p>
          <Button size="lg" onClick={handleLogin} data-testid="button-cta-final">
            Start Your Free Trial
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              <span className="font-semibold">ProjectFlow</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </nav>
            <p className="text-sm text-muted-foreground">
              2025 ProjectFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
