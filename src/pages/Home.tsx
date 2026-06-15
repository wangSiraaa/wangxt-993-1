import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mountain, Bike, MapPin, Calendar, Users, Clock } from 'lucide-react';
import { activities as api } from '@/api';
import type { Activity } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | 'hike' | 'bike';
type StatusFilter = 'all' | Activity['status'];

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    setLoading(true);
    api.list({ type: typeFilter !== 'all' ? typeFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, keyword })
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter, keyword]);

  const filtered = activities.filter((a) => {
    if (keyword && !a.name.includes(keyword) && !a.location.includes(keyword)) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const displayList = filtered.length > 0 ? filtered : (keyword || typeFilter !== 'all' || statusFilter !== 'all' ? [] : activities);

  const typeTabs: { key: TypeFilter; label: string; icon: typeof Mountain }[] = [
    { key: 'all', label: '全部', icon: Mountain },
    { key: 'hike', label: '徒步', icon: Mountain },
    { key: 'bike', label: '骑行', icon: Bike },
  ];

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部状态' },
    { key: 'open', label: '报名中' },
    { key: 'full', label: '已满员' },
    { key: 'ongoing', label: '进行中' },
    { key: 'ended', label: '已结束' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-forest-600 mb-2">活动大厅</h1>
        <p className="text-gray-500">发现城市绿道精彩活动，开启你的绿色之旅</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索活动名称或地点..."
            className="greenway-input pl-10"
          />
        </div>
        <div className="flex gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-forest-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-green-50 border border-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {typeTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                typeFilter === tab.key
                  ? 'bg-forest-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-green-50 border border-gray-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="greenway-card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Mountain className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg">暂无匹配的活动</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayList.map((activity) => (
            <Link
              key={activity.id}
              to={`/activity/${activity.id}`}
              className="greenway-card overflow-hidden group"
            >
              <div className={cn(
                'h-2',
                activity.type === 'hike' ? 'bg-gradient-to-r from-forest-400 to-forest-600' : 'bg-gradient-to-r from-sky-400 to-sky-600'
              )} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {activity.type === 'hike' ? (
                      <Mountain className="w-5 h-5 text-forest-500" />
                    ) : (
                      <Bike className="w-5 h-5 text-sky-500" />
                    )}
                    <h3 className="font-serif text-lg font-semibold text-forest-800 group-hover:text-forest-600 transition-colors">
                      {activity.name}
                    </h3>
                  </div>
                  <StatusBadge status={activity.status} type="activity" />
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-earth-400" />
                    <span>{activity.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-earth-400" />
                    <span>{activity.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-earth-400" />
                    <span>{activity.type === 'hike' ? '徒步' : '骑行'} · 奖励 {activity.pointsReward} 积分</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-forest-400" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{activity.currentCount}/{activity.capacity}</span>
                      {activity.waitlistCount > 0 && (
                        <span className="text-waitlist">候补 {activity.waitlistCount} 人</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          activity.currentCount >= activity.capacity ? 'bg-waitlist' : 'bg-forest-400'
                        )}
                        style={{ width: `${Math.min((activity.currentCount / activity.capacity) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
