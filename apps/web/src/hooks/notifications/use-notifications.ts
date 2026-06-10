import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications.service";
import { getNotificationsSocket } from "@/lib/notifications-socket";

type NotificationItem = {
  id: string;
  isRead: boolean;
  createdAt: string;
  moduleKey?: string | null;
  [key: string]: unknown;
};

type NotificationsResponse = {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function unreadFromList(list: NotificationItem[] | undefined): number {
  if (!list?.length) return 0;
  return list.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);
}

function useNotificationSocketStatus() {
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const socket = getNotificationsSocket();
    if (!socket) return;

    setSocketConnected(socket.connected);
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return socketConnected;
}

export function useNotifications(params?: {
  page?: number;
  limit?: number;
  scope?: "all" | "unread";
  severity?: "ALL" | "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  moduleKey?: string;
}) {
  const queryClient = useQueryClient();
  const socketConnected = useNotificationSocketStatus();

  useEffect(() => {
    const socket = getNotificationsSocket();
    if (!socket) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    };

    const onNew = (notif: NotificationItem) => {
      if (!notif?.id) {
        refresh();
        return;
      }
      queryClient.setQueryData<NotificationsResponse>(
        ["notifications", params?.page || 1, params?.limit || 20, params?.scope || "all", params?.severity || "ALL", params?.moduleKey || ""],
        (prev) => {
          if (!prev) return prev;
          const filtered = prev.items.filter((n) => n.id !== notif.id);
          return { ...prev, items: [notif, ...filtered].slice(0, prev.limit) };
        },
      );
      queryClient.setQueryData<number>(["notifications-count"], (prev = 0) => prev + (notif.isRead ? 0 : 1));
    };

    const onUpdated = (payload: { id: string; isRead: boolean }) => {
      if (!payload?.id) {
        refresh();
        return;
      }
      queryClient.setQueryData<NotificationsResponse>(
        ["notifications", params?.page || 1, params?.limit || 20, params?.scope || "all", params?.severity || "ALL", params?.moduleKey || ""],
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((n) => (n.id === payload.id ? { ...n, isRead: payload.isRead } : n)),
              }
            : prev,
      );
      queryClient.setQueryData<number>(["notifications-count"], (prev = 0) => {
        const data = queryClient.getQueryData<NotificationsResponse>([
          "notifications",
          params?.page || 1,
          params?.limit || 20,
          params?.scope || "all",
          params?.severity || "ALL",
          params?.moduleKey || "",
        ]);
        if (!data?.items) return prev;
        return unreadFromList(data.items);
      });
    };

    const onAllRead = () => {
      queryClient.setQueryData<NotificationsResponse>(
        ["notifications", params?.page || 1, params?.limit || 20, params?.scope || "all", params?.severity || "ALL", params?.moduleKey || ""],
        (prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((n) => ({ ...n, isRead: true })),
              }
            : prev,
      );
      queryClient.setQueryData<number>(["notifications-count"], 0);
    };

    socket.on("notification:new", onNew);
    socket.on("notification:refresh", refresh);
    socket.on("notification:updated", onUpdated);
    socket.on("notification:all_read", onAllRead);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:refresh", refresh);
      socket.off("notification:updated", onUpdated);
      socket.off("notification:all_read", onAllRead);
    };
  }, [queryClient, params?.page, params?.limit, params?.scope, params?.severity, params?.moduleKey]);

  return useQuery({
    queryKey: ["notifications", params?.page || 1, params?.limit || 20, params?.scope || "all", params?.severity || "ALL", params?.moduleKey || ""],
    queryFn: () => notificationsService.getNotifications(params),
    // Socket ulangan bo'lsa pollingni kamaytiramiz.
    refetchInterval: socketConnected ? 5 * 60 * 1000 : 30000,
  });
}

export function useUnreadCount() {
  const socketConnected = useNotificationSocketStatus();
  return useQuery({
    queryKey: ["notifications-count"],
    queryFn: notificationsService.getUnreadCount,
    refetchInterval: socketConnected ? 5 * 60 * 1000 : 30000,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: notificationsService.markAsRead,
    onSuccess: (_resp, id) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const count = queryClient.getQueryData<number>(["notifications-count"]);
      if (typeof count === "number" && count > 0) queryClient.setQueryData<number>(["notifications-count"], count - 1);
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData<number>(["notifications-count"], 0);
    },
  });

  return {
    markAsRead,
    markAllAsRead,
  };
}

/** Sahifaga kirganda bir marta barcha o‘qilmaganlarni o‘qilgan deb belgilaydi. */
export function useMarkNotificationsReadOnPageEnter() {
  const { data: unreadCount = 0, isSuccess } = useUnreadCount();
  const { markAllAsRead } = useNotificationActions();
  const didRun = useRef(false);

  useEffect(() => {
    if (!isSuccess || didRun.current) return;
    didRun.current = true;
    if (unreadCount > 0) {
      markAllAsRead.mutate();
    }
  }, [isSuccess, unreadCount, markAllAsRead]);
}
