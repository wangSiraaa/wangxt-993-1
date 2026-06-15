import type {
  Activity,
  Registration,
  Checkin,
  CheckinStats,
  WeatherInfo,
  ReviewData,
  User,
  RouteRiskData,
  WeatherCancelResult,
  RegisterResult,
  CancelResult,
  PointsLedger,
} from './types';

const BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body: ApiResponse<T> = await res.json();
  if (!body.success) {
    throw new Error(body.error || `请求失败: ${res.status}`);
  }
  return body.data as T;
}

export const activities = {
  list: (params?: { type?: string; status?: string; keyword?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    if (params?.keyword) query.set('keyword', params.keyword);
    return request<Activity[]>(`/activities?${query.toString()}`);
  },
  getDetail: (id: string) => request<Activity>(`/activities/${id}`),
  create: (data: Partial<Activity>) =>
    request<{ id: string }>('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: Activity['status']) =>
    request<{ id: string; status: Activity['status'] }>(`/activities/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getWeather: (id: string) => request<WeatherInfo>(`/activities/${id}/weather`),
};

export const registrations = {
  register: (activityId: string, data: Omit<Partial<Registration>, 'id' | 'activityId'> & { userId: string }) =>
    request<RegisterResult>(`/registrations/${activityId}/register`, { method: 'POST', body: JSON.stringify(data) }),
  cancel: (regId: string) =>
    request<CancelResult>(`/registrations/${regId}`, { method: 'DELETE' }),
  listByActivity: (activityId: string) =>
    request<Registration[]>(`/registrations/activity/${activityId}`),
  listByUser: (phone: string) =>
    request<Registration[]>(`/registrations/user/${phone}`),
};

export const checkins = {
  checkin: (data: { activityId: string; registrationId: string; volunteerId: string; isException?: boolean; note?: string }) =>
    request<Checkin>('/checkins', { method: 'POST', body: JSON.stringify(data) }),
  getStats: (activityId: string) =>
    request<CheckinStats>(`/checkins/activity/${activityId}/stats`),
  listByActivity: (activityId: string) =>
    request<Checkin[]>(`/checkins/activity/${activityId}/list`),
};

export const users = {
  login: (phone: string, role: User['role']) =>
    request<User>('/users/login', { method: 'POST', body: JSON.stringify({ phone, role }) }),
  getPoints: (userId: string) =>
    request<PointsLedger>(`/users/${userId}/points`),
  getInfo: (userId: string) =>
    request<User>(`/users/${userId}`),
};

export const routeRisk = {
  getRouteRisk: (activityId: string) =>
    request<RouteRiskData>(`/route-risk/${activityId}`),
  weatherCancel: (activityId: string) =>
    request<WeatherCancelResult>(`/route-risk/${activityId}/weather-cancel`, { method: 'POST' }),
};

export const review = {
  getReviewData: (activityId: string) =>
    request<ReviewData>(`/review/${activityId}`),
};
