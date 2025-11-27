import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Contact } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useProject } from "@/contexts/ProjectContext";

export default function ContactsPage() {
  const { selectedOrgId, selectedProjectId } = useProject();
  const selectedOrganizationId = selectedOrgId; // Alias for compatibility with my previous code
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectedContactForLogs, setSelectedContactForLogs] = useState<Contact | null>(null);

  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: [`/api/organizations/${selectedOrganizationId}/contacts`],
    enabled: !!selectedOrganizationId,
  });

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(searchLower) ||
      contact.lastName.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower)
    );
  });

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
      const promises = selectedContacts.map(contactId =>
        apiRequest("POST", `/api/projects/${selectedProjectId}/assign-contact`, {
          contactId,
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Simple CSV parser
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '')); // Remove quotes
        
        const parsedContacts = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const contact: any = {};
          headers.forEach((header, i) => {
            // Map common CSV headers to schema
            const key = header.toLowerCase();
            if (key.includes('first')) contact.firstName = values[i];
            else if (key.includes('last')) contact.lastName = values[i];
            else if (key.includes('email')) contact.email = values[i];
            else if (key.includes('phone')) contact.phone = values[i];
            else if (key.includes('company')) contact.company = values[i];
            else if (key.includes('title')) contact.jobTitle = values[i];
            else if (key.includes('type')) contact.type = values[i];
            else if (key.includes('notes')) contact.notes = values[i];
          });
          return contact;
        });
        
        importContactsMutation.mutate(parsedContacts);
      };
      reader.readAsText(file);
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
          {selectedContacts.length > 0 && (
            <Button onClick={() => setIsAssignOpen(true)} variant="secondary">
              <UserPlus className="mr-2 h-4 w-4" />
              Assign to Project ({selectedContacts.length})
            </Button>
          )}
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

      <div className="flex items-center gap-2 px-6 py-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 pb-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      className="translate-y-[2px]"
                      checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContacts(filteredContacts.map(c => c.id));
                        } else {
                          setSelectedContacts([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="translate-y-[2px]"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedContacts([...selectedContacts, contact.id]);
                            } else {
                              setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{contact.firstName} {contact.lastName}</span>
                          <span className="text-xs text-muted-foreground">{contact.jobTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.company}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {contact.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </ScrollArea>

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

