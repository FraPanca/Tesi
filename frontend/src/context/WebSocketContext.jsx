import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || undefined;

const WebSocketContext = createContext(null);


export function WebSocketProvider({ children }) {
  // useRef, non useState: il socket e le mappe di listener non devono mai causare un re-render quando cambiano.
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map()); // presaId -> Set<callback>
  const subscribedPreseRef = useRef(new Set()); // presaId già sottoscritte lato server (evita subscribe duplicati)
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Un solo listener globale sull'evento, smistato localmente per presaId.
    socket.on('consumo:aggiornato', (dato) => {
      const callbacks = listenersRef.current.get(dato.presaId);
      if (callbacks) callbacks.forEach((cb) => cb(dato));
    });

    return () => socket.disconnect();
  }, []);

  /**
   * Iscrive `callback` agli aggiornamenti di `presaId`.
   *
   * @returns {() => void} funzione di cleanup, da richiamare in un useEffect
   */
  function subscribe(presaId, callback) {
    if (!subscribedPreseRef.current.has(presaId)) {
      socketRef.current?.emit('subscribe', presaId);
      subscribedPreseRef.current.add(presaId);
    }

    if (!listenersRef.current.has(presaId)) {
      listenersRef.current.set(presaId, new Set());
    }
    listenersRef.current.get(presaId).add(callback);

    return () => {
      listenersRef.current.get(presaId)?.delete(callback);
    };
  }

  const value = useMemo(() => ({ subscribe, isConnected }), [isConnected]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}


export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket deve essere usato dentro <WebSocketProvider>');
  return ctx;
}