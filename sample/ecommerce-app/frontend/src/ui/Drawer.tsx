import { useCallback, useEffect, useId, useRef, type PropsWithChildren } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** id for the heading element so consumers can match `aria-labelledby`. */
  headingId?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Accessible side-drawer dialog with focus trap + Esc-to-close + restore focus.
 */
export function Drawer({
  open,
  onClose,
  title,
  headingId,
  children,
}: PropsWithChildren<Props>) {
  const generatedId = useId();
  const labelId = headingId ?? `drawer-${generatedId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const initial = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl motion-safe:transition-transform"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id={labelId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-acme-gray hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
