import { api } from "@/lib/api";

export const partnersService = {
  async getPartners() {
    const { data } = await api.get("/partners");
    return data;
  },

  async searchCompanyByTin(tin: string) {
    const { data } = await api.get(`/partners/search-company/${tin}`);
    return data;
  },

  async sendRequest(partnerCompanyId: string) {
    const { data } = await api.post("/partners/request", { partnerCompanyId });
    return data;
  },

  async acceptRequest(id: string) {
    const { data } = await api.patch(`/partners/${id}/accept`);
    return data;
  },

  async rejectRequest(id: string) {
    const { data } = await api.patch(`/partners/${id}/reject`);
    return data;
  },

  async blockPartner(id: string) {
    const { data } = await api.patch(`/partners/${id}/block`);
    return data;
  },

  async removePartner(id: string) {
    const { data } = await api.delete(`/partners/${id}`);
    return data;
  },

  async updateWarehouseVisibility(id: string, dto: { allVisible: boolean; warehouseIds?: string[] }) {
    const { data } = await api.patch(`/partners/${id}/warehouse-visibility`, dto);
    return data;
  },
};
