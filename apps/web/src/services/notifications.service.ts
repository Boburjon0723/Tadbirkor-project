import { api } from "@/lib/api";

export const notificationsService = {
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    scope?: "all" | "unread";
    severity?: "ALL" | "INFO" | "SUCCESS" | "WARNING" | "ERROR";
    moduleKey?: string;
  }) {
    const { data } = await api.get("/notifications", { params });
    return data;
  },

  async getUnreadCount() {
    const { data } = await api.get("/notifications/unread-count");
    return data;
  },

  async markAsRead(id: string) {
    const { data } = await api.post(`/notifications/${id}/read`);
    return data;
  },

  async markAllAsRead() {
    const { data } = await api.post("/notifications/read-all");
    return data;
  },
};
