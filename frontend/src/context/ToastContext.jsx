import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({ add: () => {}, remove: () => {}, success: () => {}, error: () => {}, info: () => {}, warn: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const add = useCallback((msg, { type = "info", ttl = 4000 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    if (ttl > 0) setTimeout(() => remove(id), ttl);
    return id;
  }, [remove]);

  const api = useMemo(() => ({
    add,
    remove,
    success: (m, opt) => add(m, { ...(opt || {}), type: 'success' }),
    error: (m, opt) => add(m, { ...(opt || {}), type: 'error', ttl: (opt?.ttl ?? 6000) }),
    info: (m, opt) => add(m, { ...(opt || {}), type: 'info' }),
    warn: (m, opt) => add(m, { ...(opt || {}), type: 'warn' }),
    _list: toasts,
  }), [add, remove, toasts]);

  return (
    <ToastContext.Provider value={api}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

