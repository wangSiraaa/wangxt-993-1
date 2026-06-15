export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'citizen' | 'organizer' | 'volunteer';
  points: number;
  pointsFrozen: number;
  createdAt?: string;
}

export type ActivityType = 'hike' | 'bike';
export type ActivityStatus = 'open' | 'full' | 'ongoing' | 'suspended' | 'route_switched' | 'ended' | 'weather_cancelled';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RouteSegment {
  id: string;
  activityId: string;
  name: string;
  distance: number;
  capacity: number;
  supplyInfo: string;
  riskLevel: RiskLevel;
  sortOrder: number;
  currentLoad?: number;
  routeVersion: number;
}

export interface WeatherInfo {
  temperature: number;
  condition: string;
  windSpeed: number;
  humidity: number;
  warning: string | null;
  alertLevel?: 'none' | 'yellow' | 'orange' | 'red';
}

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  date: string;
  location: string;
  description: string;
  capacity: number;
  ageMin: number;
  ageMax: number;
  equipmentRequirements: string[];
  refundRule: string;
  pointsReward: number;
  status: ActivityStatus;
  weatherRiskLevel: RiskLevel;
  routeVersion: number;
  createdBy: string;
  createdAt: string;
  routeSegments: RouteSegment[];
  currentCount?: number;
  waitlistCount?: number;
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded' | 'withdrawn' | 'route_switched';
export type DepartureReady = 'pending' | 'ready' | 'blocked';

export interface TeamMember {
  id: string;
  registrationId: string;
  teamId: string;
  name: string;
  phone: string;
  age: number;
  emergencyContact: string;
  emergencyPhone: string;
  guardianName: string;
  guardianPhone: string;
  liabilitySigned: boolean;
  equipmentConfirmed: boolean;
  insuranceSigned: boolean;
  isLeader: boolean;
  checkedIn: boolean;
  withdrawn: boolean;
}

export interface TeamRegistration {
  id: string;
  activityId: string;
  leaderUserId: string;
  teamName: string;
  memberCount: number;
  status: RegistrationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
  canDepart: boolean;
  members: TeamMember[];
}

export interface Registration {
  id: string;
  activityId: string;
  userId: string;
  name: string;
  phone: string;
  age: number;
  emergencyContact: string;
  emergencyPhone: string;
  guardianName: string;
  guardianPhone: string;
  liabilitySigned: boolean;
  equipmentConfirmed: boolean;
  insuranceSigned: boolean;
  status: RegistrationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
  teamId?: string;
  isTeamLeader?: boolean;
  teamName?: string;
  departureReady: DepartureReady;
  members?: TeamMember[];
  activityName?: string;
  activityDate?: string;
  activityStatus?: ActivityStatus;
}

export interface Checkin {
  id: string;
  activityId: string;
  registrationId: string;
  teamMemberId?: string;
  volunteerId: string;
  isException: boolean;
  note: string;
  checkedInAt: string;
  memberName?: string;
}

export interface CheckinStats {
  total: number;
  checkedIn: number;
  notCheckedIn: number;
  exceptions: number;
  checkinRate: number;
  teamCount?: number;
  teamCheckedIn?: number;
}

export interface RouteRiskData {
  segments: (RouteSegment & { currentLoad: number })[];
  weather: WeatherInfo;
}

export interface WeatherCancelResult {
  refundedCount: number;
  notifiedCount: number;
}

export interface RegisterResult {
  id: string;
  status: RegistrationStatus;
  waitlistPosition?: number | null;
  message: string;
  teamId?: string;
  memberCount?: number;
}

export interface CancelResult {
  cancelled: boolean;
  promotedRegistration?: { id: string; name: string } | null;
  cancelledMembers?: number;
}

export interface PointsLedgerRecord {
  id: string;
  userId: string;
  activityId: string;
  points: number;
  reason: string;
  frozen: boolean;
  createdAt: string;
  activityName?: string;
}

export interface PointsLedger {
  total: number;
  records: PointsLedgerRecord[];
}

export interface EventLogEntry {
  id: string;
  activityId: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  detail: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface VolunteerShift {
  id: string;
  activityId: string;
  volunteerId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: 'assigned' | 'checked_in' | 'completed' | 'absent';
  volunteerName?: string;
  volunteerPhone?: string;
  createdAt: string;
}

export interface VolunteerShiftsData {
  shifts: VolunteerShift[];
  summary: { assigned: number; checkedIn: number; completed: number; absent: number; total: number };
}

export interface Withdrawal {
  id: string;
  activityId: string;
  registrationId: string;
  reason: string;
  refundAmount: number;
  refundStatus: 'pending' | 'approved' | 'rejected' | 'processed';
  adjudicatorId: string | null;
  adjudicatorNote: string;
  createdAt: string;
}

export interface DepartureListItem {
  id: string;
  name: string;
  phone: string;
  age: number;
  status: RegistrationStatus;
  teamId: string | null;
  teamName: string | null;
  isTeamLeader: boolean;
  liabilitySigned: boolean;
  equipmentConfirmed: boolean;
  insuranceSigned: boolean;
  departureReady: DepartureReady;
  guardianName: string;
  guardianPhone: string;
}

export interface DepartureListData {
  registrations: DepartureListItem[];
  teams: { id: string; teamName: string; memberCount: number; canDepart: boolean }[];
  summary: { ready: number; blocked: number; pending: number; total: number };
}

export interface RouteSwitchResult {
  newVersion: number;
  affectedCount: number;
  newSegments: RouteSegment[];
  activityStatus: ActivityStatus;
}

export interface SuspensionResult {
  status: ActivityStatus;
  frozenCount: number;
}

export interface ResumeResult {
  status: ActivityStatus;
  unfrozenCount: number;
}

export interface WithdrawResult {
  registrationId: string;
  withdrawalId: string;
  status: RegistrationStatus;
  refundStatus: string;
}

export interface WithdrawalAdjudicateResult {
  withdrawalId: string;
  refundStatus: string;
  refundAmount: number;
}

export interface TeamReduceResult {
  teamId: string;
  newMemberCount: number;
  removedNames: string[];
}

export interface ReviewData {
  activity: Activity;
  stats: {
    totalRegistrations: number;
    confirmedCount: number;
    waitlistCount: number;
    cancelledCount: number;
    refundCount: number;
    checkinRate: number;
    exceptionCount: number;
    totalPointsIssued: number;
    teamCount?: number;
    withdrawnCount: number;
    routeSwitchedCount: number;
  };
  exceptions: {
    registrationId: string;
    name: string;
    note: string;
    createdAt: string;
  }[];
  withdrawals: {
    id: string;
    registrationId: string;
    name: string;
    reason: string;
    refundAmount: number;
    refundStatus: string;
    adjudicatorNote: string;
    createdAt: string;
  }[];
  timeline: {
    time: string;
    event: string;
    detail: string;
    source: string;
  }[];
}
