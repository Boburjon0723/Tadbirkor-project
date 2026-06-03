import { api } from '../lib/api';

export const productsService = {
  getAll: async () => {
    const { data } = await api.get('/products');
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },

  create: async (productData: any) => {
    const { data } = await api.post('/products', productData);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  }
};

export const warehousesService = {
  getAll: async () => {
    const { data } = await api.get('/warehouses');
    return data;
  },

  getStock: async (warehouseId: string) => {
    const { data } = await api.get(`/warehouses/${warehouseId}/stock`);
    return data;
  },

  getMovements: async (warehouseId: string) => {
    const { data } = await api.get(`/warehouses/${warehouseId}/movements`);
    return data;
  },

  create: async (warehouseData: any) => {
    const { data } = await api.post('/warehouses', warehouseData);
    return data;
  }
};
