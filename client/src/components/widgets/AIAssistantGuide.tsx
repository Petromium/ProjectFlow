import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bot,
  ChevronDown,
  ChevronRight,
  Lightbulb, 
  Keyboard, 
  Wand2,
  BarChart3,
  AlertTriangle,
  Users,
  DollarSign,
  ClipboardList
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAIPrompt } from "@/contexts/AIPromptContext";

export function AIAssistantGuide() {
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { setExamplePrompt } = useAIPrompt();

  const capabilities = [
    { icon: BarChart3, label: "Project Analytics", description: "Analyze progress, metrics, and KPIs" },
    { icon: AlertTriangle, label: "Risk Analysis", description: "Identify and track project risks" },
    { icon: Users, label: "Resource Management", description: "Review allocation and availability" },
    { icon: DollarSign, label: "Cost Tracking", description: "Monitor budget and expenses" },
    { icon: ClipboardList, label: "Task Management", description: "Help with WBS and schedules" },
  ];

  const examplePrompts = [
    "What are the top 5 risks in this project?",
    "Show me a summary of project status",
    "Which tasks are behind schedule?",
    "What's the current budget variance?",
    "List all open issues by priority",
    "Who are the key stakeholders?",
    "Analyze resource utilization",
    "What milestones are coming up?",
  ];

  const shortcuts = [
    { keys: ["Enter"], description: "Send message" },
    { keys: ["Shift", "Enter"], description: "New line" },
    { keys: ["⌘/Ctrl", "K"], description: "New conversation" },
  ];

  return (
    <Card data-testid="widget-ai-assistant-guide">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          AI Assistant Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Collapsible open={capabilitiesOpen} onOpenChange={setCapabilitiesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover-elevate p-1 rounded" data-testid="button-toggle-capabilities">
            {capabilitiesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Wand2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Capabilities</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {capabilities.map((cap, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded hover-elevate">
                  <cap.icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{cap.label}</p>
                    <p className="text-xs text-muted-foreground">{cap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={promptsOpen} onOpenChange={setPromptsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover-elevate p-1 rounded" data-testid="button-toggle-prompts">
            {promptsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Lightbulb className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try Asking</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {examplePrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => setExamplePrompt(prompt)}
                  className="w-full justify-start text-xs font-normal"
                  data-testid={`button-example-prompt-${index}`}
                >
                  "{prompt}"
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover-elevate p-1 rounded" data-testid="button-toggle-shortcuts">
            {shortcutsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Keyboard className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shortcuts</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between p-2">
                  <span className="text-xs text-muted-foreground">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <Badge key={keyIndex} variant="secondary" className="text-xs px-1.5 py-0">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="bg-primary/5 rounded-lg p-3 mt-3">
          <p className="text-xs font-medium mb-1">Pro Tips</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Be specific about what you want to analyze</li>
            <li>• Ask follow-up questions for more details</li>
            <li>• Reference tasks, risks, or issues by name</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
