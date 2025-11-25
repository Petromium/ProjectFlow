import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Image, FileText, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AttachmentFile {
  file: File;
  preview?: string;
  type: "image" | "text" | "other";
}

interface AIFileAttachmentProps {
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function AIFileAttachment({
  attachments,
  onAttachmentsChange,
  disabled = false,
  maxFiles = 3,
  maxSizeMB = 5,
}: AIFileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    const newAttachments: AttachmentFile[] = [];
    for (let i = 0; i < files.length; i++) {
      if (attachments.length + newAttachments.length >= maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        break;
      }

      const file = files[i];
      const sizeMB = file.size / (1024 * 1024);

      if (sizeMB > maxSizeMB) {
        setError(`File ${file.name} exceeds ${maxSizeMB}MB limit`);
        continue;
      }

      let type: AttachmentFile["type"] = "other";
      let preview: string | undefined;

      if (file.type.startsWith("image/")) {
        type = "image";
        preview = await readFileAsDataURL(file);
      } else if (
        file.type.startsWith("text/") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".json")
      ) {
        type = "text";
      }

      newAttachments.push({ file, preview, type });
    }

    onAttachmentsChange([...attachments, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getFileIcon = (type: AttachmentFile["type"]) => {
    switch (type) {
      case "image":
        return Image;
      case "text":
        return FileText;
      default:
        return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.csv,.json,.pdf"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-attachment"
      />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || attachments.length >= maxFiles}
        title={`Attach files (max ${maxFiles})`}
        data-testid="button-attach-file"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {error && (
        <p className="text-xs text-destructive" data-testid="text-attachment-error">
          {error}
        </p>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2" data-testid="attachment-list">
          {attachments.map((attachment, index) => {
            const FileIcon = getFileIcon(attachment.type);
            return (
              <div
                key={index}
                className="relative group flex items-center gap-1 bg-muted rounded-md p-1 pr-2"
                data-testid={`attachment-item-${index}`}
              >
                {attachment.type === "image" && attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center bg-background rounded">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs truncate max-w-[100px]">{attachment.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file.size)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAttachment(index)}
                  data-testid={`button-remove-attachment-${index}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export async function getAttachmentContent(attachment: AttachmentFile): Promise<string> {
  if (attachment.type === "image" && attachment.preview) {
    return `[Image attached: ${attachment.file.name}]\n\n(Image data provided as base64)`;
  }

  if (attachment.type === "text") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        resolve(`[File: ${attachment.file.name}]\n\`\`\`\n${content}\n\`\`\``);
      };
      reader.onerror = reject;
      reader.readAsText(attachment.file);
    });
  }

  return `[Attached file: ${attachment.file.name} (${attachment.file.type})]`;
}

export async function prepareAttachmentsForMessage(
  attachments: AttachmentFile[]
): Promise<string> {
  if (attachments.length === 0) return "";

  const contents = await Promise.all(attachments.map(getAttachmentContent));
  return "\n\n---\nAttached files:\n" + contents.join("\n\n");
}
