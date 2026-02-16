import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('glucomind_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);

// Glucose
export const addGlucose = (data) => api.post('/glucose', data);
export const getGlucoseLogs = (params) => api.get('/glucose', { params });
export const getLatestGlucose = () => api.get('/glucose/latest');
export const deleteGlucose = (id) => api.delete(`/glucose/${id}`);

// Insulin
export const addInsulin = (data) => api.post('/insulin', data);
export const getInsulinLogs = (params) => api.get('/insulin', { params });
export const deleteInsulin = (id) => api.delete(`/insulin/${id}`);

// Meals
export const addMeal = (data) => api.post('/meals', data);
export const getMealLogs = (params) => api.get('/meals', { params });
export const deleteMeal = (id) => api.delete(`/meals/${id}`);

// Injections
export const addInjection = (data) => api.post('/injections', data);
export const getInjectionLogs = (params) => api.get('/injections', { params });
export const getInjectionSummary = () => api.get('/injections/summary');
export const deleteInjection = (id) => api.delete(`/injections/${id}`);

// Activity
export const addActivity = (data) => api.post('/activity', data);
export const getActivityLogs = (params) => api.get('/activity', { params });
export const deleteActivity = (id) => api.delete(`/activity/${id}`);

// Wellness
export const addWellness = (data) => api.post('/wellness', data);
export const getWellnessLogs = (params) => api.get('/wellness', { params });
export const deleteWellness = (id) => api.delete(`/wellness/${id}`);

// Analytics
export const getSummary = () => api.get('/analytics/summary');
export const getGlucoseTrend = (days) => api.get('/analytics/glucose-trend', { params: { days } });
export const getDailyBreakdown = (days) => api.get('/analytics/daily-breakdown', { params: { days } });
export const getAdvancedAnalytics = () => api.get('/advanced-analytics/report');

// Prediction
export const getPrediction = () => api.post('/predict');
export const getAdvancedPrediction = (data) => api.post(`${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/advanced-predict`, data);

export default api;
