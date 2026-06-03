import { api } from '../lib/api';

export const b2bService = {
  // Partners
  getPartners: async () => {
    const { data } = await api.get('/partners');
    return data;
  },
  requestPartner: async (tin: string) => {
    const { data } = await api.post('/partners/request', { partnerTin: tin });
    return data;
  },
  acceptPartner: async (id: string) => {
    const { data } = await api.patch(`/partners/${id}/accept`);
    return data;
  },

  // Orders
  getMyOrders: async () => {
    const { data } = await api.get('/b2b-orders/my');
    return data;
  },
  getIncomingOrders: async () => {
    const { data } = await api.get('/b2b-orders/incoming');
    return data;
  },
  createOrder: async (orderData: any) => {
    const { data } = await api.post('/b2b-orders', orderData);
    return data;
  },
  sendOrder: async (id: string) => {
    const { data } = await api.patch(`/b2b-orders/${id}/send`);
    return data;
  },
  acceptOrder: async (id: string) => {
    const { data } = await api.patch(`/b2b-orders/${id}/accept`);
    return data;
  },

  // Mappings
  getMappings: async () => {
    const { data } = await api.get('/product-mappings');
    return data;
  },
  createMapping: async (mappingData: any) => {
    const { data } = await api.post('/product-mappings', mappingData);
    return data;
  },

  // Debts
  getMyDebts: async () => {
    const { data } = await api.get('/debts/my-debts');
    return data;
  },
  getMyClaims: async () => {
    const { data } = await api.get('/debts/my-claims');
    return data;
  },
  confirmPayment: async (paymentId: string) => {
    const { data } = await api.patch(`/debts/payments/${paymentId}/confirm`);
    return data;
  }
};
