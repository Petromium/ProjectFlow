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
  Moon,
  Star,
  Award,
  Lock,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

  useEffect(() => {
    trackEvent('page_view', 'marketing', 'landing_page');
  }, []);

  const handleLogin = () => {
    trackEvent('cta_click', 'marketing', 'sign_in_button');
    window.location.href = '/login';
  };

  const handleGetStarted = () => {
    trackEvent('cta_click', 'marketing', 'get_started_button');
    window.location.href = '/login';
  };

  const handleViewDemo = () => {
    trackEvent('cta_click', 'marketing', 'view_demo_button');
    // TODO: Open demo video or interactive tour
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
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Testimonials
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
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

      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge variant="secondary" className="mb-4">
            <Award className="h-3 w-3 mr-1 inline" />
            Trusted by 100+ EPC Firms
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
          
          {/* Live Stats */}
          <div className="flex items-center justify-center gap-8 mb-8 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span><strong className="text-foreground">1,000+</strong> Projects Managed</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span><strong className="text-foreground">500+</strong> Active Users</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span><strong className="text-foreground">99.9%</strong> Uptime</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button size="lg" onClick={handleGetStarted} data-testid="button-get-started">
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleViewDemo}>
              View Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            <Lock className="h-3 w-3 inline mr-1" />
            No credit card required. Free tier includes 3 projects.
          </p>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-60">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm">SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              <span className="text-sm">ISO 27001 Certified</span>
            </div>
          </div>
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

          <div className="grid gap-8 md:grid-cols-4 max-w-6xl mx-auto">
            <PricingTier
              name="Free"
              price="$0"
              description="Perfect for small teams"
              features={[
                "3 projects",
                "100 tasks per project",
                "10K AI tokens/month",
                "512MB storage",
                "50 emails/month",
                "Basic support"
              ]}
            />
            <PricingTier
              name="Starter"
              price="$29"
              description="For growing teams"
              features={[
                "10 projects",
                "500 tasks per project",
                "50K AI tokens/month",
                "2GB storage",
                "500 emails/month",
                "Priority support",
                "Cloud storage integration"
              ]}
            />
            <PricingTier
              name="Professional"
              price="$79"
              description="For established organizations"
              features={[
                "50 projects",
                "1,000 tasks per project",
                "200K AI tokens/month",
                "10GB storage",
                "2K emails/month",
                "Advanced reports",
                "Cloud storage integration"
              ]}
              badge="Most Popular"
              highlighted
            />
            <PricingTier
              name="Enterprise"
              price="Custom"
              description="For large enterprises"
              features={[
                "100 projects",
                "10K tasks per project",
                "1M AI tokens/month",
                "50GB storage",
                "Unlimited emails",
                "Dedicated support",
                "Custom integrations",
                "White-label option"
              ]}
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Trusted by Engineering Teams</h2>
            <p className="text-muted-foreground">See what our customers say</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">"ProjectFlow transformed how we manage our EPC projects. The WBS management is exceptional and the real-time collaboration keeps our team aligned."</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">John Smith</p>
                    <p className="text-xs text-muted-foreground">Project Manager, ABC Engineering</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">"The cost analytics and earned value analysis features are exactly what we needed. We've improved project visibility by 40% since switching to ProjectFlow."</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Sarah Johnson</p>
                    <p className="text-xs text-muted-foreground">Finance Director, XYZ Construction</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">"As an executive, I love the portfolio view and risk dashboard. It gives me instant visibility across all our projects without getting into the weeds."</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Michael Chen</p>
                    <p className="text-xs text-muted-foreground">VP Operations, Global EPC Corp</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="about" className="py-20">
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

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about ProjectFlow</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is EPC Project Management?</AccordionTrigger>
              <AccordionContent>
                EPC stands for Engineering, Procurement, and Construction. Our platform is specifically designed
                for managing complex engineering projects with multiple phases, stakeholders, and deliverables.
                Unlike generic project management tools, ProjectFlow understands the unique workflows and compliance
                requirements of EPC projects.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How does ProjectFlow differ from MS Project or Primavera P6?</AccordionTrigger>
              <AccordionContent>
                ProjectFlow is purpose-built for EPC projects with features like NCR (Non-Conformance Report) tracking,
                HSE (Health, Safety, Environment) compliance, and EPC-specific cost structures built-in. Unlike desktop
                software, ProjectFlow offers real-time collaboration, cloud storage integration, and mobile access. Plus,
                our AI assistant helps automate routine project management tasks.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Can I try ProjectFlow before committing?</AccordionTrigger>
              <AccordionContent>
                Absolutely! Our Free tier includes 3 projects with full access to core features. No credit card required.
                You can upgrade to a paid plan anytime when you're ready to scale. All plans include a 14-day free trial
                of premium features.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is my data secure?</AccordionTrigger>
              <AccordionContent>
                Yes. We're SOC 2 compliant and ISO 27001 certified. All data is encrypted in transit and at rest.
                We use enterprise-grade security practices including role-based access control, audit logging, and
                regular security audits. Your data is never shared with third parties.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Can I integrate ProjectFlow with other tools?</AccordionTrigger>
              <AccordionContent>
                Yes! ProjectFlow integrates with Google Drive, OneDrive, and Dropbox for document management.
                We also support API access for Enterprise customers who need custom integrations with their existing
                systems like ERP, accounting software, or other project management tools.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>What kind of support do you offer?</AccordionTrigger>
              <AccordionContent>
                Free tier users get access to our knowledge base and community forum. Starter and Professional plans
                include priority email support with 24-hour response time. Enterprise customers get dedicated account
                management, phone support, and custom onboarding assistance.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-3xl mx-auto bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Project Management?</h2>
              <p className="text-muted-foreground mb-8">
                Join hundreds of engineering teams already using ProjectFlow to deliver projects
                on time and within budget.
              </p>
              <Button size="lg" onClick={handleGetStarted} data-testid="button-cta-final">
                Start Your Free Trial
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FolderKanban className="h-5 w-5 text-primary" />
                <span className="font-semibold">ProjectFlow</span>
              </div>
              <p className="text-sm text-muted-foreground">
                EPC Project Management Information System
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <nav className="space-y-2 text-sm text-muted-foreground">
                <a href="#features" className="block hover:text-foreground transition-colors">Features</a>
                <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
                <a href="#testimonials" className="block hover:text-foreground transition-colors">Testimonials</a>
                <a href="#faq" className="block hover:text-foreground transition-colors">FAQ</a>
              </nav>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <nav className="space-y-2 text-sm text-muted-foreground">
                <a href="#about" className="block hover:text-foreground transition-colors">About</a>
                <a href="#" className="block hover:text-foreground transition-colors">Blog</a>
                <a href="#" className="block hover:text-foreground transition-colors">Careers</a>
                <a href="#" className="block hover:text-foreground transition-colors">Contact</a>
              </nav>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <nav className="space-y-2 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">Terms</a>
                <a href="#" className="block hover:text-foreground transition-colors">Privacy</a>
                <a href="#" className="block hover:text-foreground transition-colors">Security</a>
              </nav>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 ProjectFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {/* Social media links can be added here */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
