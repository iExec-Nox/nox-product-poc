"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { TransferModal } from "./transfer-modal";

interface TransferModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  openTransfer: () => void;
}

const TransferModalContext = createContext<TransferModalContextType | null>(null);

export function TransferModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openTransfer = useCallback(() => {
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, openTransfer }),
    [open, openTransfer]
  );

  return (
    <TransferModalContext.Provider value={value}>
      {children}
      <TransferModal />
    </TransferModalContext.Provider>
  );
}

export function useTransferModal() {
  const context = useContext(TransferModalContext);
  if (!context) {
    throw new Error("useTransferModal must be used within a TransferModalProvider");
  }
  return context;
}
