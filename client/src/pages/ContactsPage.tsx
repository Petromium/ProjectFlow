import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { apiRequest } from "@/lib/queryClient";
import { Contact } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  RefreshCw,
  UserPlus,
  Mail,
  Phone,
  Building2,
  User,
  History
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useProject } from "@/contexts/ProjectContext";
import Papa from "papaparse";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export default function ContactsPage() {
  const { selectedOrgId, selectedProjectId } = useProject();
  const selectedOrganizationId = selectedOrgId; // Alias for compatibility with my previous code
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedContactForLogs, setSelectedContactForLogs] = useState<Contact | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`],
    enabled: !!selectedOrganizationId,
  });

  // Define columns
  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>Name</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.firstName} {row.original.lastName}
            </span>
            {row.original.jobTitle && (
              <span className="text-xs text-muted-foreground">{row.original.jobTitle}</span>
            )}
          </div>
        ),
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      },
      {
        id: "contactInfo",
        header: "Contact Info",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-sm">
            {row.original.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span>{row.original.email}</span>
              </div>
            )}
            {row.original.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>{row.original.phone}</span>
              </div>
            )}
            {!row.original.email && !row.original.phone && (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "company",
        header: ({ column }) => (
          <SortableHeader column={column}>Company</SortableHeader>
        ),
        cell: ({ row }) =>
          row.original.company ? (
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span>{row.original.company}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <SortableHeader column={column}>Type</SortableHeader>
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const contact = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedContactForLogs(contact)}>
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </DropdownMenuItem>
                  <DropdownMenuItem>Edit Details</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    []
  );

  const handleExport = (contactsToExport: Contact[] | null) => {
    const dataToExport = contactsToExport || contacts;
    const csv = Papa.unparse(
      dataToExport.map((c) => ({
        "First Name": c.firstName,
        "Last Name": c.lastName,
        Email: c.email || "",
        Phone: c.phone || "",
        Company: c.company || "",
        "Job Title": c.jobTitle || "",
        Type: c.type || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Success", description: "Contacts exported successfully" });
  };

  // Bulk delete contacts mutation
  const bulkDeleteContactsMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      await Promise.all(contactIds.map(id => apiRequest("DELETE", `/api/contacts/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`] });
      setBulkDeleteDialogOpen(false);
      setSelectedContacts([]);
      toast({ title: "Success", description: `${selectedContacts.length} contact(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete contacts", variant: "destructive" });
    },
  });

  const handleBulkAction = (action: string, items: Contact[]) => {
    if (action === "assign") {
      setIsAssignOpen(true);
    } else if (action === "export") {
      handleExport(items);
    } else if (action === "delete") {
      setBulkDeleteDialogOpen(true);
    }
  };

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const res = await apiRequest("POST", `/api/organizations/${selectedOrganizationId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`] });
      setIsAddOpen(false);
      toast({ title: "Success", description: "Contact created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Import contacts mutation
  const importContactsMutation = useMutation({
    mutationFn: async (contacts: any[]) => {
      const res = await apiRequest("POST", `/api/organizations/${selectedOrganizationId}/contacts/import`, { contacts });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`] });
      setIsImportOpen(false);
      toast({
        title: "Import Complete",
        description: `Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors.length}`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Sync contacts from projects mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/${selectedOrganizationId}/contacts/sync-from-projects`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`] });
      toast({
        title: "Sync Complete",
        description: `Created ${data.contactsCreated} new contacts from ${data.stakeholdersProcessed + data.resourcesProcessed} records.`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Assign to project mutation
  const assignToProjectMutation = useMutation({
    mutationFn: async (data: { role: 'stakeholder' | 'resource', type?: string, rate?: number }) => {
      const promises = selectedContacts.map(contact =>
        apiRequest("POST", `/api/projects/${selectedProjectId}/assign-contact`, {
          contactId: contact.id,
          ...data
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      setIsAssignOpen(false);
      setSelectedContacts([]);
      toast({ title: "Success", description: "Contacts assigned to project successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Log raw results for debugging
          console.log("Parsed CSV results:", results);

          // Map CSV fields to Contact schema with flexible column name matching
          const parsedContacts = results.data.map((row: any) => {
            // Normalize keys to lowercase for easier matching
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[key];
            });

            return {
              firstName: normalizedRow['firstname'] || normalizedRow['first'] || row['First Name'] || '',
              lastName: normalizedRow['lastname'] || normalizedRow['last'] || row['Last Name'] || '',
              email: normalizedRow['email'] || normalizedRow['mail'] || row['Email'] || undefined,
              phone: normalizedRow['phone'] || normalizedRow['mobile'] || normalizedRow['tel'] || row['Phone'] || undefined,
              company: normalizedRow['company'] || normalizedRow['organization'] || row['Company'] || undefined,
              jobTitle: normalizedRow['jobtitle'] || normalizedRow['title'] || normalizedRow['role'] || row['Job Title'] || undefined,
              type: normalizedRow['type'] || row['Type'] || 'other',
              notes: normalizedRow['notes'] || row['Notes'] || undefined,
            };
          }).filter((c: any) => c.firstName || c.lastName || c.email); // Ensure at least some data exists

          if (parsedContacts.length === 0) {
            toast({ 
              title: "Parse Error", 
              description: "No valid contacts found in CSV. Please check column headers.", 
              variant: "destructive" 
            });
            return;
          }

          importContactsMutation.mutate(parsedContacts);
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          toast({ title: "CSV Parse Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts Directory</h1>
          <p className="text-sm text-muted-foreground">
            Manage all organization contacts and assign them to projects.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncContactsMutation.mutate()}
            disabled={syncContactsMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncContactsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync from Projects
          </Button>
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Contacts</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with columns: FirstName, LastName, Email, Phone, Company, JobTitle, Type
                </DialogDescription>
              </DialogHeader>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv">CSV File</Label>
                <Input id="csv" type="file" accept=".csv" onChange={handleFileUpload} />
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createContactMutation.mutate({
                    firstName: formData.get("firstName") as string,
                    lastName: formData.get("lastName") as string,
                    email: formData.get("email") as string,
                    phone: formData.get("phone") as string,
                    company: formData.get("company") as string,
                    jobTitle: formData.get("jobTitle") as string,
                    type: formData.get("type") as string,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input id="jobTitle" name="jobTitle" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select name="type" defaultValue="other">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Create Contact</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <DataTable
              columns={columns}
              data={contacts}
              searchKey="name"
              searchPlaceholder="Search contacts by name, email, or company..."
              enableSelection={true}
              enableColumnVisibility={true}
              enableExport={true}
              enableSorting={true}
              enableFiltering={true}
              onSelectionChange={setSelectedContacts}
              onExport={handleExport}
              emptyMessage="No contacts found"
              getRowId={(row) => row.id.toString()}
            />
            {/* Selection Toolbar */}
            <SelectionToolbar
              selectedCount={selectedContacts.length}
              selectedItems={selectedContacts}
              onClearSelection={() => setSelectedContacts([])}
              onBulkAction={handleBulkAction}
              position="sticky"
              bulkActions={[
                {
                  label: "Assign to Project",
                  action: "assign",
                  icon: <UserPlus className="h-4 w-4" />,
                  variant: "default",
                },
                {
                  label: "Delete Selected",
                  action: "delete",
                  icon: <Trash2 className="h-4 w-4" />,
                  variant: "destructive",
                },
                {
                  label: "Export Selected",
                  action: "export",
                  icon: <Upload className="h-4 w-4" />,
                  variant: "outline",
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.length} selected contact(s)? This action cannot be undone.
              <br /><br />
              <strong>Contacts to delete:</strong>
              <ul className="list-disc list-inside mt-2 max-h-32 overflow-y-auto">
                {selectedContacts.map(c => <li key={c.id}>{c.firstName} {c.lastName} {c.email ? `(${c.email})` : ""}</li>)}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = selectedContacts.map(c => c.id);
                bulkDeleteContactsMutation.mutate(ids);
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={bulkDeleteContactsMutation.isPending}
            >
              {bulkDeleteContactsMutation.isPending ? "Deleting..." : `Delete ${selectedContacts.length} Contact(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign to Project Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contacts to Project</DialogTitle>
            <DialogDescription>
              Add {selectedContacts.length} selected contacts to the current project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign As</Label>
              <Select onValueChange={(value) => assignToProjectMutation.mutate({ role: value as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stakeholder">Stakeholder</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Log Dialog */}
      <Dialog open={!!selectedContactForLogs} onOpenChange={(open) => !open && setSelectedContactForLogs(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Interaction History</DialogTitle>
            <DialogDescription>
              History for {selectedContactForLogs?.firstName} {selectedContactForLogs?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Recent Logs</h3>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-3 w-3" />
                Log Interaction
              </Button>
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-4">
                <ContactLogsList contactId={selectedContactForLogs?.id} />
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactLogsList({ contactId }: { contactId?: number }) {
  const { data: logs = [] } = useQuery({
    queryKey: [`/api/contacts/${contactId}/logs`],
    enabled: !!contactId,
  });

  if (!contactId) return null;
  if (logs.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No interactions logged yet.</p>;

  return (
    <div className="space-y-4">
      {logs.map((log: any) => (
        <div key={log.id} className="flex gap-3 items-start text-sm border-b pb-3 last:border-0">
          <div className="mt-0.5">
            {log.type === 'email' && <Mail className="h-4 w-4 text-blue-500" />}
            {log.type === 'meeting' && <User className="h-4 w-4 text-green-500" />}
            {log.type === 'call' && <Phone className="h-4 w-4 text-yellow-500" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium capitalize">{log.type}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(log.date), "MMM d, yyyy h:mm a")}
              </span>
            </div>
            <p className="text-muted-foreground">{log.content || log.subject}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

