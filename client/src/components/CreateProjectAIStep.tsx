import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, Loader2, ArrowLeft, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { AIFileAttachment, type AttachmentFile, prepareAttachmentsForMessage } from "@/components/ai/AIFileAttachment";
import { AIMentionInput } from "@/components/ai/AIMentionInput";
import { AIActionPreviewModal, type ActionPreview } from "@/components/AIActionPreviewModal";
import { useLocation } from "wouter";
import type { AiConversation, AiMessage } from "@shared/schema";

interface CreateProjectAIStepProps {
  organizationId: number;
  onBack: () => void;
  onCancel: () => void;
  onProjectCreated: (projectId: number) => void;
}

export function CreateProjectAIStep({ organizationId, onBack, onCancel, onProjectCreated }: CreateProjectAIStepProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [pendingPreview, setPendingPreview] = useState<{ preview: ActionPreview; functionName: string; args: any } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create a temporary conversation for project creation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/conversations", {
        title: "Create New Project",
        // Don't send projectId - it's optional and we don't have a project yet
      });
      return res.json();
    },
    onSuccess: (data: AiConversation) => {
      setConversationId(data.id);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Initialize conversation on mount
  useEffect(() => {
    if (!conversationId) {
      createConversationMutation.mutate();
    }
  }, []);

  // Fetch messages for the conversation
  const { data: messages = [], refetch: refetchMessages } = useQuery<AiMessage[]>({
    queryKey: conversationId ? [`/api/ai/conversations/${conversationId}/messages`] : ['__disabled__'],
    enabled: !!conversationId,
    retry: 1,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!conversationId) throw new Error("No conversation initialized");
      
      const attachmentsData = await prepareAttachmentsForMessage(attachments);
      
      const response = await apiRequest("POST", "/api/ai/chat", {
        conversationId,
        message,
        attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
        context: {
          currentPage: "create-project-ai",
          modelName: "gemini-2.5-pro", // Use Pro for project creation
          organizationId: organizationId, // Pass organizationId so AI doesn't need to ask
        },
      });
      return response.json();
    },
    onSuccess: async (data) => {
      // Clear input and attachments
      setMessageInput("");
      setAttachments([]);
      
      // Refetch messages
      await refetchMessages();
      
      // Check for function calls that need preview
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const funcCall of data.functionCalls) {
          if (funcCall.name === "create_project_from_ai") {
            try {
              const previewData = JSON.parse(funcCall.result);
              if (previewData.preview) {
                setPendingPreview({
                  preview: previewData.preview,
                  functionName: funcCall.name,
                  args: funcCall.args,
                });
              }
            } catch (e) {
              console.error("Failed to parse preview:", e);
            }
          }
        }
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Execute action mutation
  const executeActionMutation = useMutation({
    mutationFn: async ({ functionName, args }: { functionName: string; args: any }) => {
      const response = await apiRequest("POST", "/api/ai/execute-action", {
        functionName,
        args: {
          ...args,
          organizationId,
          previewMode: false, // Execute for real
        },
      });
      return response.json();
    },
    onSuccess: async (data) => {
      setPendingPreview(null);
      
      if (data.project?.id) {
        toast({ title: "Success", description: "Project created successfully!" });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        onProjectCreated(data.project.id);
      } else if (data.summary?.projectId) {
        toast({ title: "Success", description: `Project created with ${data.summary.tasksCreated} tasks and ${data.summary.risksCreated} risks!` });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        onProjectCreated(data.summary.projectId);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || sendMessageMutation.isPending) return;
    
    sendMessageMutation.mutate(messageInput.trim());
  };


  if (!conversationId) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6 py-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create Project with AI</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Describe your project and I'll help you create a comprehensive project structure with tasks, risks, and milestones.
              You can attach files with specifications, requirements, or contracts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <Card className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                  <div className="p-3">
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </Card>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {sendMessageMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <Card>
                  <div className="p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 space-y-3">
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div>
            <AIFileAttachment
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              disabled={sendMessageMutation.isPending}
            />
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
          <AIFileAttachment
            attachments={[]}
            onAttachmentsChange={(newFiles) => setAttachments(prev => [...prev, ...newFiles])}
            disabled={sendMessageMutation.isPending}
          />
          <AIMentionInput
            value={messageInput}
            onChange={setMessageInput}
            placeholder="Describe your project... (e.g., 'Create a 100MW solar power plant project')"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sendMessageMutation.isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!messageInput.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* Action Preview Modal */}
      {pendingPreview && (
        <AIActionPreviewModal
          open={!!pendingPreview}
          onOpenChange={(open) => {
            if (!open) setPendingPreview(null);
          }}
          preview={pendingPreview.preview}
          functionName={pendingPreview.functionName}
          args={pendingPreview.args}
          onApproved={() => {
            setPendingPreview(null);
          }}
        />
      )}
    </div>
  );
}

