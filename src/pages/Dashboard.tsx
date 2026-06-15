import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Clock, AlertTriangle, CheckCircle, XCircle, CloudSun } from 'lucide-react';
import { activities as activityApi, registrations as regApi, checkins as checkinApi } from '@/api';
import type { Activity, CheckinStats, Registration, WeatherInfo } from '@/types';
import { useStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import WeatherAlert from '@/components/WeatherAlert';

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const { addNotification } = useStore();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [waitlist, setWaitlist] = useState<Registration[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

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

  const rate = stats?.checkinRate ?? 0;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - rate * circumference;

  const timeline = [
    { time: '08:00', event: '活动开始', detail: '志愿者集合完毕' },
    { time: '08:30', event: '签到开放', detail: '开始现场签到' },
    { time: '09:00', event: '活动出发', detail: '参与者出发' },
    { time: '10:30', event: '到达中转', detail: '补给点休息' },
    { time: '12:00', event: '活动结束', detail: '抵达终点' },
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold mb-1">{activity.name}</h1>
            <p className="text-green-300 flex items-center gap-2">
              <CloudSun className="w-4 h-4" />
              实时数据 · 每5秒自动刷新
            </p>
          </div>
          <StatusBadge status={activity.status} type="activity" />
        </div>

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
              <Clock className="w-5 h-5 text-green-300" /> 活动进度
            </h3>
            <div className="space-y-4">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    {i < timeline.length - 1 && <div className="w-0.5 h-8 bg-green-700" />}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-green-300 text-xs">{item.time}</span>
                      <span className="font-medium text-sm">{item.event}</span>
                    </div>
                    <p className="text-green-400 text-xs mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
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
                        <div className="text-sm font-medium">{reg.name}</div>
                        <div className="text-xs text-green-400">{reg.phone}</div>
                      </div>
                    </div>
                    <StatusBadge status={reg.status} type="registration" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
