import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Award, Clock, Calendar, MapPin, Mountain, Bike, XCircle, ChevronRight } from 'lucide-react';
import { registrations as regApi, users as userApi } from '@/api';
import type { Registration } from '@/types';
import { useStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export default function Profile() {
  const { currentUser, addNotification } = useStore();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    regApi.listByUser(currentUser.phone)
      .then(setRegistrations)
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));

    userApi.getPoints(currentUser.id)
      .then((res) => setPoints(res.total))
      .catch(() => setPoints(currentUser.points));
  }, [currentUser]);

  const handleCancel = async (reg: Registration) => {
    try {
      await regApi.cancel(reg.id);
      setRegistrations((prev) => prev.map((r) => r.id === reg.id ? { ...r, status: 'cancelled' as const, waitlistPosition: null } : r));
      addNotification('已取消报名');
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '取消失败');
    }
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="font-serif text-xl font-semibold text-gray-400 mb-2">请先登录</h2>
        <button onClick={() => useStore.getState().login('13800138000', 'citizen')} className="greenway-btn-primary">
          快速登录
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="greenway-card p-6 mb-8 bg-gradient-to-r from-forest-600 to-forest-800 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-serif font-bold">
            {currentUser.name[0]}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold">{currentUser.name}</h1>
            <p className="text-green-200 text-sm">{currentUser.phone} · {currentUser.role === 'citizen' ? '市民' : currentUser.role === 'organizer' ? '组织者' : '志愿者'}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-300" />
              <span className="text-3xl font-bold">{points}</span>
            </div>
            <p className="text-green-200 text-sm">积分余额</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold text-forest-800 mb-4">我的报名</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="greenway-card p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div className="greenway-card p-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>暂无报名记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <div key={reg.id} className="greenway-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => reg.activityId && navigate(`/activity/${reg.activityId}`)}>
                    <div className="w-10 h-10 rounded-full bg-forest-50 flex items-center justify-center">
                      <Mountain className="w-5 h-5 text-forest-500" />
                    </div>
                    <div>
                      <div className="font-medium text-forest-800 text-sm flex items-center gap-2">
                        活动 {reg.activityId.slice(0, 8)}
                        <StatusBadge status={reg.status} type="registration" />
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                        <span>报名人：{reg.name}</span>
                        {reg.waitlistPosition && <span className="text-waitlist flex items-center gap-1"><Clock className="w-3 h-3" />候补第{reg.waitlistPosition}位</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(reg.status === 'confirmed' || reg.status === 'waitlisted') && (
                      <button onClick={() => handleCancel(reg)} className="flex items-center gap-1 text-xs text-warning hover:text-red-600 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> 取消
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
