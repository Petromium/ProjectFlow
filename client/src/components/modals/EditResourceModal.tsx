import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Wrench, Package, DollarSign, Calendar, Clock, 
  Award, Briefcase, Plus, X, Loader2, AlertTriangle
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import { insertResourceSchema } from "@shared/schema";
import type { Resource, InsertResource } from "@shared/schema";
import { cn } from "@/lib/utils";

interface EditResourceModalProps {
  resource: Resource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdResource?: Resource) => void;
}

interface PricingModel {
  name: string;
  rateType: string;
  rate: number;
  unitType: string;
  currency: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isDefault?: boolean;
}

interface CalendarException {
  date: string;
  type: string;
  note?: string;
}

const RESOURCE_TYPES = [
  { value: "human", label: "Human Resource", icon: User },
  { value: "equipment", label: "Equipment", icon: Wrench },
  { value: "material", label: "Material", icon: Package },
];

const DISCIPLINES = [
  { value: "general", label: "General" },
  { value: "civil", label: "Civil" },
  { value: "structural", label: "Structural" },
  { value: "mechanical", label: "Mechanical" },
  { value: "piping", label: "Piping" },
  { value: "electrical", label: "Electrical" },
  { value: "instrumentation", label: "Instrumentation" },
  { value: "process", label: "Process" },
  { value: "hvac", label: "HVAC" },
  { value: "architectural", label: "Architectural" },
];

const RATE_TYPES = [
  { value: "per-hour", label: "Per Hour (USD/hr)" },
  { value: "per-use", label: "Per Use (USD/use)" },
  { value: "per-unit", label: "Per Unit (USD/unit)" },
];

const UNIT_TYPES = [
  { value: "ea", label: "Each (EA)" },
  { value: "lot", label: "Lot" },
  { value: "hr", label: "Hour (hr)" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "m", label: "Meter (m)" },
  { value: "ft", label: "Feet (ft)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "lb", label: "Pound (lb)" },
  { value: "ton", label: "Ton" },
];

const CONTRACT_TYPES = [
  { value: "full-time", label: "Full-Time Employee" },
  { value: "part-time", label: "Part-Time Employee" },
  { value: "contract", label: "Contractor" },
  { value: "temporary", label: "Temporary" },
  { value: "rental", label: "Rental" },
  { value: "purchase", label: "Purchase" },
  { value: "lease", label: "Lease" },
];

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
];

