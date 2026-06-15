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
  TeamMember,
  EventLogEntry,
  VolunteerShiftsData,
  DepartureListData,
  RouteSwitchResult,
  SuspensionResult,
  ResumeResult,
  WithdrawResult,
  WithdrawalAdjudicateResult,
  TeamReduceResult,
  VolunteerShift,
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
  register: (activityId: string, data: Omit<Partial<Registration>, 'id' | 'activityId'> & { userId: string; isTeam?: boolean; teamName?: string; teamMembers?: Omit<TeamMember, 'id' | 'registrationId' | 'teamId' | 'checkedIn'>[] }) =>
    request<RegisterResult>(`/registrations/${activityId}/register`, { method: 'POST', body: JSON.stringify(data) }),
  cancel: (regId: string) =>
    request<CancelResult>(`/registrations/${regId}`, { method: 'DELETE' }),
  listByActivity: (activityId: string) =>
    request<Registration[]>(`/registrations/activity/${activityId}`),
  listByUser: (phone: string) =>
    request<Registration[]>(`/registrations/user/${phone}`),
};

export const checkins = {
  checkin: (data: { activityId: string; registrationId: string; volunteerId: string; isException?: boolean; note?: string; memberName?: string }) =>
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

export const operations = {
  routeSwitch: (activityId: string, actorId?: string) =>
    request<RouteSwitchResult>(`/operations/${activityId}/route-switch`, { method: 'POST', body: JSON.stringify({ actorId }) }),
  suspend: (activityId: string, reason: string, actorId?: string) =>
    request<SuspensionResult>(`/operations/${activityId}/suspend`, { method: 'POST', body: JSON.stringify({ reason, actorId }) }),
  resume: (activityId: string, actorId?: string) =>
    request<ResumeResult>(`/operations/${activityId}/resume`, { method: 'POST', body: JSON.stringify({ actorId }) }),
  teamReduce: (activityId: string, teamId: string, memberIds: string[], actorId?: string) =>
    request<TeamReduceResult>(`/operations/${activityId}/team-reduce`, { method: 'POST', body: JSON.stringify({ teamId, memberIds, actorId }) }),
  withdraw: (activityId: string, registrationId: string, reason: string, actorId?: string, actorRole?: string) =>
    request<WithdrawResult>(`/operations/${activityId}/withdraw`, { method: 'POST', body: JSON.stringify({ registrationId, reason, actorId, actorRole }) }),
  adjudicateWithdrawal: (activityId: string, withdrawalId: string, refundStatus: string, refundAmount: number, adjudicatorId: string, adjudicatorNote?: string) =>
    request<WithdrawalAdjudicateResult>(`/operations/${activityId}/withdrawal-adjudicate`, { method: 'POST', body: JSON.stringify({ withdrawalId, refundStatus, refundAmount, adjudicatorId, adjudicatorNote }) }),
  getDepartureList: (activityId: string) =>
    request<DepartureListData>(`/operations/${activityId}/departure-list`),
  getEventLog: (activityId: string, eventType?: string) => {
    const query = eventType ? `?eventType=${eventType}` : '';
    return request<EventLogEntry[]>(`/operations/${activityId}/event-log${query}`);
  },
  getVolunteerShifts: (activityId: string) =>
    request<VolunteerShiftsData>(`/operations/${activityId}/volunteer-shifts`),
  addVolunteerShift: (activityId: string, data: { volunteerId: string; shiftName: string; startTime: string; endTime: string; actorId?: string }) =>
    request<{ id: string }>(`/operations/${activityId}/volunteer-shifts`, { method: 'POST', body: JSON.stringify(data) }),
  updateVolunteerShiftStatus: (activityId: string, shiftId: string, status: VolunteerShift['status'], actorId?: string) =>
    request<{ id: string; status: string }>(`/operations/${activityId}/volunteer-shifts/${shiftId}/status`, { method: 'PUT', body: JSON.stringify({ status, actorId }) }),
};
