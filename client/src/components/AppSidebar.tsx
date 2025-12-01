import {
  LayoutDashboard,
  ListTree,
  Users,
  Grid2X2,
  Briefcase,
  AlertTriangle,
  AlertCircle,
  FileEdit,
  DollarSign,
  FileText,
  BarChart3,
  Calendar,
  Package,
  Bot,
  FileDown,
  Mail,
  Settings,
  MessageSquare,
  Contact,
  FolderKanban,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const projectTabs = [
  { title: "Overview", icon: LayoutDashboard, path: "/" },
  { title: "WBS & Tasks", icon: ListTree, path: "/wbs" },
  { title: "Stakeholders", icon: Users, path: "/stakeholders" },
  { title: "RACI Matrix", icon: Grid2X2, path: "/raci-matrix" },
  { title: "Resources", icon: Briefcase, path: "/resources" },
  { title: "Risks", icon: AlertTriangle, path: "/risks" },
  { title: "Issues", icon: AlertCircle, path: "/issues" },
  { title: "Change Requests", icon: FileEdit, path: "/change-requests" },
  { title: "Cost Management", icon: DollarSign, path: "/cost" },
  { title: "AI Assistant", icon: Bot, path: "/ai-assistant" },
  { title: "Chat", icon: MessageSquare, path: "/chat" },
  { title: "Reports", icon: FileDown, path: "/reports" },
  { title: "Email Templates", icon: Mail, path: "/email-templates" },
  { title: "Documents", icon: FileText, path: "/documents" },
  { title: "Analytics", icon: BarChart3, path: "/analytics" },
];

const pmoTabs = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/pmo/dashboard" },
  { title: "Projects", icon: FolderKanban, path: "/pmo/projects" },
  { title: "Contacts Directory", icon: Contact, path: "/pmo/contacts" },
  { title: "Calendar", icon: Calendar, path: "/pmo/calendar" },
  { title: "Inventory", icon: Package, path: "/pmo/inventory" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Project Tabs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectTabs.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.path} data-testid={`sidebar-link-${item.path.slice(1) || 'overview'}`}>
                    <Link href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>PMO Level</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pmoTabs.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.path} data-testid={`sidebar-link-pmo-${item.path.split('/').pop()}`}>
                    <Link href={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
