import { api } from '@/lib/api';

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type LeaveRequestRow = {
  id: string;
  companyUserId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string | null;
  status: LeaveRequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  companyUser: {
    user: { id: string; fullName: string; login: string };
  };
};

export type WorkMonthRow = {
  companyUserId: string;
  year: number;
  month: number;
  totalDays: number;
  workedDays: number;
  isManual: boolean;
  source?: 'auto' | 'manual' | 'default';
};

export const payrollLeaveApi = {
  async listMembers() {
    const { data } = await api.get<
      Array<{
        id: string;
        role: string;
        createdAt?: string;
        user: { id: string; fullName: string; login: string; status?: string };
        warehouse?: { id: string; name: string } | null;
      }>
    >('/payroll/members');
    return data;
  },

  async getSettings() {
    const { data } = await api.get<{ workedDaysMode: 'AUTO' | 'MANUAL' }>('/payroll/settings');
    return data;
  },

  async updateSettings(workedDaysMode: 'AUTO' | 'MANUAL') {
    const { data } = await api.patch('/payroll/settings', { workedDaysMode });
    return data;
  },

  async listLeave(params?: { status?: string; mine?: boolean }) {
    const { data } = await api.get<LeaveRequestRow[]>('/payroll/leave-requests', { params });
    return data;
  },

  async pendingCount() {
    const { data } = await api.get<{ count: number }>('/payroll/leave-requests/pending-count');
    return data;
  },

  async createLeave(payload: { daysCount: number; startDate: string; reason?: string }) {
    const { data } = await api.post('/payroll/leave-requests', payload);
    return data;
  },

  async approve(id: string, reviewNote?: string) {
    const { data } = await api.patch(`/payroll/leave-requests/${id}/approve`, {
      reviewNote,
    });
    return data;
  },

  async reject(id: string, reviewNote?: string) {
    const { data } = await api.patch(`/payroll/leave-requests/${id}/reject`, {
      reviewNote,
    });
    return data;
  },

  async getWorkMonth(companyUserId: string, year: number, month: number) {
    const { data } = await api.get<WorkMonthRow>(
      `/payroll/work-months/${companyUserId}`,
      { params: { year, month } },
    );
    return data;
  },

  async updateWorkMonth(
    companyUserId: string,
    year: number,
    month: number,
    payload: { workedDays?: number; totalDays?: number },
  ) {
    const { data } = await api.patch(
      `/payroll/work-months/${companyUserId}`,
      payload,
      { params: { year, month } },
    );
    return data;
  },

  async listApprovedLeaves(companyUserId: string, year: number, month: number) {
    const { data } = await api.get<LeaveRequestRow[]>(
      `/payroll/work-months/${companyUserId}/approved-leaves`,
      { params: { year, month } },
    );
    return data;
  },

  async listMemberLeave(companyUserId: string, year: number, month: number) {
    const { data } = await api.get<LeaveRequestRow[]>(
      `/payroll/members/${companyUserId}/leave-requests`,
      { params: { year, month } },
    );
    return data;
  },

  async getMemberProfile(companyUserId: string) {
    const { data } = await api.get<{ monthlyPaidLeaveQuota: number }>(
      `/payroll/members/${companyUserId}/profile`,
    );
    return data;
  },

  async upsertMemberProfile(companyUserId: string, monthlyPaidLeaveQuota: number) {
    const { data } = await api.patch(`/payroll/members/${companyUserId}/profile`, {
      monthlyPaidLeaveQuota,
    });
    return data;
  },

  async recordMemberLeave(
    companyUserId: string,
    payload: { daysCount: number; startDate: string; reason?: string },
  ) {
    const { data } = await api.post<LeaveRequestRow>(
      `/payroll/members/${companyUserId}/leave-requests`,
      payload,
    );
    return data;
  },
};
