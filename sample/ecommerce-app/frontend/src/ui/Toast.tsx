import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

type Toast = { id: number; message: string; tone: 'info' | 'error' | 'success' };

interface ToastApi {
  show: (message: string, tone?: Toast['tone']) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback<ToastApi['show']>((message, tone = 'info') => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ pointerEvents: 'none' }}
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            style={{ pointerEvents: 'auto' }}
            className={`pointer-events-auto rounded px-4 py-2 text-sm shadow-md ${
              t.tone === 'error'
                ? 'bg-red-600 text-white'
                : t.tone === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-acme-gray text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // Fallback no-op so feature code can call useToast() outside the provider in tests.
  return ctx ?? { show: () => undefined };
}
