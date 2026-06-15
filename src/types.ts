export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'citizen' | 'organizer' | 'volunteer';
  points: number;
  createdAt?: string;
}

export type ActivityType = 'hike' | 'bike';
export type ActivityStatus = 'open' | 'full' | 'ongoing' | 'ended' | 'weather_cancelled';
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
  createdBy: string;
  createdAt: string;
  routeSegments: RouteSegment[];
  currentCount?: number;
  waitlistCount?: number;
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded';

export interface TeamMember {
  id: string;
  registrationId: string;
  teamId: string;
  name: string;
  phone: string;
  age: number;
  emergencyContact: string;
  emergencyPhone: string;
  liabilitySigned: boolean;
  equipmentConfirmed: boolean;
  isLeader: boolean;
  checkedIn: boolean;
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
  liabilitySigned: boolean;
  equipmentConfirmed: boolean;
  status: RegistrationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
  teamId?: string;
  isTeamLeader?: boolean;
  teamName?: string;
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
  createdAt: string;
  activityName?: string;
}

export interface PointsLedger {
  total: number;
  records: PointsLedgerRecord[];
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
  };
  exceptions: {
    registrationId: string;
    name: string;
    note: string;
    createdAt: string;
  }[];
  timeline: {
    time: string;
    event: string;
    detail: string;
  }[];
}
