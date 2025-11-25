import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { 
  ClipboardList, 
  AlertTriangle, 
  AlertCircle, 
  Users,
  DollarSign,
  Loader2
} from "lucide-react";

interface MentionItem {
  id: string;
  type: "task" | "risk" | "issue" | "stakeholder" | "cost";
  name: string;
  code?: string;
  description?: string;
}

interface AIMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function AIMentionInput({
  value,
  onChange,
  onKeyDown,
  disabled = false,
  placeholder = "Type @ to mention...",
  className = "",
}: AIMentionInputProps) {
  const { selectedProjectId } = useProject();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: selectedProjectId ? [`/api/projects/${selectedProjectId}/tasks`] : ["__disabled__"],
    enabled: !!selectedProjectId && showMentions,
  });

  const { data: risks = [] } = useQuery<any[]>({
    queryKey: selectedProjectId ? [`/api/projects/${selectedProjectId}/risks`] : ["__disabled__"],
    enabled: !!selectedProjectId && showMentions,
  });

  const { data: issues = [] } = useQuery<any[]>({
    queryKey: selectedProjectId ? [`/api/projects/${selectedProjectId}/issues`] : ["__disabled__"],
    enabled: !!selectedProjectId && showMentions,
  });

  const { data: stakeholders = [] } = useQuery<any[]>({
    queryKey: selectedProjectId ? [`/api/projects/${selectedProjectId}/stakeholders`] : ["__disabled__"],
    enabled: !!selectedProjectId && showMentions,
  });

  const mentionItems: MentionItem[] = [
    ...tasks.map((t: any) => ({
      id: `task-${t.id}`,
      type: "task" as const,
      name: t.name,
      code: t.wbsCode,
      description: t.description?.substring(0, 50),
    })),
    ...risks.map((r: any) => ({
      id: `risk-${r.id}`,
      type: "risk" as const,
      name: r.title,
      code: r.code,
      description: r.description?.substring(0, 50),
    })),
    ...issues.map((i: any) => ({
      id: `issue-${i.id}`,
      type: "issue" as const,
      name: i.title,
      code: i.code,
      description: i.description?.substring(0, 50),
    })),
    ...stakeholders.map((s: any) => ({
      id: `stakeholder-${s.id}`,
      type: "stakeholder" as const,
      name: s.name,
      description: s.role || s.organization,
    })),
  ];

  const filteredItems = mentionItems.filter((item) => {
    const query = mentionQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.code?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }).slice(0, 10);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setSelectedIndex(0);
        return;
      }
    }

    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  };

  const insertMention = useCallback((item: MentionItem) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.substring(0, mentionStartIndex);
    const afterMention = value.substring(mentionStartIndex + mentionQuery.length + 1);
    const mentionText = `@${item.type}:${item.code || item.name}`;
    
    onChange(beforeMention + mentionText + " " + afterMention);
    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [mentionStartIndex, mentionQuery, value, onChange]);

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredItems[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    onKeyDown?.(e);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTypeIcon = (type: MentionItem["type"]) => {
    switch (type) {
      case "task":
        return ClipboardList;
      case "risk":
        return AlertTriangle;
      case "issue":
        return AlertCircle;
      case "stakeholder":
        return Users;
      case "cost":
        return DollarSign;
    }
  };

  const getTypeColor = (type: MentionItem["type"]) => {
    switch (type) {
      case "task":
        return "text-blue-500";
      case "risk":
        return "text-orange-500";
      case "issue":
        return "text-red-500";
      case "stakeholder":
        return "text-green-500";
      case "cost":
        return "text-purple-500";
    }
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDownInternal}
        disabled={disabled}
        placeholder={placeholder}
        className={`min-h-[60px] resize-none ${className}`}
        data-testid="input-message-mention"
      />

      {showMentions && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-hidden"
          data-testid="mention-dropdown"
        >
          <div className="p-2 border-b bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Type to search tasks, risks, issues, or stakeholders
            </p>
          </div>
          <ScrollArea className="max-h-48">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                {mentionQuery ? "No matches found" : "Loading..."}
              </div>
            ) : (
              <div className="py-1">
                {filteredItems.map((item, index) => {
                  const Icon = getTypeIcon(item.type);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent ${
                        index === selectedIndex ? "bg-accent" : ""
                      }`}
                      onClick={() => insertMention(item)}
                      data-testid={`mention-item-${item.id}`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${getTypeColor(item.type)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.code && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.code}
                            </span>
                          )}
                          <span className="text-sm truncate">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {item.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
