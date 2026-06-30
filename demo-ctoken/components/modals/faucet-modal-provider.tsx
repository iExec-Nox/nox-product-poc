"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { FaucetModal } from "./faucet-modal";

interface FaucetModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const FaucetModalContext = createContext<FaucetModalContextType | null>(null);

export function FaucetModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <FaucetModalContext.Provider value={value}>
      {children}
      <FaucetModal />
    </FaucetModalContext.Provider>
  );
}

export function useFaucetModal() {
  const context = useContext(FaucetModalContext);
  if (!context) {
    throw new Error("useFaucetModal must be used within a FaucetModalProvider");
  }
  return context;
}
