import { useState, useRef } from "react";
import { Search, Plus, Download, Upload, Bell, Moon, Sun, User, X, Building2, FolderKanban } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleExportJSON = async () => {
    if (!selectedProjectId) {
      toast({ title: "Error", description: "Please select a project first", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/export`, { credentials: 'include' });
      if (!response.ok) throw new Error("Export failed");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProject?.code || 'project'}_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Project exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export project", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedProjectId) {
      toast({ title: "Error", description: "Please select a project first", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/export?format=csv`, { credentials: 'include' });
      if (!response.ok) throw new Error("Export failed");
      const csvData = await response.text();
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProject?.code || 'project'}_tasks_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Tasks exported as CSV" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedProjectId) {
      toast({ title: "Error", description: "Please select a project first", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/reports/status`, { credentials: 'include' });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProject?.code || 'project'}_status_report_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "PDF report downloaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate PDF report", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJSON = () => {
    if (!selectedProjectId) {
      toast({ title: "Error", description: "Please select a project first", variant: "destructive" });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const response = await apiRequest("POST", `/api/projects/${selectedProjectId}/import`, data);
      if (response.ok) {
        toast({ title: "Success", description: "Project data imported successfully" });
        window.location.reload();
      } else {
        throw new Error("Import failed");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to import project data", variant: "destructive" });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header className="flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background px-2 md:px-4">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      
      {/* Mobile: Sheet-based selector */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="outline" size="sm" className="gap-1 text-xs max-w-[120px] truncate" data-testid="button-mobile-selector">
            <FolderKanban className="h-3 w-3 shrink-0" />
            <span className="truncate">{selectedProject?.name || "Select"}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="h-auto">
          <SheetHeader>
            <SheetTitle>Select Context</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </label>
              <Select
                value={selectedOrgId?.toString() || ""}
                onValueChange={(value) => setSelectedOrgId(parseInt(value))}
                disabled={isLoadingOrgs || organizations.length === 0 || !!orgsError}
              >
                <SelectTrigger data-testid="trigger-organization-mobile">
                  <SelectValue placeholder={
                    orgsError ? "Error" :
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
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Project
              </label>
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(value) => setSelectedProjectId(parseInt(value))}
                disabled={isLoadingProjects || projects.length === 0 || !selectedOrgId || !!projectsError}
              >
                <SelectTrigger data-testid="trigger-project-mobile">
                  <SelectValue placeholder={
                    projectsError ? "Error" :
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
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: Inline selectors */}
      <Select
        value={selectedOrgId?.toString() || ""}
        onValueChange={(value) => setSelectedOrgId(parseInt(value))}
        disabled={isLoadingOrgs || organizations.length === 0 || !!orgsError}
        data-testid="select-organization"
      >
        <SelectTrigger className="hidden md:flex w-48" data-testid="trigger-organization">
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
        <SelectTrigger className="hidden md:flex w-56" data-testid="trigger-project">
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

      {/* Desktop: Full search bar */}
      <div className="relative hidden md:flex flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tasks, documents, resources..."
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {/* Mobile: Expandable search */}
      {searchOpen ? (
        <div className="flex md:hidden flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-9 h-9"
              autoFocus
              data-testid="input-search-mobile"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(false)} data-testid="button-close-search">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} data-testid="button-open-search">
          <Search className="h-4 w-4" />
        </Button>
      )}

      {/* Add button - icon only on mobile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="icon" className="md:hidden shrink-0" data-testid="button-add-mobile">
            <Plus className="h-4 w-4" />
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="default" className="hidden md:flex" data-testid="button-add">
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
        data-testid="input-import-file"
      />
      
      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden md:flex" disabled={isExporting} data-testid="button-import-export">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Import / Export</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleImportJSON} data-testid="menu-item-import-json">
              <Upload className="h-4 w-4 mr-2" />
              Import JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-item-export-pdf">
              <Download className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON} data-testid="menu-item-export-json">
              <Download className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV} data-testid="menu-item-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
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
