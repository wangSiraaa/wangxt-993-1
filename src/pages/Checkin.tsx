import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, CheckCircle, AlertTriangle, Users, Clock, UserCheck, X } from 'lucide-react';
import { checkins as checkinApi, registrations as regApi } from '@/api';
import type { Registration, CheckinStats } from '@/types';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, addNotification } = useStore();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [exceptionIds, setExceptionIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [exceptionNote, setExceptionNote] = useState<Record<string, string>>({});
  const [showExceptionModal, setShowExceptionModal] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    regApi.listByActivity(id!)
      .then(setRegistrations)
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));

    checkinApi.getStats(id!)
      .then(setStats)
      .catch(() => setStats(null));
  }, [id]);

  const confirmedRegs = registrations.filter((r) => r.status === 'confirmed');
  const filtered = confirmedRegs.filter(
    (r) => !searchTerm || r.name.includes(searchTerm) || r.phone.includes(searchTerm) || (r.teamName && r.teamName.includes(searchTerm))
  );

  const handleCheckin = async (reg: Registration) => {
    if (!currentUser) return;
    try {
      await checkinApi.checkin({ activityId: id!, registrationId: reg.id, volunteerId: currentUser.id });
      setCheckedIds((prev) => new Set(prev).add(reg.id));
      setStats((s) => s ? { ...s, checkedIn: s.checkedIn + 1, notCheckedIn: Math.max(s.notCheckedIn - 1, 0), checkinRate: (s.checkedIn + 1) / s.total } : null);
      addNotification(`${reg.name} 签到成功`);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '签到失败');
    }
  };

  const handleException = async (reg: Registration) => {
    if (!currentUser) return;
    const note = exceptionNote[reg.id] || '';
    try {
      await checkinApi.checkin({ activityId: id!, registrationId: reg.id, volunteerId: currentUser.id, isException: true, note });
      setCheckedIds((prev) => new Set(prev).add(reg.id));
      setExceptionIds((prev) => new Set(prev).add(reg.id));
      setStats((s) => s ? { ...s, checkedIn: s.checkedIn + 1, notCheckedIn: Math.max(s.notCheckedIn - 1, 0), exceptions: s.exceptions + 1, checkinRate: (s.checkedIn + 1) / s.total } : null);
      addNotification(`${reg.name} 已标记异常签到`);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '异常签到失败');
    }
    setShowExceptionModal(null);
  };

  const rate = stats ? stats.checkinRate : 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - rate * circumference;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-forest-800 mb-6">志愿者签到管理</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-warning">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索姓名或手机号..." className="greenway-input pl-10"
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="greenway-card p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>暂无报名人员</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((reg) => {
                const isChecked = checkedIds.has(reg.id);
                const isException = exceptionIds.has(reg.id);
                return (
                  <div key={reg.id} className={cn('greenway-card p-4 flex items-center justify-between', isChecked && 'bg-green-50/50')}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium', isChecked ? 'bg-success' : 'bg-gray-300')}>
                        {isChecked ? <CheckCircle className="w-5 h-5" /> : reg.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-forest-800">
                          {reg.name}
                          {reg.teamName && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-forest-100 text-forest-700">
                              {reg.teamName}{reg.isTeamLeader ? '·队长' : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{reg.phone} · {reg.age}岁</div>
                        {reg.members && reg.members.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-100 max-w-xs">
                            <p className="text-[10px] text-gray-400 mb-1">团队成员：</p>
                            <div className="flex flex-wrap gap-1.5">
                              {reg.members.map((m, i) => (
                                <span key={i} className={cn(
                                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
                                  m.checkedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                )}>
                                  {m.checkedIn && <CheckCircle className="w-2.5 h-2.5" />}
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {isException && <span className="text-xs text-warning font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />异常</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <span className="text-success text-sm font-medium flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> 已签到
                        </span>
                      ) : (
                        <>
                          <button onClick={() => handleCheckin(reg)} className="greenway-btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> 签到
                          </button>
                          <button onClick={() => setShowExceptionModal(reg.id)} className="px-3 py-1.5 rounded-lg border border-warning text-warning text-sm hover:bg-red-50 transition-colors flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> 异常
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="greenway-card p-6 text-center">
            <h3 className="font-serif text-base font-semibold text-forest-800 mb-4">签到统计</h3>
            {stats ? (
              <>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#2D6A4F" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-forest-700">{Math.round(rate * 100)}%</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">总报名</span><span className="font-medium">{stats.total}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">已签到</span><span className="font-medium text-success">{stats.checkedIn}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">未签到</span><span className="font-medium text-gray-600">{stats.notCheckedIn}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">异常</span><span className="font-medium text-warning">{stats.exceptions}</span></div>
                  {stats.teamCount !== undefined && stats.teamCount > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <div className="flex justify-between"><span className="text-gray-500">团队数量</span><span className="font-medium text-forest-700">{stats.teamCount}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">团队成员已签到</span><span className="font-medium text-success">{stats.teamCheckedIn ?? 0}</span></div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">暂无统计数据</p>
            )}
          </div>
        </div>
      </div>

      {showExceptionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-forest-800">标记异常签到</h3>
              <button onClick={() => setShowExceptionModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <textarea
              value={exceptionNote[showExceptionModal] || ''}
              onChange={(e) => setExceptionNote({ ...exceptionNote, [showExceptionModal]: e.target.value })}
              className="greenway-input min-h-[80px] mb-4"
              placeholder="请描述异常情况..."
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowExceptionModal(null)} className="greenway-btn-outline">取消</button>
              <button onClick={() => handleException(registrations.find((r) => r.id === showExceptionModal)!)} className="px-4 py-2 rounded-lg bg-warning text-white hover:bg-red-600 transition-colors text-sm font-medium">
                确认异常
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
