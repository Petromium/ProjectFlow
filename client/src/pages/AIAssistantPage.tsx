import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Plus, Trash2, Bot, User, Sparkles, AlertCircle, Pencil, Copy, Check, Settings as SettingsIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AiConversation, AiMessage } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { AISettingsModal, getAISettings, type AISettings } from "@/components/ai/AISettingsModal";
import { useAIPrompt } from "@/contexts/AIPromptContext";
import { AIFileAttachment, type AttachmentFile, prepareAttachmentsForMessage } from "@/components/ai/AIFileAttachment";
import { AIMentionInput } from "@/components/ai/AIMentionInput";

export default function AIAssistantPage() {
  const { selectedProjectId, selectedProject } = useProject();
  const { toast } = useToast();
  const { pendingPrompt, clearPendingPrompt } = useAIPrompt();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<number | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<AiConversation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(() => getAISettings());
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevProjectIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingPrompt) {
      setMessageInput(pendingPrompt);
      clearPendingPrompt();
    }
  }, [pendingPrompt, clearPendingPrompt]);

  // Clear selected conversation and purge cache when project changes
  useEffect(() => {
    // Purge cached data from previous project to prevent cross-project data exposure
    if (prevProjectIdRef.current && prevProjectIdRef.current !== selectedProjectId) {
      queryClient.removeQueries({ 
        queryKey: [`/api/ai/conversations/project/${prevProjectIdRef.current}`] 
      });
      // Also remove any cached messages from previous project's conversations
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/ai/conversations/') && key?.endsWith('/messages');
        }
      });
    }
    
    // Clear conversation selection
    setSelectedConversationId(null);
    
    // Update ref for next change
    prevProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  // Fetch conversations for selected project (only when project is selected)
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AiConversation[]>({
    queryKey: selectedProjectId 
      ? [`/api/ai/conversations/project/${selectedProjectId}`]
      : ['__disabled__'],
    enabled: !!selectedProjectId,
    retry: 1,
  });

  // Fetch messages for selected conversation (only when conversation is selected)
  const { data: messages = [], isLoading: messagesLoading } = useQuery<AiMessage[]>({
    queryKey: selectedConversationId
      ? [`/api/ai/conversations/${selectedConversationId}/messages`]
      : ['__disabled__'],
    enabled: !!selectedConversationId,
    retry: 1,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) {
        throw new Error("Please select a project first");
      }
      return await apiRequest("POST", "/api/ai/conversations", {
        title: "New Conversation",
        projectId: selectedProjectId,
      });
    },
    onSuccess: (newConversation: any) => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai/conversations/project/${selectedProjectId}`] });
      }
      setSelectedConversationId(newConversation.id);
      toast({ title: "Success", description: "New conversation created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedConversationId) throw new Error("No conversation selected");
      const response = await apiRequest("POST", "/api/ai/chat", {
        conversationId: selectedConversationId,
        message,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai/conversations/${selectedConversationId}/messages`] });
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai/conversations/project/${selectedProjectId}`] });
      }
      setMessageInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai/conversations/${id}`);
    },
    onSuccess: () => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai/conversations/project/${selectedProjectId}`] });
      }
      if (selectedConversationId === conversationToDelete) {
        setSelectedConversationId(null);
      }
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
      toast({ title: "Success", description: "Conversation deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Rename conversation mutation
  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      return await apiRequest("PATCH", `/api/ai/conversations/${id}`, { title });
    },
    onSuccess: () => {
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai/conversations/project/${selectedProjectId}`] });
      }
      setRenameDialogOpen(false);
      setConversationToRename(null);
      setNewTitle("");
      toast({ title: "Success", description: "Conversation renamed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId) return;
    
    let fullMessage = messageInput;
    if (attachments.length > 0) {
      const attachmentText = await prepareAttachmentsForMessage(attachments);
      fullMessage = messageInput + attachmentText;
      setAttachments([]);
    }
    
    sendMessageMutation.mutate(fullMessage);
  };

  const handleDeleteConversation = (id: number) => {
    setConversationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleRenameConversation = (conversation: AiConversation) => {
    setConversationToRename(conversation);
    setNewTitle(conversation.title || "");
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    if (!conversationToRename || !newTitle.trim()) return;
    renameConversationMutation.mutate({ id: conversationToRename.id, title: newTitle.trim() });
  };

  const handleCopyMessage = async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageIndex);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  
  // Get project name - conversations are always from the selected project
  // (filtered by selectedProjectId on backend)
  const conversationProjectName = selectedProject?.name || "No project selected";

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Conversations Sidebar */}
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" data-testid="icon-bot" />
            <h2 className="font-semibold" data-testid="text-conversations-title">AI Assistant</h2>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-ai-settings"
              title="AI Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending || !selectedProjectId}
              data-testid="button-new-conversation"
              title={!selectedProjectId ? "Please select a project first" : "Create new conversation"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {!selectedProjectId ? (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-select-project">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Please select a project to view AI conversations
              </div>
            ) : conversationsLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-loading">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-conversations">
                No conversations yet. Start a new one!
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-md cursor-pointer hover-elevate flex items-start justify-between gap-2 ${
                    selectedConversationId === conversation.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  data-testid={`conversation-item-${conversation.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate" data-testid={`text-conversation-title-${conversation.id}`}>
                        {conversation.title || "New Conversation"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameConversation(conversation);
                      }}
                      data-testid={`button-rename-conversation-${conversation.id}`}
                      title="Rename conversation"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.id);
                      }}
                      data-testid={`button-delete-conversation-${conversation.id}`}
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col">
        {!selectedConversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Sparkles className="h-16 w-16 text-primary/20 mb-4" data-testid="icon-sparkles" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-welcome-title">
              Welcome to AI Project Assistant
            </h3>
            <p className="text-muted-foreground max-w-md mb-4" data-testid="text-welcome-description">
              I can help you analyze project data, identify risks, track resources, and provide actionable insights for your EPC projects.
            </p>
            {!selectedProjectId ? (
              <Alert data-testid="alert-no-project">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select a project from the top bar to use the AI Assistant.
                </AlertDescription>
              </Alert>
            ) : (
              <Button
                onClick={() => createConversationMutation.mutate()}
                disabled={createConversationMutation.isPending}
                data-testid="button-start-conversation"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start New Conversation
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold" data-testid="text-chat-title">
                    {selectedConversation?.title || "Conversation"}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-chat-project">
                    {conversationProjectName}
                  </p>
                </div>
                {selectedConversation && (
                  <Badge variant="secondary" data-testid="badge-updated-time">
                    Last updated: {new Date(selectedConversation.updatedAt).toLocaleTimeString()}
                  </Badge>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground" data-testid="text-messages-loading">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground" data-testid="text-no-messages">
                  <Alert>
                    <AlertDescription>
                      Start the conversation by asking me anything about your project. I can analyze risks, track resources, provide insights, and help you manage your EPC project effectively.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.role}-${index}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-lg p-3 relative group ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none" data-testid={`text-message-content-${index}`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                                li: ({ children }) => <li className="mb-1">{children}</li>,
                                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                code: ({ className, children }) => {
                                  const isInline = !className;
                                  return isInline ? (
                                    <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                  ) : (
                                    <code className="block bg-background/50 p-2 rounded text-xs font-mono overflow-x-auto mb-2">{children}</code>
                                  );
                                },
                                pre: ({ children }) => <pre className="bg-background/50 p-2 rounded overflow-x-auto mb-2">{children}</pre>,
                                table: ({ children }) => <table className="border-collapse border border-border mb-2 w-full text-xs">{children}</table>,
                                th: ({ children }) => <th className="border border-border p-1 bg-background/50 font-semibold">{children}</th>,
                                td: ({ children }) => <td className="border border-border p-1">{children}</td>,
                                blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-2 italic mb-2">{children}</blockquote>,
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-content-${index}`}>
                            {message.content}
                          </p>
                        )}
                        
                        {/* Copy button for assistant messages */}
                        {message.role === 'assistant' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopyMessage(message.content, index)}
                            data-testid={`button-copy-message-${index}`}
                            title="Copy message"
                          >
                            {copiedMessageId === index ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        
                        {message.tokensUsed > 0 && message.role === 'assistant' && (
                          <div className="mt-2 text-xs opacity-70" data-testid={`text-tokens-${index}`}>
                            {message.tokensUsed} tokens
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Typing indicator */}
                  {sendMessageMutation.isPending && (
                    <div className="flex gap-3 justify-start" data-testid="typing-indicator">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="ml-2 text-sm text-muted-foreground">AI is thinking...</span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              {/* Attachment Preview */}
              {attachments.length > 0 && (
                <div className="mb-2">
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
                  placeholder="Ask me anything about your project... Use @ to mention items"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-hint">
                Press Enter to send, Shift+Enter for new line. Use @ to mention items, or click the paperclip to attach files.
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-delete-dialog-title">Delete Conversation</DialogTitle>
            <DialogDescription data-testid="text-delete-dialog-description">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => conversationToDelete && deleteConversationMutation.mutate(conversationToDelete)}
              disabled={deleteConversationMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Conversation Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-rename-dialog-title">Rename Conversation</DialogTitle>
            <DialogDescription data-testid="text-rename-dialog-description">
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Conversation name..."
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRenameSubmit();
              }
            }}
            data-testid="input-rename"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setConversationToRename(null);
                setNewTitle("");
              }}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!newTitle.trim() || renameConversationMutation.isPending}
              data-testid="button-confirm-rename"
            >
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Settings Modal */}
      <AISettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsChange={setAiSettings}
      />
    </div>
  );
}
