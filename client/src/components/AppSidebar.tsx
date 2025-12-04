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
  BookOpen,
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
import { useProject } from "@/contexts/ProjectContext";

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
  { title: "Documents", icon: FileText, path: "/documents" },
  { title: "Analytics", icon: BarChart3, path: "/analytics" },
];

const pmoTabs = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/pmo/dashboard" },
  { title: "Programs", icon: FolderKanban, path: "/pmo/programs" },
  { title: "Projects", icon: FolderKanban, path: "/pmo/projects" },
  { title: "Contacts", icon: Contact, path: "/pmo/contacts" },
  { title: "Calendar", icon: Calendar, path: "/pmo/calendar" },
  { title: "Lessons Learned", icon: BookOpen, path: "/pmo/lessons" },
  { title: "Inventory", icon: Package, path: "/pmo/inventory" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { terminology } = useProject();

  // Dynamically update Programs tab label
  const pmoTabsWithTerminology = pmoTabs.map(tab => {
    if (tab.path === "/pmo/programs") {
      return { ...tab, title: terminology.program + "s" };
    }
    return tab;
  });

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
          <SidebarGroupLabel>{terminology.topLevel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pmoTabsWithTerminology.map((item) => (
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
