import { createContext, useContext, useState, useCallback } from "react";

interface AIPromptContextType {
  setExamplePrompt: (prompt: string) => void;
  pendingPrompt: string | null;
  clearPendingPrompt: () => void;
}

const AIPromptContext = createContext<AIPromptContextType | undefined>(undefined);

export function AIPromptProvider({ children }: { children: React.ReactNode }) {
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const setExamplePrompt = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
  }, []);

  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  return (
    <AIPromptContext.Provider value={{ setExamplePrompt, pendingPrompt, clearPendingPrompt }}>
      {children}
    </AIPromptContext.Provider>
  );
}

export function useAIPrompt() {
  const context = useContext(AIPromptContext);
  if (context === undefined) {
    throw new Error("useAIPrompt must be used within an AIPromptProvider");
  }
  return context;
}
