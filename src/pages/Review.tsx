import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, Users, CheckCircle, AlertTriangle, Award, Clock, TrendingUp } from 'lucide-react';
import { review } from '@/api';
import type { ReviewData } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReviewData | null>(null);
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
  ];

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

      <div className="greenway-card p-6">
        <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-earth-400" /> 活动时间线
        </h2>
        {data.timeline.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">暂无时间线记录</p>
        ) : (
          <div className="space-y-0">
            {data.timeline.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-forest-400" />
                  {i < data.timeline.length - 1 && <div className="w-0.5 h-12 bg-forest-200" />}
                </div>
                <div className="pb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-earth-400">{item.time}</span>
                    <span className="font-medium text-forest-800 text-sm">{item.event}</span>
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
