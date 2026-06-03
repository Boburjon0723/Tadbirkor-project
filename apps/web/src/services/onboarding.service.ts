import { api } from '../lib/api';

export const onboardingService = {
  createCompany: async (companyData: any) => {
    const { data } = await api.post('/onboarding/company', companyData);
    return data;
  },

  updateCompany: async (payload: { businessType: string }) => {
    const { data } = await api.patch('/onboarding/company', payload);
    return data;
  },

  submitAnswers: async (answers: any) => {
    const { data } = await api.post('/onboarding/business-answers', { answers });
    return data;
  },

  addTeamMember: async (memberData: any) => {
    const { data } = await api.post('/onboarding/team', memberData);
    return data;
  },

  complete: async () => {
    const { data } = await api.post('/onboarding/complete');
    return data;
  },

  getStatus: async () => {
    const { data } = await api.get('/onboarding/status');
    return data;
  }
};
