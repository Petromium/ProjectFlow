import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Image as ImageIcon } from "lucide-react";
import { useCreateMessage } from "@/hooks/useMessages";
import { useChat } from "@/hooks/useChat";
import type { InsertMessage } from "@shared/schema";

interface ChatInputProps {
  conversationId: number;
  onTyping?: (isTyping: boolean) => void;
}

export function ChatInput({ conversationId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const createMessage = useCreateMessage();
  const { sendTypingIndicator } = useChat({ conversationId });

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (value: string) => {
    setMessage(value);

    // Typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 1000);
  };

  const handleSend = async () => {
    if (!message.trim() || createMessage.isPending) return;

    const messageData: InsertMessage = {
      conversationId,
      content: message.trim(),
      type: "text",
    };

    try {
      await createMessage.mutateAsync({
        conversationId,
        data: messageData,
      });
      setMessage("");
      setIsTyping(false);
      sendTypingIndicator(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = () => {
    // TODO: Implement file upload
    console.log("File upload not yet implemented");
  };

  const handleImageUpload = () => {
    // TODO: Implement image upload
    console.log("Image upload not yet implemented");
  };

  return (
    <div className="border-t p-4 bg-background">
      <div className="flex items-end gap-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleFileUpload}
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleImageUpload}
            title="Attach image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[60px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || createMessage.isPending}
          size="icon"
          className="h-8 w-8"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

