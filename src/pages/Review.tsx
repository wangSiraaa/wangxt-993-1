import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, Users, CheckCircle, AlertTriangle, Award, Clock, TrendingUp, Route, UserX, ShieldCheck, Gavel, Pause, Play, ArrowRightLeft } from 'lucide-react';
import { review, operations } from '@/api';
import type { ReviewData, EventLogEntry, Withdrawal } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const timelineIcons: Record<string, React.ReactNode> = {
  route_switch: <ArrowRightLeft className="w-3 h-3" />,
  suspended: <Pause className="w-3 h-3" />,
  resumed: <Play className="w-3 h-3" />,
  withdraw: <UserX className="w-3 h-3" />,
  withdrawal_adjudicate: <Gavel className="w-3 h-3" />,
  team_reduce: <Users className="w-3 h-3" />,
  waitlist_promote: <ShieldCheck className="w-3 h-3" />,
  volunteer_shift_add: <Clock className="w-3 h-3" />,
  volunteer_shift_status: <Clock className="w-3 h-3" />,
};

const timelineColors: Record<string, string> = {
  route_switch: 'bg-orange-400',
  suspended: 'bg-red-400',
  resumed: 'bg-green-400',
  withdraw: 'bg-yellow-400',
  withdrawal_adjudicate: 'bg-purple-400',
  team_reduce: 'bg-cyan-400',
  waitlist_promote: 'bg-emerald-400',
  volunteer_shift_add: 'bg-sky-400',
  volunteer_shift_status: 'bg-sky-400',
};

const refundStatusLabels: Record<string, string> = {
  pending: '待裁定',
  approved: '已批准',
  rejected: '已驳回',
  processed: '已退款',
};

const refundStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  processed: 'bg-blue-100 text-blue-700',
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReviewData | null>(null);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    review.getReviewData(id!)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : '获取复盘数据失败');
      })
      .finally(() => setLoading(false));

    operations.getEventLog(id!)
      .then(setEventLog)
      .catch(() => setEventLog([]));
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) return (
    <div className="container mx-auto px-4 py-8 text-center text-gray-400">
      <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>{error || '数据不存在'}</p>
    </div>
  );

  const statCards = [
    { label: '总报名数', value: data.stats.totalRegistrations, icon: Users, color: 'text-forest-600', bg: 'bg-forest-50' },
    { label: '签到率', value: `${Math.round(data.stats.checkinRate * 100)}%`, icon: CheckCircle, color: 'text-success', bg: 'bg-green-50' },
    { label: '异常数', value: data.stats.exceptionCount, icon: AlertTriangle, color: 'text-warning', bg: 'bg-red-50' },
    { label: '积分发放', value: data.stats.totalPointsIssued, icon: Award, color: 'text-earth-500', bg: 'bg-amber-50' },
  ];

  const detailStats = [
    { label: '已确认', value: data.stats.confirmedCount, color: 'text-success' },
    { label: '候补中', value: data.stats.waitlistCount, color: 'text-waitlist' },
    { label: '已取消', value: data.stats.cancelledCount, color: 'text-gray-500' },
    { label: '退款数', value: data.stats.refundCount, color: 'text-sky-500' },
    ...(data.stats.withdrawnCount !== undefined ? [{ label: '退赛数', value: data.stats.withdrawnCount, color: 'text-orange-500' }] : []),
    ...(data.stats.routeSwitchedCount !== undefined ? [{ label: '改线受影响', value: data.stats.routeSwitchedCount, color: 'text-orange-600' }] : []),
    ...(data.stats.teamCount !== undefined ? [{ label: '团队数', value: data.stats.teamCount, color: 'text-forest-600' }] : []),
  ];

  const mergedTimeline = [
    ...data.timeline.map((item) => ({
      time: item.time,
      event: item.event,
      detail: item.detail,
      source: item.source || 'review',
      eventType: '',
    })),
    ...eventLog.map((entry) => ({
      time: new Date(entry.createdAt).toLocaleString('zh-CN'),
      event: getEventLabel(entry.eventType),
      detail: entry.detail,
      source: 'event_log' as const,
      eventType: entry.eventType,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest-800">活动复盘</h1>
          <p className="text-gray-500 mt-1">{data.activity.name} · {data.activity.date}</p>
        </div>
        <StatusBadge status={data.activity.status} type="activity" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="greenway-card p-5">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.bg)}>
                  <Icon className={cn('w-5 h-5', card.color)} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="greenway-card p-6">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-forest-500" /> 报名详情
          </h2>
          <div className="space-y-3">
            {detailStats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{stat.label}</span>
                <span className={cn('text-lg font-bold', stat.color)}>{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">容量利用率</span>
              <span className="font-medium text-forest-600">{Math.round((data.stats.confirmedCount / data.activity.capacity) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
              <div className="bg-forest-400 h-2 rounded-full" style={{ width: `${Math.round((data.stats.confirmedCount / data.activity.capacity) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 greenway-card p-6">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> 异常记录
          </h2>
          {data.exceptions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">无异常记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">报名人</th>
                    <th className="text-left py-2 text-gray-500 font-medium">异常描述</th>
                    <th className="text-left py-2 text-gray-500 font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exceptions.map((ex, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-forest-800">{ex.name}</td>
                      <td className="py-3 text-gray-600">{ex.note}</td>
                      <td className="py-3 text-gray-400 text-xs">{new Date(ex.createdAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {data.withdrawals && data.withdrawals.length > 0 && (
        <div className="greenway-card p-6 mb-8">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4 flex items-center gap-2">
            <Gavel className="w-5 h-5 text-purple-500" /> 退赛退款记录
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">报名人</th>
                  <th className="text-left py-2 text-gray-500 font-medium">退赛原因</th>
                  <th className="text-center py-2 text-gray-500 font-medium">退费金额</th>
                  <th className="text-center py-2 text-gray-500 font-medium">退款状态</th>
                  <th className="text-left py-2 text-gray-500 font-medium">裁定人</th>
                  <th className="text-left py-2 text-gray-500 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-gray-50">
                    <td className="py-3 font-medium text-forest-800">{w.registrationName}</td>
                    <td className="py-3 text-gray-600">{w.reason}</td>
                    <td className="py-3 text-center font-medium">{w.refundAmount > 0 ? `${w.refundAmount}积分` : '—'}</td>
                    <td className="py-3 text-center">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', refundStatusColors[w.refundStatus])}>
                        {refundStatusLabels[w.refundStatus]}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">{w.adjudicatorName || '—'}</td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(w.createdAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="greenway-card p-6">
        <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-earth-400" /> 活动时间线
          <span className="text-xs text-gray-400 font-normal ml-2">（来源：统一事件日志）</span>
        </h2>
        {mergedTimeline.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">暂无时间线记录</p>
        ) : (
          <div className="space-y-0">
            {mergedTimeline.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white', timelineColors[item.eventType] || 'bg-forest-400')}>
                    {timelineIcons[item.eventType] || <Clock className="w-3 h-3" />}
                  </div>
                  {i < mergedTimeline.length - 1 && <div className="w-0.5 h-12 bg-forest-200" />}
                </div>
                <div className="pb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-earth-400">{item.time}</span>
                    <span className="font-medium text-forest-800 text-sm">{item.event}</span>
                    {item.source === 'event_log' && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-forest-100 text-forest-500">实时日志</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
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
  return labels[eventType] || eventType;
}
