import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

export interface AISettings {
  personality: "professional" | "friendly" | "technical";
  verbosity: number;
  focusAreas: string[];
  autoSuggest: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  personality: "professional",
  verbosity: 50,
  focusAreas: ["tasks", "risks", "costs", "resources"],
  autoSuggest: true,
};

const STORAGE_KEY = "ai_assistant_settings";

export function getAISettings(): AISettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load AI settings:", error);
  }
  return DEFAULT_SETTINGS;
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save AI settings:", error);
  }
}

interface AISettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChange?: (settings: AISettings) => void;
}

export function AISettingsModal({ open, onOpenChange, onSettingsChange }: AISettingsModalProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AISettings>(getAISettings);

  useEffect(() => {
    if (open) {
      setSettings(getAISettings());
    }
  }, [open]);

  const focusAreaOptions = [
    { id: "tasks", label: "Tasks & WBS" },
    { id: "risks", label: "Risk Management" },
    { id: "issues", label: "Issue Tracking" },
    { id: "costs", label: "Cost & Budget" },
    { id: "resources", label: "Resources" },
    { id: "stakeholders", label: "Stakeholders" },
    { id: "schedule", label: "Schedule & Milestones" },
  ];

  const handleFocusAreaToggle = (areaId: string) => {
    setSettings((prev) => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(areaId)
        ? prev.focusAreas.filter((a) => a !== areaId)
        : [...prev.focusAreas, areaId],
    }));
  };

  const handleSave = () => {
    saveAISettings(settings);
    onSettingsChange?.(settings);
    toast({ title: "Settings saved", description: "AI Assistant preferences updated" });
    onOpenChange(false);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-settings-dialog-title">AI Assistant Settings</DialogTitle>
          <DialogDescription data-testid="text-settings-dialog-description">
            Customize how the AI Assistant responds to your queries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Personality */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Response Style</Label>
            <RadioGroup
              value={settings.personality}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, personality: value as AISettings["personality"] }))
              }
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem
                  value="professional"
                  id="professional"
                  className="peer sr-only"
                  data-testid="radio-professional"
                />
                <Label
                  htmlFor="professional"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <span className="text-sm font-medium">Professional</span>
                  <span className="text-xs text-muted-foreground">Formal tone</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="friendly"
                  id="friendly"
                  className="peer sr-only"
                  data-testid="radio-friendly"
                />
                <Label
                  htmlFor="friendly"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <span className="text-sm font-medium">Friendly</span>
                  <span className="text-xs text-muted-foreground">Casual tone</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="technical"
                  id="technical"
                  className="peer sr-only"
                  data-testid="radio-technical"
                />
                <Label
                  htmlFor="technical"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <span className="text-sm font-medium">Technical</span>
                  <span className="text-xs text-muted-foreground">Detailed data</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Verbosity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Response Length</Label>
              <span className="text-xs text-muted-foreground">
                {settings.verbosity < 33 ? "Concise" : settings.verbosity < 66 ? "Balanced" : "Detailed"}
              </span>
            </div>
            <Slider
              value={[settings.verbosity]}
              onValueChange={([value]) => setSettings((prev) => ({ ...prev, verbosity: value }))}
              max={100}
              step={1}
              className="w-full"
              data-testid="slider-verbosity"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Brief</span>
              <span>Comprehensive</span>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Focus Areas</Label>
            <p className="text-xs text-muted-foreground">
              AI will prioritize these areas when analyzing your project
            </p>
            <div className="grid grid-cols-2 gap-2">
              {focusAreaOptions.map((area) => (
                <div key={area.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={area.id}
                    checked={settings.focusAreas.includes(area.id)}
                    onCheckedChange={() => handleFocusAreaToggle(area.id)}
                    data-testid={`checkbox-focus-${area.id}`}
                  />
                  <Label htmlFor={area.id} className="text-sm cursor-pointer">
                    {area.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-suggest */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autoSuggest"
              checked={settings.autoSuggest}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, autoSuggest: checked === true }))
              }
              data-testid="checkbox-auto-suggest"
            />
            <Label htmlFor="autoSuggest" className="text-sm cursor-pointer">
              Show follow-up suggestions after responses
            </Label>
          </div>
        </div>

        <div className="flex gap-2 justify-between">
          <Button variant="outline" onClick={handleReset} data-testid="button-reset-settings">
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-settings">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-settings">
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
