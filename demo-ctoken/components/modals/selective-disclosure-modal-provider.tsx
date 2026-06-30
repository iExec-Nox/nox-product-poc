"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SelectiveDisclosureModal } from "./selective-disclosure-modal";

interface SelectiveDisclosureModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSelectiveDisclosure: () => void;
}

const SelectiveDisclosureModalContext =
  createContext<SelectiveDisclosureModalContextType | null>(null);

export function SelectiveDisclosureModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openSelectiveDisclosure = useCallback(() => {
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, openSelectiveDisclosure }),
    [open, openSelectiveDisclosure]
  );

  return (
    <SelectiveDisclosureModalContext.Provider value={value}>
      {children}
      <SelectiveDisclosureModal />
    </SelectiveDisclosureModalContext.Provider>
  );
}

export function useSelectiveDisclosureModal() {
  const context = useContext(SelectiveDisclosureModalContext);
  if (!context) {
    throw new Error(
      "useSelectiveDisclosureModal must be used within a SelectiveDisclosureModalProvider"
    );
  }
  return context;
}
