import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Plus, Download, Upload, Bell, Moon, Sun, User, X, Building2, FolderKanban, Settings, LogOut, Mail, Shield, CheckCheck, FileJson, FileText, AlertCircle, Info } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  time: string;
  read: boolean;
}

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; errors?: string[]; warnings?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, title: "Task Assigned", message: "You've been assigned to 'Site Preparation'", type: "info", time: "2 hours ago", read: false },
    { id: 2, title: "Risk Alert", message: "High risk 'Weather Delays' requires attention", type: "warning", time: "5 hours ago", read: false },
    { id: 3, title: "Issue Resolved", message: "Issue 'Permit Delay' has been closed", type: "success", time: "1 day ago", read: false },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: "Notifications marked as read" });
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
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

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
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
    setImportResult(null);
    setImportDialogOpen(true);
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/import/template', { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch template");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_template.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Template downloaded" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

  const handleDownloadSchema = async () => {
    try {
      const response = await fetch('/api/import/schema', { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch schema");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_schema.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Schema downloaded - use this with AI tools to generate valid project JSON" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to download schema", variant: "destructive" });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProjectId) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch(`/api/projects/${selectedProjectId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        setImportResult({
          success: true,
          message: result.message || "Project data imported successfully",
          warnings: result.warnings
        });
        toast({ title: "Success", description: result.message || "Project data imported successfully" });
      } else {
        setImportResult({
          success: false,
          message: result.message || "Import failed",
          errors: result.errors,
          warnings: result.warnings
        });
        toast({ title: "Import Issues", description: `Import completed with ${result.errors?.length || 0} error(s)`, variant: "destructive" });
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || "Failed to import project data",
        errors: ["Invalid JSON format or network error"]
      });
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
          <DropdownMenuItem 
            data-testid="menu-item-new-task"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/tasks?action=new`)}
            disabled={!selectedProjectId}
          >
            New Task
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-risk"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/risks?action=new`)}
            disabled={!selectedProjectId}
          >
            New Risk
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-issue"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/issues?action=new`)}
            disabled={!selectedProjectId}
          >
            New Issue
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-change"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/change-requests?action=new`)}
            disabled={!selectedProjectId}
          >
            Change Request
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            data-testid="menu-item-new-project"
            onClick={() => navigate("/?action=new-project")}
          >
            New Project
          </DropdownMenuItem>
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
          <DropdownMenuItem 
            data-testid="menu-item-new-task"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/tasks?action=new`)}
            disabled={!selectedProjectId}
          >
            New Task
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-risk"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/risks?action=new`)}
            disabled={!selectedProjectId}
          >
            New Risk
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-issue"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/issues?action=new`)}
            disabled={!selectedProjectId}
          >
            New Issue
          </DropdownMenuItem>
          <DropdownMenuItem 
            data-testid="menu-item-new-change"
            onClick={() => selectedProjectId && navigate(`/projects/${selectedProjectId}/change-requests?action=new`)}
            disabled={!selectedProjectId}
          >
            Change Request
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            data-testid="menu-item-new-project"
            onClick={() => navigate("/?action=new-project")}
          >
            New Project
          </DropdownMenuItem>
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Import</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleImportJSON} data-testid="menu-item-import-json">
              <Upload className="h-4 w-4 mr-2" />
              Import Project Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTemplate} data-testid="menu-item-download-template">
              <FileJson className="h-4 w-4 mr-2" />
              Download Template
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadSchema} data-testid="menu-item-download-schema">
              <FileText className="h-4 w-4 mr-2" />
              Download AI Schema
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-item-export-pdf">
              <Download className="h-4 w-4 mr-2" />
              PDF Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON} data-testid="menu-item-export-json">
              <Download className="h-4 w-4 mr-2" />
              JSON Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV} data-testid="menu-item-export-csv">
              <Download className="h-4 w-4 mr-2" />
              CSV Tasks
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

        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs" data-testid="badge-notification-count">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between p-3 border-b">
              <h4 className="font-semibold text-sm">Notifications</h4>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="h-auto py-1 px-2 text-xs" data-testid="button-mark-all-read">
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="h-[300px]">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover-elevate cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notification.type === 'warning' ? 'bg-amber-500' :
                            notification.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                          }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-profile">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
                <AvatarFallback className="text-xs">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)} data-testid="menu-item-profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="menu-item-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Profile</DialogTitle>
              <DialogDescription>Your account information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
                  <AvatarFallback className="text-xl">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{user?.firstName} {user?.lastName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {user?.email}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organizations
                </h4>
                <div className="space-y-2">
                  {organizations.map(org => (
                    <div key={org.id} className="flex items-center justify-between text-sm">
                      <span>{org.name}</span>
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Member
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setProfileOpen(false)} data-testid="button-close-profile">
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Project Data</DialogTitle>
              <DialogDescription>
                Import tasks, risks, issues, stakeholders, and costs from a JSON file
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* AI Generation Tip */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Use AI to generate project data:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                      <li>Download the "AI Schema" from the dropdown menu</li>
                      <li>Give the schema to ChatGPT, Claude, or Gemini</li>
                      <li>Ask it to generate project data following the schema</li>
                      <li>Import the generated JSON file here</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="flex-1" data-testid="button-download-template">
                  <FileJson className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadSchema} className="flex-1" data-testid="button-download-schema">
                  <FileText className="h-4 w-4 mr-2" />
                  Download AI Schema
                </Button>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className={`rounded-lg p-3 ${importResult.success ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <CheckCheck className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${importResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                        {importResult.message}
                      </p>
                      {importResult.warnings && importResult.warnings.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Warnings:</p>
                          <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                            {importResult.warnings.slice(0, 5).map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                            {importResult.warnings.length > 5 && (
                              <li>...and {importResult.warnings.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-700 dark:text-red-300">Errors:</p>
                          <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                            {importResult.errors.slice(0, 5).map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                            {importResult.errors.length > 5 && (
                              <li>...and {importResult.errors.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-cancel-import">
                  {importResult?.success ? 'Close' : 'Cancel'}
                </Button>
                <div className="flex gap-2">
                  {importResult?.success && (
                    <Button onClick={() => window.location.reload()} data-testid="button-reload-page">
                      Reload Page
                    </Button>
                  )}
                  <Button onClick={handleSelectFile} data-testid="button-select-import-file">
                    <Upload className="h-4 w-4 mr-2" />
                    {importResult ? 'Import Another' : 'Select JSON File'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
