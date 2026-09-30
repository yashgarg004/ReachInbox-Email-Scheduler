import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// inject auth token on every req
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // boot user if token expires
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/'; 
    }
    return Promise.reject(err);
  }
);

// user endpoints
export const getMe = () => api.get('/auth/me').then(r => r.data);
export const logout = () => api.post('/auth/logout').then(r => r.data);

// email endpoints
export const getScheduledEmails = (page = 1, limit = 20) =>
  api.get(`/emails/scheduled?page=${page}&limit=${limit}`).then(r => r.data);

export const getSentEmails = (page = 1, limit = 20) =>
  api.get(`/emails/sent?page=${page}&limit=${limit}`).then(r => r.data);

export const searchEmails = (q: string) =>
  api.get(`/emails/search?q=${q}`).then(r => r.data);

export const getEmailStats = () => api.get('/emails/stats').then(r => r.data);

export const cancelEmail = (id: string) => api.delete(`/emails/${id}`).then(r => r.data);

export const scheduleEmail = (data: any) => api.post('/emails/schedule', data).then(r => r.data);

export const scheduleBatch = (formData: FormData) =>
  api.post('/emails/schedule-batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

// slack endpoints
export const getSlackStatus = () => api.get('/slack/status').then(r => r.data);
export const disconnectSlack = () => api.post('/slack/disconnect').then(r => r.data);

export default api;
