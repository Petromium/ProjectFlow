import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  HelpCircle, 
  ChevronRight, 
  ChevronDown,
  Lightbulb, 
  Keyboard, 
  Wand2,
  BarChart3,
  AlertTriangle,
  Users,
  DollarSign,
  ClipboardList
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AIHelpPanelProps {
  onExampleClick?: (example: string) => void;
}

export function AIHelpPanel({ onExampleClick }: AIHelpPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const capabilities = [
    { icon: BarChart3, label: "Project Analytics", description: "Analyze project progress, metrics, and KPIs" },
    { icon: AlertTriangle, label: "Risk Analysis", description: "Identify, assess, and track project risks" },
    { icon: Users, label: "Resource Management", description: "Review resource allocation and availability" },
    { icon: DollarSign, label: "Cost Tracking", description: "Monitor budget, expenses, and forecasts" },
    { icon: ClipboardList, label: "Task Management", description: "Help with WBS, schedules, and dependencies" },
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
    <div className="w-64 border-l bg-muted/30 flex flex-col h-full" data-testid="ai-help-panel">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className="w-full flex items-center justify-between p-4 border-b cursor-pointer hover-elevate"
            data-testid="button-toggle-help"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Assistant Guide</span>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
            <div className="p-3 space-y-4">
              {/* Capabilities Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Capabilities</span>
                </div>
                <div className="space-y-1">
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
              </div>

              {/* Example Prompts Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try asking</span>
                </div>
                <div className="space-y-1">
                  {examplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onExampleClick?.(prompt)}
                      className="w-full text-left p-2 text-xs rounded hover-elevate border border-transparent hover:border-border transition-colors"
                      data-testid={`button-example-prompt-${index}`}
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyboard Shortcuts Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Keyboard className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Shortcuts</span>
                </div>
                <div className="space-y-1">
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
              </div>

              {/* Tips Section */}
              <div className="bg-primary/5 rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Pro Tips</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Be specific about what you want to analyze</li>
                  <li>• Ask follow-up questions for more details</li>
                  <li>• Reference specific tasks, risks, or issues by name</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
