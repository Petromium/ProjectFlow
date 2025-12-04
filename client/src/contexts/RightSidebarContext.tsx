import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface RightSidebarContextType {
  width: number;
  setWidth: (width: number) => void;
  isCollapsed: boolean;
}

const RightSidebarContext = createContext<RightSidebarContextType | undefined>(undefined);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [width, setWidthState] = useState<number>(() => {
    if (typeof window === "undefined") return 25;
    const saved = localStorage.getItem("rightSidebarWidth");
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 40) {
        return parsed;
      }
    }
    // Calculate optimal default
    const viewportWidth = window.innerWidth;
    const optimalPixels = 320;
    const percentage = (optimalPixels / viewportWidth) * 100;
    return Math.max(20, Math.min(35, percentage));
  });

  const setWidth = (newWidth: number) => {
    setWidthState(newWidth);
    if (newWidth > 3) {
      localStorage.setItem("rightSidebarWidth", newWidth.toString());
    }
  };

  const isCollapsed = width < 3;

  return (
    <RightSidebarContext.Provider value={{ width, setWidth, isCollapsed }}>
      {children}
    </RightSidebarContext.Provider>
  );
}

export function useRightSidebar() {
  const context = useContext(RightSidebarContext);
  if (context === undefined) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider");
  }
  return context;
}

