import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Clock, AlertTriangle, CheckCircle, XCircle, CloudSun, Route, ShieldCheck, ShieldX, UserX, Pause, Play, CalendarClock, Zap } from 'lucide-react';
import { activities as activityApi, registrations as regApi, checkins as checkinApi, operations } from '@/api';
import type { Activity, CheckinStats, Registration, WeatherInfo, EventLogEntry, VolunteerShiftsData, DepartureListData } from '@/types';
import { useStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WeatherAlert from '@/components/WeatherAlert';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'departure' | 'shifts' | 'log';

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, addNotification } = useStore();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [waitlist, setWaitlist] = useState<Registration[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [departureList, setDepartureList] = useState<DepartureListData | null>(null);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [volunteerShifts, setVolunteerShifts] = useState<VolunteerShiftsData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  const fetchData = useCallback(() => {
    activityApi.getDetail(id!)
      .then(setActivity)
      .catch(() => setActivity(null));

    checkinApi.getStats(id!)
      .then(setStats)
      .catch(() => setStats(null));

    activityApi.getWeather(id!)
      .then(setWeather)
      .catch(() => setWeather(null));

    regApi.listByActivity(id!)
      .then((regs) => setWaitlist(regs.filter((r) => r.status === 'waitlisted')))
      .catch(() => setWaitlist([]));

    operations.getDepartureList(id!)
      .then(setDepartureList)
      .catch(() => setDepartureList(null));

    operations.getEventLog(id!)
      .then(setEventLog)
      .catch(() => setEventLog([]));

    operations.getVolunteerShifts(id!)
      .then(setVolunteerShifts)
      .catch(() => setVolunteerShifts(null));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRouteSwitch = async () => {
    if (!activity || !currentUser) return;
    try {
      const result = await operations.routeSwitch(activity.id, currentUser.id);
      addNotification(`路线已切换为短线(v${result.newVersion})，${result.affectedCount}人受影响`);
      fetchData();
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '改线失败');
    }
  };

  const handleSuspend = async () => {
    if (!activity || !currentUser) return;
    try {
      const result = await operations.suspend(activity.id, suspendReason, currentUser.id);
      addNotification(`活动中止，${result.frozenCount}人积分冻结`);
      setShowSuspendDialog(false);
      setSuspendReason('');
      fetchData();
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '中止失败');
    }
  };

  const handleResume = async () => {
    if (!activity || !currentUser) return;
    try {
      const result = await operations.resume(activity.id, currentUser.id);
      addNotification(`活动恢复，${result.unfrozenCount}人积分解冻`);
      setShowResumeDialog(false);
      fetchData();
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '恢复失败');
    }
  };

  const handleShiftStatus = async (shiftId: string, status: 'checked_in' | 'completed' | 'absent') => {
    if (!currentUser) return;
    try {
      await operations.updateVolunteerShiftStatus(id!, shiftId, status, currentUser.id);
      addNotification(`班次状态已更新`);
      fetchData();
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '更新失败');
    }
  };

  const rate = stats?.checkinRate ?? 0;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - rate * circumference;

  const eventTypeLabels: Record<string, string> = {
    route_switch: '天气改线',
    suspended: '活动中止',
    resumed: '活动恢复',
    withdraw: '中途退赛',
    withdrawal_adjudicate: '退费裁定',
    team_reduce: '团队减员',
    waitlist_promote: '候补转正',
    volunteer_shift_add: '班次新增',
    volunteer_shift_status: '班次状态',
  };

  const shiftStatusColors: Record<string, string> = {
    assigned: 'bg-gray-100 text-gray-600',
    checked_in: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    absent: 'bg-red-100 text-red-700',
  };
  const shiftStatusLabels: Record<string, string> = {
    assigned: '待到岗',
    checked_in: '已到岗',
    completed: '已完成',
    absent: '缺席',
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: '总览', icon: <CloudSun className="w-4 h-4" /> },
    { key: 'departure', label: '可出发名单', icon: <ShieldCheck className="w-4 h-4" /> },
    { key: 'shifts', label: '志愿者班次', icon: <CalendarClock className="w-4 h-4" /> },
    { key: 'log', label: '事件记录', icon: <Clock className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-900 text-white p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-forest-700 rounded w-1/4" />
          <div className="h-64 bg-forest-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!activity) return <div className="container mx-auto px-4 py-8 text-center text-gray-400">活动不存在</div>;

  return (
    <div className="min-h-screen bg-forest-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl font-bold mb-1">{activity.name}</h1>
            <p className="text-green-300 flex items-center gap-2">
              <CloudSun className="w-4 h-4" />
              实时数据 · 每5秒自动刷新 · 路线v{activity.routeVersion}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={activity.status} type="activity" />
            {currentUser?.role === 'organizer' && activity.status === 'ongoing' && (
              <>
                <button onClick={handleRouteSwitch} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 transition-colors flex items-center gap-1">
                  <Route className="w-3.5 h-3.5" /> 天气改线
                </button>
                <button onClick={() => setShowSuspendDialog(true)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition-colors flex items-center gap-1">
                  <Pause className="w-3.5 h-3.5" /> 中止活动
                </button>
              </>
            )}
            {currentUser?.role === 'organizer' && activity.status === 'suspended' && (
              <button onClick={() => setShowResumeDialog(true)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors flex items-center gap-1">
                <Play className="w-3.5 h-3.5" /> 恢复活动
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                activeTab === tab.key ? 'bg-green-600 text-white' : 'bg-forest-800 text-green-300 hover:bg-forest-700'
              )}
            >
              {tab.icon} {tab.label}
              {tab.key === 'departure' && departureList && departureList.summary.blocked > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{departureList.summary.blocked}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-forest-800 rounded-xl p-6 text-center">
                <div className="relative w-36 h-36 mx-auto mb-4">
                  <svg className="w-36 h-36 -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                    <circle cx="80" cy="80" r="70" fill="none" stroke="#06D6A0" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-success">{Math.round(rate * 100)}%</span>
                  </div>
                </div>
                <p className="text-green-300 text-sm">签到率</p>
              </div>

              <div className="bg-forest-800 rounded-xl p-6 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-green-300 mb-4">
                  <Users className="w-5 h-5" /> 报名统计
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-green-400 text-sm">已确认</span>
                    <span className="text-3xl font-bold text-success">{stats?.checkedIn ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-yellow-400 text-sm">候补中</span>
                    <span className="text-3xl font-bold text-waitlist">{activity.waitlistCount}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-gray-400 text-sm">已取消</span>
                    <span className="text-3xl font-bold text-gray-500">{(stats?.total ?? 0) - (stats?.checkedIn ?? 0) - activity.waitlistCount}</span>
                  </div>
                  {stats?.teamCount !== undefined && stats.teamCount > 0 && (
                    <div className="flex justify-between items-end pt-2 mt-2 border-t border-green-700/50">
                      <span className="text-sky-300 text-sm">团队数</span>
                      <span className="text-2xl font-bold text-sky-400">{stats.teamCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-forest-800 rounded-xl p-6">
                <div className="flex items-center gap-2 text-green-300 mb-4">
                  <AlertTriangle className="w-5 h-5" /> 异常情况
                </div>
                <div className="text-center">
                  <span className="text-5xl font-bold text-warning">{stats?.exceptions ?? 0}</span>
                  <p className="text-green-300 text-sm mt-2">例异常签到</p>
                </div>
                <div className="mt-4 space-y-1 text-xs text-green-400">
                  <div className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 已签到: {stats?.checkedIn ?? 0}</div>
                  <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /> 未签到: {stats?.notCheckedIn ?? 0}</div>
                </div>
              </div>

              {weather && (
                <div className="bg-forest-800 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-green-300 mb-4">
                    <CloudSun className="w-5 h-5" /> 天气状态
                  </div>
                  <div className="text-center mb-3">
                    <span className="text-4xl">
                      {weather.condition === 'sunny' ? '☀️' : weather.condition === 'cloudy' ? '⛅' : weather.condition === 'rainy' ? '🌧️' : '⛈️'}
                    </span>
                    <p className="text-2xl font-bold mt-1">{weather.temperature}°C</p>
                  </div>
                  <div className="space-y-1 text-xs text-green-400">
                    <div>风速: {weather.windSpeed} km/h</div>
                    <div>预警: {weather.alertLevel === 'none' ? '无' : weather.alertLevel === 'yellow' ? '黄色' : weather.alertLevel === 'orange' ? '橙色' : '红色'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-forest-800 rounded-xl p-6">
                <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" /> 出发准备
                </h3>
                {departureList ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-900/30 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-success">{departureList.summary.ready}</p>
                      <p className="text-xs text-green-400">可出发</p>
                    </div>
                    <div className="bg-red-900/30 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-warning">{departureList.summary.blocked}</p>
                      <p className="text-xs text-red-400">被阻止</p>
                    </div>
                    <div className="bg-yellow-900/30 rounded-lg p-3 text-center">
                      <p className="text-3xl font-bold text-waitlist">{departureList.summary.pending}</p>
                      <p className="text-xs text-yellow-400">待确认</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-green-400 text-sm text-center py-4">暂无数据</p>
                )}
              </div>

              <div className="bg-forest-800 rounded-xl p-6">
                <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-yellow-400" /> 候补队列
                </h3>
                {waitlist.length === 0 ? (
                  <p className="text-green-400 text-sm text-center py-8">暂无候补人员</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {waitlist.map((reg) => (
                      <div key={reg.id} className="flex items-center justify-between p-3 bg-forest-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-waitlist/20 text-waitlist flex items-center justify-center text-sm font-bold">
                            {reg.waitlistPosition}
                          </span>
                          <div>
                            <div className="text-sm font-medium">
                              {reg.name}
                              {reg.teamName && (
                                <span className="ml-1.5 text-xs text-green-400">[{reg.teamName}]</span>
                              )}
                            </div>
                            <div className="text-xs text-green-400 flex items-center gap-2">
                              {reg.phone}
                              {!reg.equipmentConfirmed && <span className="text-red-400">装备✗</span>}
                              {!reg.insuranceSigned && <span className="text-red-400">保险✗</span>}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={reg.status} type="registration" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'departure' && departureList && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-900/30 rounded-xl p-4 text-center">
                <ShieldCheck className="w-6 h-6 text-success mx-auto mb-1" />
                <p className="text-3xl font-bold text-success">{departureList.summary.ready}</p>
                <p className="text-sm text-green-400">可出发</p>
              </div>
              <div className="bg-red-900/30 rounded-xl p-4 text-center">
                <ShieldX className="w-6 h-6 text-warning mx-auto mb-1" />
                <p className="text-3xl font-bold text-warning">{departureList.summary.blocked}</p>
                <p className="text-sm text-red-400">被阻止</p>
              </div>
              <div className="bg-yellow-900/30 rounded-xl p-4 text-center">
                <Clock className="w-6 h-6 text-waitlist mx-auto mb-1" />
                <p className="text-3xl font-bold text-waitlist">{departureList.summary.pending}</p>
                <p className="text-sm text-yellow-400">待确认</p>
              </div>
            </div>
            <div className="bg-forest-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-700/50">
                      <th className="text-left py-3 px-4 text-green-300 font-medium">姓名</th>
                      <th className="text-left py-3 px-4 text-green-300 font-medium">团队</th>
                      <th className="text-center py-3 px-4 text-green-300 font-medium">免责</th>
                      <th className="text-center py-3 px-4 text-green-300 font-medium">装备</th>
                      <th className="text-center py-3 px-4 text-green-300 font-medium">保险</th>
                      <th className="text-center py-3 px-4 text-green-300 font-medium">监护人</th>
                      <th className="text-center py-3 px-4 text-green-300 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departureList.registrations.map((reg) => (
                      <tr key={reg.id} className={cn('border-b border-green-800/30', reg.departureReady === 'blocked' ? 'bg-red-900/10' : reg.departureReady === 'ready' ? 'bg-green-900/10' : '')}>
                        <td className="py-3 px-4 font-medium">{reg.name}{reg.isTeamLeader && <span className="text-yellow-400 text-xs ml-1">队长</span>}</td>
                        <td className="py-3 px-4 text-green-400">{reg.teamName || '—'}</td>
                        <td className="py-3 px-4 text-center">{reg.liabilitySigned ? <CheckCircle className="w-4 h-4 text-success mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                        <td className="py-3 px-4 text-center">{reg.equipmentConfirmed ? <CheckCircle className="w-4 h-4 text-success mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                        <td className="py-3 px-4 text-center">{reg.insuranceSigned ? <CheckCircle className="w-4 h-4 text-success mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</td>
                        <td className="py-3 px-4 text-center text-xs">{reg.age < 18 ? (reg.guardianName ? <span className="text-success">{reg.guardianName}</span> : <span className="text-red-400">缺失</span>) : '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            reg.departureReady === 'ready' ? 'bg-green-600/20 text-success' :
                            reg.departureReady === 'blocked' ? 'bg-red-600/20 text-warning' :
                            'bg-yellow-600/20 text-waitlist')}>
                            {reg.departureReady === 'ready' ? '可出发' : reg.departureReady === 'blocked' ? '被阻止' : '待确认'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {departureList.teams.length > 0 && (
              <div className="bg-forest-800 rounded-xl p-4">
                <h3 className="font-serif text-base font-semibold mb-3 text-green-300">团队出发状态</h3>
                <div className="space-y-2">
                  {departureList.teams.map((team) => (
                    <div key={team.id} className="flex items-center justify-between p-3 bg-forest-700/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-400" />
                        <span className="font-medium">{team.teamName}</span>
                        <span className="text-green-400 text-xs">{team.memberCount}人</span>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', team.canDepart ? 'bg-green-600/20 text-success' : 'bg-red-600/20 text-warning')}>
                        {team.canDepart ? '可出发' : '无法出发'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'shifts' && volunteerShifts && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: '待到岗', count: volunteerShifts.summary.assigned, color: 'text-gray-400', bg: 'bg-gray-900/30' },
                { label: '已到岗', count: volunteerShifts.summary.checkedIn, color: 'text-success', bg: 'bg-green-900/30' },
                { label: '已完成', count: volunteerShifts.summary.completed, color: 'text-blue-400', bg: 'bg-blue-900/30' },
                { label: '缺席', count: volunteerShifts.summary.absent, color: 'text-warning', bg: 'bg-red-900/30' },
              ].map((s) => (
                <div key={s.label} className={cn('rounded-xl p-4 text-center', s.bg)}>
                  <p className={cn('text-3xl font-bold', s.color)}>{s.count}</p>
                  <p className="text-xs text-green-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-forest-800 rounded-xl p-4">
              <div className="space-y-3">
                {volunteerShifts.shifts.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-forest-700/30 rounded-lg">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {shift.shiftName}
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', shiftStatusColors[shift.status])}>{shiftStatusLabels[shift.status]}</span>
                      </div>
                      <div className="text-xs text-green-400 mt-1">
                        {shift.volunteerName} · {shift.startTime.replace('T', ' ')} ~ {shift.endTime.replace('T', ' ')}
                      </div>
                    </div>
                    {currentUser?.role === 'organizer' && (
                      <div className="flex gap-2">
                        {shift.status === 'assigned' && (
                          <button onClick={() => handleShiftStatus(shift.id, 'checked_in')} className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-700 transition-colors">到岗</button>
                        )}
                        {shift.status === 'checked_in' && (
                          <button onClick={() => handleShiftStatus(shift.id, 'completed')} className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 transition-colors">完成</button>
                        )}
                        {(shift.status === 'assigned' || shift.status === 'checked_in') && (
                          <button onClick={() => handleShiftStatus(shift.id, 'absent')} className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 transition-colors">缺席</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="bg-forest-800 rounded-xl p-6">
            <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-300" /> 事件记录
            </h3>
            {eventLog.length === 0 ? (
              <p className="text-green-400 text-sm text-center py-8">暂无事件记录</p>
            ) : (
              <div className="space-y-0">
                {eventLog.map((entry, i) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn('w-3 h-3 rounded-full',
                        entry.eventType === 'route_switch' ? 'bg-orange-400' :
                        entry.eventType === 'suspended' ? 'bg-red-400' :
                        entry.eventType === 'resumed' ? 'bg-green-400' :
                        entry.eventType === 'withdraw' ? 'bg-yellow-400' :
                        entry.eventType === 'withdrawal_adjudicate' ? 'bg-purple-400' :
                        entry.eventType === 'team_reduce' ? 'bg-cyan-400' :
                        entry.eventType === 'waitlist_promote' ? 'bg-emerald-400' :
                        'bg-green-400'
                      )} />
                      {i < eventLog.length - 1 && <div className="w-0.5 h-12 bg-green-700/50" />}
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-earth-400">{new Date(entry.createdAt).toLocaleString('zh-CN')}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded',
                          entry.eventType === 'route_switch' ? 'bg-orange-400/20 text-orange-300' :
                          entry.eventType === 'suspended' ? 'bg-red-400/20 text-red-300' :
                          entry.eventType === 'resumed' ? 'bg-green-400/20 text-green-300' :
                          entry.eventType === 'withdraw' ? 'bg-yellow-400/20 text-yellow-300' :
                          'bg-green-400/20 text-green-300'
                        )}>
                          {eventTypeLabels[entry.eventType] || entry.eventType}
                        </span>
                        {entry.actorRole && <span className="text-[10px] text-green-500">{entry.actorRole === 'organizer' ? '组织者' : entry.actorRole === 'system' ? '系统' : '市民'}</span>}
                      </div>
                      <p className="text-green-200 text-sm mt-0.5">{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showSuspendDialog && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in">
              <h3 className="font-serif text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                <Pause className="w-5 h-5" /> 确认中止活动
              </h3>
              <p className="text-gray-600 text-sm mb-4">中止后所有已签到人员积分将冻结，活动暂停。</p>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm mb-4"
                placeholder="中止原因（如：异常天气）..."
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowSuspendDialog(false)} className="greenway-btn-outline">取消</button>
                <button onClick={handleSuspend} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium">确认中止</button>
              </div>
            </div>
          </div>
        )}

        {showResumeDialog && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in">
              <h3 className="font-serif text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" /> 确认恢复活动
              </h3>
              <p className="text-gray-600 text-sm mb-4">恢复后冻结积分将解冻，活动继续进行。</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowResumeDialog(false)} className="greenway-btn-outline">取消</button>
                <button onClick={handleResume} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium">确认恢复</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
