import { Search, Plus, Download, Bell, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const {
    organizations,
    projects,
    selectedOrgId,
    selectedProjectId,
    setSelectedOrgId,
    setSelectedProjectId,
    isLoadingOrgs,
    isLoadingProjects,
    orgsError,
    projectsError,
  } = useProject();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      
      <Select
        value={selectedOrgId?.toString() || ""}
        onValueChange={(value) => setSelectedOrgId(parseInt(value))}
        disabled={isLoadingOrgs || organizations.length === 0 || !!orgsError}
        data-testid="select-organization"
      >
        <SelectTrigger className="w-48" data-testid="trigger-organization">
          <SelectValue placeholder={
            orgsError ? "Error loading orgs" :
            isLoadingOrgs ? "Loading..." :
            "Select Organization"
          } />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id.toString()}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedProjectId?.toString() || ""}
        onValueChange={(value) => setSelectedProjectId(parseInt(value))}
        disabled={isLoadingProjects || projects.length === 0 || !selectedOrgId || !!projectsError}
        data-testid="select-project"
      >
        <SelectTrigger className="w-56" data-testid="trigger-project">
          <SelectValue placeholder={
            projectsError ? "Error loading projects" :
            isLoadingProjects ? "Loading..." :
            "Select Project"
          } />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id.toString()}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tasks, documents, resources..."
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="default" data-testid="button-add">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Create New</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="menu-item-new-task">New Task</DropdownMenuItem>
          <DropdownMenuItem data-testid="menu-item-new-risk">New Risk</DropdownMenuItem>
          <DropdownMenuItem data-testid="menu-item-new-issue">New Issue</DropdownMenuItem>
          <DropdownMenuItem data-testid="menu-item-new-change">Change Request</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="menu-item-new-project">New Project</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-2 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-import-export">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Import / Export</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="menu-item-import-json">Import JSON</DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-item-import-csv">Import CSV</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="menu-item-export-pdf">Export as PDF</DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-item-export-json">Export as JSON</DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-item-export-csv">Export as CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs" data-testid="badge-notification-count">
            3
          </Badge>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-profile">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user?.firstName} {user?.lastName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="menu-item-profile">Profile</DropdownMenuItem>
            <DropdownMenuItem data-testid="menu-item-settings">Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
