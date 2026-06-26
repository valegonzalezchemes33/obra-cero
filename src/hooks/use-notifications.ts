"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface AgentNotification {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface UseNotificationsReturn {
  count: number;
  notifications: AgentNotification[];
  loading: boolean;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  refetch: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);
  const dismissQueue = useRef<Set<string>>(new Set());

  const fetchViaPolling = useCallback(async () => {
    try {
      const r = await fetch("/api/agent");
      if (!r.ok) return;
      const data = await r.json();
      const actions = (data.actions || []) as AgentNotification[];
      const filtered = actions.filter((a) => !dismissQueue.current.has(a.id));
      setNotifications(filtered);
      setCount(filtered.length);
      setLoading(false);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    // Try SSE first
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("connected", () => {
        // SSE connected successfully
      });

      es.addEventListener("notifications", (event) => {
        try {
          const data = JSON.parse(event.data);
          const filtered = (data.actions || []).filter(
            (a: AgentNotification) => !dismissQueue.current.has(a.id)
          );
          setNotifications(filtered);
          setCount(data.count);
          setLoading(false);
        } catch {
          // Parse error
        }
      });

      es.onerror = () => {
        // SSE failed — fall back to polling
        es.close();
        esRef.current = null;
        pollingInterval = setInterval(fetchViaPolling, 15000);
        fetchViaPolling();
      };
    } catch {
      // EventSource not supported — fall back to polling
      pollingInterval = setInterval(fetchViaPolling, 15000);
      fetchViaPolling();
    }

    return () => {
      if (esRef.current) esRef.current.close();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [fetchViaPolling]);

  const dismiss = useCallback(async (id: string) => {
    dismissQueue.current.add(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setCount((prev) => Math.max(0, prev - 1));
    // Optimistically mark as dismissed on server
    try {
      await fetch(`/api/agent/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "resolved" }),
    });
    } catch {
      // Silently fail
    }
  }, []);

  const dismissAll = useCallback(async () => {
    const ids = notifications.map((n) => n.id);
    ids.forEach((id) => dismissQueue.current.add(id));
    setNotifications([]);
    setCount(0);
    try {
      await fetch("/api/agent/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      // Silently fail
    }
  }, [notifications]);

  const refetch = useCallback(() => {
    fetchViaPolling();
  }, [fetchViaPolling]);

  return { count, notifications, loading, dismiss, dismissAll, refetch };
}
