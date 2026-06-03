import { api } from '../lib/api';

export const usersService = {
  getCompanyUsers: async () => {
    const { data } = await api.get('/users/company');
    return data;
  },

  getRolesCatalog: async () => {
    const { data } = await api.get('/users/roles/catalog');
    return data;
  },

  updateMemberRole: async (
    membershipId: string,
    role: string,
    warehouseId?: string | null,
    grantPermissions?: string[],
    denyPermissions?: string[],
  ) => {
    const { data } = await api.patch(`/users/company/members/${membershipId}/role`, {
      role,
      warehouseId: warehouseId ?? null,
      grantPermissions: grantPermissions ?? [],
      denyPermissions: denyPermissions ?? [],
    });
    return data;
  },

  resetMemberPassword: async (membershipId: string, newPassword: string) => {
    const { data } = await api.patch(`/users/company/members/${membershipId}/password`, {
      newPassword,
    });
    return data;
  },

  updateMemberPhone: async (membershipId: string, phone: string) => {
    const { data } = await api.patch<{ success: boolean; phone: string; telegramUnlinked: boolean }>(
      `/users/company/members/${membershipId}/phone`,
      { phone },
    );
    return data;
  },

  removeMember: async (membershipId: string) => {
    const { data } = await api.delete(`/users/company/members/${membershipId}`);
    return data;
  },
};
