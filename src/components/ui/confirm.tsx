"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as destructive (red) instead of primary. */
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Mounted once in the app shell. Gives every client component a
 * promise-based confirm() for destructive actions (delete, reject, reset)
 * that today just submit a form with no client-side confirmation step.
 * Only one confirm dialog can be open at a time by design — a second
 * confirm() call while one is pending replaces it rather than stacking.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title} onClose={() => settle(false)} size="sm" closeOnBackdrop={false}>
          <div className="flex flex-col gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">{options.message}</div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => settle(false)}>
                {options.cancelText ?? "Cancel"}
              </Button>
              <Button variant={options.danger ? "danger" : "primary"} size="sm" onClick={() => settle(true)}>
                {options.confirmText ?? "Confirm"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

/** Returns a confirm(options) function resolving true/false once the user picks. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