const AVAILABILITY_STATUSES = [
  { value: "available", label: "Available" },
  { value: "partially_available", label: "Partially Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "on_leave", label: "On Leave" },
];

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const MAX_SKILLS = 10;

export function EditResourceModal({ resource, open, onOpenChange, onSuccess }: EditResourceModalProps) {
  const { selectedProjectId } = useProject();
  const { toast } = useToast();
  const isEditing = !!resource;

  // Map resource type tabs to actual types
  const getTypeFromTab = (tab: string) => {
    switch (tab) {
      case "workers": return "human";
      case "services": return "equipment";
      case "materials": return "material";
      default: return "human";
    }
  };

  const getTabFromType = (type: string) => {
    switch (type) {
      case "human": return "workers";
      case "equipment": return "services";
      case "material": return "materials";
      default: return "workers";
    }
  };

  const [resourceTypeTab, setResourceTypeTab] = useState<string>(() => 
    resource ? getTabFromType(resource.type) : "workers"
  );

  const [formData, setFormData] = useState({
    name: "",
    type: resource?.type || "human",
    discipline: "general",
    availability: 100,
    availabilityStatus: "available",
    rate: "",
    rateType: "per-hour",
    unitType: "hr",
    currency: "USD",
    description: "",
    notes: "",
    contractType: "",
    vendorName: "",
    vendorContactEmail: "",
    vendorContactPhone: "",
    contractStartDate: "",
    contractEndDate: "",
    contractReference: "",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    efficiencyRating: "1.0",
    productivityFactor: "1.0",
    qualityScore: "",
  });

  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCertification, setNewCertification] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [pricingModels, setPricingModels] = useState<PricingModel[]>([]);
  const [calendarExceptions, setCalendarExceptions] = useState<CalendarException[]>([]);

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name,
        type: resource.type,
        discipline: resource.discipline || "general",
        availability: resource.availability,
        availabilityStatus: resource.availabilityStatus || "available",
        rate: resource.rate || "",
        rateType: resource.rateType || "per-hour",
        unitType: resource.unitType || "hr",
        currency: resource.currency || "USD",
        description: resource.description || "",
        notes: resource.notes || "",
        contractType: resource.contractType || "",
        vendorName: resource.vendorName || "",
        vendorContactEmail: resource.vendorContactEmail || "",
        vendorContactPhone: resource.vendorContactPhone || "",
        contractStartDate: resource.contractStartDate ? new Date(resource.contractStartDate).toISOString().split("T")[0] : "",
        contractEndDate: resource.contractEndDate ? new Date(resource.contractEndDate).toISOString().split("T")[0] : "",
        contractReference: resource.contractReference || "",
        maxHoursPerDay: resource.maxHoursPerDay || 8,
        maxHoursPerWeek: resource.maxHoursPerWeek || 40,
        efficiencyRating: resource.efficiencyRating || "1.0",
        productivityFactor: resource.productivityFactor || "1.0",
        qualityScore: resource.qualityScore?.toString() || "",
      });

      const resourceSkills = (resource.skillsArray as string[] | null) || 
        (resource.skills?.split(",").map(s => s.trim()).filter(Boolean) || []);
      setSkills(resourceSkills);
      
      setCertifications((resource.certifications as string[] | null) || []);
      setWorkingDays((resource.workingDays as string[] | null) || ["monday", "tuesday", "wednesday", "thursday", "friday"]);
      setPricingModels((resource.pricingModels as PricingModel[] | null) || []);
      setCalendarExceptions((resource.calendarExceptions as CalendarException[] | null) || []);
    } else {
      resetForm();
    }
  }, [resource, open]);

  const resetForm = () => {
    setFormData({
      name: "",
      type: "human",
      discipline: "general",
      availability: 100,
      availabilityStatus: "available",
      rate: "",
      rateType: "per-hour",
      unitType: "hr",
      currency: "USD",
      description: "",
      notes: "",
      contractType: "",
      vendorName: "",
      vendorContactEmail: "",
      vendorContactPhone: "",
      contractStartDate: "",
      contractEndDate: "",
      contractReference: "",
      maxHoursPerDay: 8,
      maxHoursPerWeek: 40,
      efficiencyRating: "1.0",
      productivityFactor: "1.0",
      qualityScore: "",
    });
    setSkills([]);
    setNewSkill("");
    setCertifications([]);
    setNewCertification("");
    setWorkingDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
    setPricingModels([]);
    setCalendarExceptions([]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/resources", {
        ...data,
        projectId: selectedProjectId,
      });
      return await response.json();
    },
    onSuccess: (createdResource: Resource) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "resources"] });
      toast({ title: "Success", description: "Resource created successfully" });
      onOpenChange(false);
      onSuccess?.(createdResource);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create resource", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/resources/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "resources"] });
      toast({ title: "Success", description: "Resource updated successfully" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update resource", variant: "destructive" });
    },
  });

  const handleAddSkill = () => {
    if (newSkill.trim() && skills.length < MAX_SKILLS && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleAddCertification = () => {
    if (newCertification.trim() && !certifications.includes(newCertification.trim())) {
      setCertifications([...certifications, newCertification.trim()]);
      setNewCertification("");
    }
  };

  const handleRemoveCertification = (certToRemove: string) => {
    setCertifications(certifications.filter(c => c !== certToRemove));
  };

  const handleToggleWorkingDay = (day: string) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleAddPricingModel = () => {
    setPricingModels([...pricingModels, {
      name: `Rate ${pricingModels.length + 1}`,
      rateType: "per-hour",
      rate: 0,
      unitType: "hr",
      currency: "USD",
      isDefault: pricingModels.length === 0,
    }]);
  };

  const handleUpdatePricingModel = (index: number, updates: Partial<PricingModel>) => {
    const updated = [...pricingModels];
    updated[index] = { ...updated[index], ...updates };
    setPricingModels(updated);
  };

  const handleRemovePricingModel = (index: number) => {
    setPricingModels(pricingModels.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Resource name is required", variant: "destructive" });
      return;
    }

    // Helper to convert date string to ISO or null
    const normalizeDate = (dateStr: string): string | null => {
      if (!dateStr || dateStr.trim() === '') return null;
      // If it's already in ISO format, return as is, otherwise convert
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
      } catch {
        return null;
      }
    };

    // Helper to convert string to number or null (for integer fields)
    const normalizeNumber = (value: string | number | null | undefined): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    // Helper to convert to string for decimal fields (Zod expects strings for decimal types)
    const normalizeDecimal = (value: string | number | null | undefined): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : String(num);
    };

    const data: any = {
      name: formData.name,
      type: formData.type,
      discipline: formData.discipline,
      availability: formData.availability,
      availabilityStatus: formData.availabilityStatus,
      rate: normalizeDecimal(formData.rate),
      rateType: formData.rateType,
      unitType: formData.unitType,
      currency: formData.currency,
      description: formData.description?.trim() || null,
      notes: formData.notes?.trim() || null,
      contractType: formData.contractType || null,
      vendorName: formData.vendorName?.trim() || null,
      vendorContactEmail: formData.vendorContactEmail?.trim() || null,
      vendorContactPhone: formData.vendorContactPhone?.trim() || null,
      contractStartDate: normalizeDate(formData.contractStartDate),
      contractEndDate: normalizeDate(formData.contractEndDate),
      contractReference: formData.contractReference?.trim() || null,
      maxHoursPerDay: formData.maxHoursPerDay || null,
      maxHoursPerWeek: formData.maxHoursPerWeek || null,
      efficiencyRating: normalizeDecimal(formData.efficiencyRating),
      productivityFactor: normalizeDecimal(formData.productivityFactor),
      qualityScore: formData.qualityScore ? parseInt(formData.qualityScore) : null,
      skillsArray: skills.length > 0 ? skills : null,
      skills: skills.length > 0 ? skills.join(", ") : null,
      certifications: certifications.length > 0 ? certifications : null,
      workingDays: workingDays.length > 0 ? workingDays : null,
      pricingModels: pricingModels.length > 0 ? pricingModels : null,
      calendarExceptions: calendarExceptions.length > 0 ? calendarExceptions : null,
      projectId: selectedProjectId,
    };

    // Validate using shared schema
    const result = insertResourceSchema.safeParse(data);

    if (!result.success) {
      const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
      toast({
        title: "Validation Error",
        description: "Please check the following fields:\n" + errorMessages,
        variant: "destructive",
      });
      return;
    }

    if (isEditing && resource) {
      updateMutation.mutate({ id: resource.id, data: result.data });
    } else {
      createMutation.mutate(result.data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const TypeIcon = RESOURCE_TYPES.find(t => t.value === formData.type)?.icon || User;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh]" 
        data-testid="modal-edit-resource"
        aria-describedby="edit-resource-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TypeIcon className="h-5 w-5" />
            </div>
            {isEditing ? "Edit Resource" : "Add Resource"}
          </DialogTitle>
        </DialogHeader>

        <p id="edit-resource-description" className="sr-only">
          Form to {isEditing ? "edit" : "add"} a resource
        </p>

        <ScrollArea className="h-[65vh]">
          {/* Top-level Resource Type Tabs */}
          <div className="mb-4">
            <Tabs value={resourceTypeTab} onValueChange={(value) => {
              setResourceTypeTab(value);
              const newType = getTypeFromTab(value);
              setFormData({ ...formData, type: newType });
              // Auto-set rate type based on resource type
              if (newType === "material") {
                setFormData(prev => ({ ...prev, type: newType, rateType: "per-unit" }));
              } else if (newType === "human") {
                setFormData(prev => ({ ...prev, type: newType, rateType: "per-hour" }));
              } else {
                setFormData(prev => ({ ...prev, type: newType, rateType: "per-use" }));
              }
            }}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="workers" data-testid="tab-resource-type-workers">
                  <User className="h-4 w-4 mr-2" />
                  Workers
                </TabsTrigger>
                <TabsTrigger value="services" data-testid="tab-resource-type-services">
                  <Wrench className="h-4 w-4 mr-2" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="materials" data-testid="tab-resource-type-materials">
                  <Package className="h-4 w-4 mr-2" />
                  Materials
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Bottom-level Detail Tabs */}
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className={cn(
              "grid w-full",
              formData.type === "human" ? "grid-cols-5" : "grid-cols-3"
            )}>
              <TabsTrigger value="basic" data-testid="tab-basic">Basic</TabsTrigger>
              <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
              {formData.type === "human" && (
                <TabsTrigger value="skills" data-testid="tab-skills">Skills</TabsTrigger>
              )}
              <TabsTrigger value="contract" data-testid="tab-contract">Contract</TabsTrigger>
              {formData.type === "human" && (
                <TabsTrigger value="capacity" data-testid="tab-capacity">Capacity</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="basic" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter resource name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-resource-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="p-2 rounded-md bg-muted text-sm">
                    {RESOURCE_TYPES.find(t => t.value === formData.type)?.label || "Unknown"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Change type using the tabs above
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Discipline</Label>
                  <Select value={formData.discipline} onValueChange={(v) => setFormData({ ...formData, discipline: v })}>
                    <SelectTrigger data-testid="select-discipline">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCIPLINES.map((disc) => (
                        <SelectItem key={disc.value} value={disc.value}>{disc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Availability ({formData.availability}%)</Label>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    value={formData.availability}
                    onChange={(e) => setFormData({ ...formData, availability: parseInt(e.target.value) })}
                    data-testid="input-availability"
                  />
                  <Progress value={formData.availability} className="h-2" />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.availabilityStatus} onValueChange={(v) => setFormData({ ...formData, availabilityStatus: v })}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="resize-none"
                  rows={3}
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="resize-none"
                  rows={2}
                  data-testid="input-notes"
                />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Primary Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                        data-testid="input-rate"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rate Type</Label>
                      <Select value={formData.rateType} onValueChange={(v) => setFormData({ ...formData, rateType: v })}>
                        <SelectTrigger data-testid="select-rate-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RATE_TYPES.map((rt) => (
                            <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.rateType === "per-unit" && (
                    <div className="space-y-2">
                      <Label>Unit Type</Label>
                      <Select value={formData.unitType} onValueChange={(v) => setFormData({ ...formData, unitType: v })}>
                        <SelectTrigger data-testid="select-unit-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_TYPES.map((ut) => (
                            <SelectItem key={ut.value} value={ut.value}>{ut.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Additional Pricing Models
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleAddPricingModel} data-testid="button-add-pricing-model">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {pricingModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No additional pricing models
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pricingModels.map((model, index) => (
                        <div key={index} className="p-3 rounded-lg border space-y-3" data-testid={`pricing-model-${index}`}>
                          <div className="flex items-center justify-between">
                            <Input
                              placeholder="Rate name"
                              value={model.name}
                              onChange={(e) => handleUpdatePricingModel(index, { name: e.target.value })}
                              className="w-48"
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleRemovePricingModel(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Rate"
                              value={model.rate}
                              onChange={(e) => handleUpdatePricingModel(index, { rate: parseFloat(e.target.value) || 0 })}
                            />
                            <Select value={model.rateType} onValueChange={(v) => handleUpdatePricingModel(index, { rateType: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RATE_TYPES.map((rt) => (
                                  <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={model.currency} onValueChange={(v) => handleUpdatePricingModel(index, { currency: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skills" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Skills ({skills.length}/{MAX_SKILLS})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a skill"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                      disabled={skills.length >= MAX_SKILLS}
                      data-testid="input-new-skill"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleAddSkill} 
                      disabled={skills.length >= MAX_SKILLS || !newSkill.trim()}
                      data-testid="button-add-skill"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                          {skill}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => handleRemoveSkill(skill)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a certification"
                      value={newCertification}
                      onChange={(e) => setNewCertification(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCertification())}
                      data-testid="input-new-certification"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleAddCertification} 
                      disabled={!newCertification.trim()}
                      data-testid="button-add-certification"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {certifications.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {certifications.map((cert) => (
                        <Badge key={cert} variant="outline" className="gap-1 pr-1">
                          {cert}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => handleRemoveCertification(cert)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contract" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Contract Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract Type</Label>
                      <Select value={formData.contractType} onValueChange={(v) => setFormData({ ...formData, contractType: v })}>
                        <SelectTrigger data-testid="select-contract-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTRACT_TYPES.map((ct) => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Contract Reference</Label>
                      <Input
                        placeholder="e.g., CTR-2024-001"
                        value={formData.contractReference}
                        onChange={(e) => setFormData({ ...formData, contractReference: e.target.value })}
                        data-testid="input-contract-reference"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract Start</Label>
                      <Input
                        type="date"
                        value={formData.contractStartDate}
                        onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                        data-testid="input-contract-start"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Contract End</Label>
                      <Input
                        type="date"
                        value={formData.contractEndDate}
                        onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                        data-testid="input-contract-end"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vendor Name</Label>
                    <Input
                      placeholder="Vendor company name"
                      value={formData.vendorName}
                      onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                      data-testid="input-vendor-name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        placeholder="vendor@example.com"
                        value={formData.vendorContactEmail}
                        onChange={(e) => setFormData({ ...formData, vendorContactEmail: e.target.value })}
                        data-testid="input-vendor-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={formData.vendorContactPhone}
                        onChange={(e) => setFormData({ ...formData, vendorContactPhone: e.target.value })}
                        data-testid="input-vendor-phone"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capacity" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Working Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Max Hours/Day</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={formData.maxHoursPerDay}
                        onChange={(e) => setFormData({ ...formData, maxHoursPerDay: parseInt(e.target.value) || 8 })}
                        data-testid="input-max-hours-day"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Hours/Week</Label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={formData.maxHoursPerWeek}
                        onChange={(e) => setFormData({ ...formData, maxHoursPerWeek: parseInt(e.target.value) || 40 })}
                        data-testid="input-max-hours-week"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Working Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        variant={workingDays.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => handleToggleWorkingDay(day.value)}
                        data-testid={`button-day-${day.value}`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Efficiency & Productivity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Efficiency Rating (0.5-2.0)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        value={formData.efficiencyRating}
                        onChange={(e) => setFormData({ ...formData, efficiencyRating: e.target.value })}
                        data-testid="input-efficiency"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Productivity Factor</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2.0"
                        value={formData.productivityFactor}
                        onChange={(e) => setFormData({ ...formData, productivityFactor: e.target.value })}
                        data-testid="input-productivity"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Quality Score (1-100)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.qualityScore}
                        onChange={(e) => setFormData({ ...formData, qualityScore: e.target.value })}
                        data-testid="input-quality-score"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending} data-testid="button-save-resource">
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Update" : "Create"} Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
