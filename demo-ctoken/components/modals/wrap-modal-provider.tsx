"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { WrapModal } from "./wrap-modal";

type WrapTab = "wrap" | "unwrap";

interface WrapModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeTab: WrapTab;
  setActiveTab: (tab: WrapTab) => void;
  openWrap: () => void;
  openUnwrap: () => void;
}

const WrapModalContext = createContext<WrapModalContextType | null>(null);

export function WrapModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WrapTab>("wrap");

  const openWrap = useCallback(() => {
    setActiveTab("wrap");
    setOpen(true);
  }, []);

  const openUnwrap = useCallback(() => {
    setActiveTab("unwrap");
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, activeTab, setActiveTab, openWrap, openUnwrap }),
    [open, activeTab, openWrap, openUnwrap]
  );

  return (
    <WrapModalContext.Provider value={value}>
      {children}
      <WrapModal />
    </WrapModalContext.Provider>
  );
}

export function useWrapModal() {
  const context = useContext(WrapModalContext);
  if (!context) {
    throw new Error("useWrapModal must be used within a WrapModalProvider");
  }
  return context;
}
