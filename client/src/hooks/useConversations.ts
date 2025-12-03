import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation, InsertConversation } from "@shared/schema";

export function useConversations() {
  return useQuery({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/chat/conversations");
      return (await response.json()) as Conversation[];
    },
  });
}

export function useConversation(id: number | null) {
  return useQuery({
    queryKey: ["/api/chat/conversations", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiRequest("GET", `/api/chat/conversations/${id}`);
      return (await response.json()) as Conversation;
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertConversation & { participantIds?: string[] }) => {
      const response = await apiRequest("POST", "/api/chat/conversations", data);
      return (await response.json()) as Conversation;
    },
    onSuccess: (conversation, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      // Invalidate task-specific conversation query if this is a task conversation
      if (variables.taskId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations/task", variables.taskId] });
      }
      // Invalidate project-specific conversation query if this is a project conversation
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations/project", variables.projectId] });
      }
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertConversation> }) => {
      const response = await apiRequest("PATCH", `/api/chat/conversations/${id}`, data);
      return (await response.json()) as Conversation;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", variables.id] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/chat/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
  });
}

export function useProjectConversations(projectId: number | null) {
  return useQuery({
    queryKey: ["/api/chat/conversations/project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await apiRequest("GET", `/api/chat/conversations/project/${projectId}`);
      return (await response.json()) as Conversation[];
    },
    enabled: !!projectId,
  });
}

export function useTaskConversation(taskId: number | null) {
  return useQuery({
    queryKey: ["/api/chat/conversations/task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const response = await apiRequest("GET", `/api/chat/conversations/task/${taskId}`);
      const data = await response.json();
      return data as Conversation | null;
    },
    enabled: !!taskId,
  });
}

