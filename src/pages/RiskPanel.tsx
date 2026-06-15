import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Cloud, Wind, Thermometer, Shield, X, MapPin } from 'lucide-react';
import { activities as activityApi, routeRisk, checkins as checkinApi } from '@/api';
import type { Activity, RouteSegment, WeatherInfo, CheckinStats } from '@/types';
import WeatherAlert from '@/components/WeatherAlert';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

const riskColors: Record<string, { bg: string; text: string; bar: string }> = {
  low: { bg: 'bg-green-50', text: 'text-success', bar: 'bg-success' },
  medium: { bg: 'bg-orange-50', text: 'text-waitlist', bar: 'bg-waitlist' },
  high: { bg: 'bg-red-50', text: 'text-warning', bar: 'bg-warning' },
};
const riskLabels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' };

export default function RiskPanel() {
  const { id } = useParams<{ id: string }>();
  const { currentUser, addNotification } = useStore();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    setLoading(true);
    activityApi.getDetail(id!)
      .then((a) => { setActivity(a); setLoading(false); })
      .catch(() => { setActivity(null); setLoading(false); });

    routeRisk.getRouteRisk(id!)
      .then((data) => setRouteSegments(data.segments))
      .catch(() => setRouteSegments([]));

    activityApi.getWeather(id!)
      .then(setWeather)
      .catch(() => setWeather(null));

    checkinApi.getStats(id!)
      .then(setStats)
      .catch(() => setStats(null));
  }, [id]);

  const handleWeatherCancel = async () => {
    if (!activity) return;
    try {
      const result = await routeRisk.weatherCancel(activity.id);
      setActivity({ ...activity, status: 'weather_cancelled' });
      addNotification(`已因天气原因取消活动，${result.refundedCount} 人已退款`);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '取消操作失败');
    }
    setShowCancelDialog(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!activity) return <div className="container mx-auto px-4 py-8 text-center text-gray-400">活动不存在</div>;

  const displaySegments = routeSegments.length > 0 ? routeSegments : activity.routeSegments;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl font-bold text-forest-800 mb-2">路线风险管理</h1>
      <p className="text-gray-500 mb-6 flex items-center gap-1">
        <MapPin className="w-4 h-4" /> {activity.name}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {weather && <WeatherAlert weather={weather} />}

          <div className="greenway-card p-6">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">
              <Shield className="w-5 h-5 inline mr-1" />路线分段风险评估
            </h2>
            {displaySegments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">暂无路线数据</p>
            ) : (
              <>
                <div className="flex items-center gap-1 mb-6">
                  {displaySegments.map((seg, i) => (
                    <div key={seg.id} className="flex items-center flex-1">
                      <div className={cn('h-4 rounded-full flex-1', riskColors[seg.riskLevel].bar)} />
                      {i < displaySegments.length - 1 && <div className="w-2" />}
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {displaySegments.map((seg) => {
                    const util = stats ? ((stats.checkedIn / seg.capacity) * 100) : ((activity.currentCount / seg.capacity) * 100);
                    return (
                      <div key={seg.id} className={cn('p-4 rounded-xl border', riskColors[seg.riskLevel].bg)}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm text-forest-800">{seg.name}</div>
                            <div className="text-xs text-gray-500">{seg.distance}km · 容量 {seg.capacity} 人 · {seg.supplyInfo || '无补给'}</div>
                          </div>
                          <span className={cn('text-xs px-2.5 py-1 rounded-full text-white', riskColors[seg.riskLevel].bar)}>
                            {riskLabels[seg.riskLevel]}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>容量利用率</span>
                            <span>{Math.round(util)}%</span>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-2">
                            <div className={cn('h-2 rounded-full', riskColors[seg.riskLevel].bar)} style={{ width: `${Math.min(util, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {weather && (
            <div className="greenway-card p-6">
              <h3 className="font-serif text-base font-semibold text-forest-800 mb-3">天气详情</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Thermometer className="w-4 h-4 text-earth-400" /> 温度：{weather.temperature}°C
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Cloud className="w-4 h-4 text-sky-400" /> 天况：{weather.condition === 'sunny' ? '晴' : weather.condition === 'cloudy' ? '多云' : weather.condition === 'rainy' ? '雨' : '暴风'}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Wind className="w-4 h-4 text-gray-400" /> 风速：{weather.windSpeed} km/h
                </div>
              </div>
            </div>
          )}

          <div className="greenway-card p-6">
            <h3 className="font-serif text-base font-semibold text-forest-800 mb-3">签到概览</h3>
            {stats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">总报名</span><span className="font-medium">{stats.total}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">已签到</span><span className="font-medium text-success">{stats.checkedIn}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">未签到</span><span className="font-medium text-gray-600">{stats.notCheckedIn}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">异常</span><span className="font-medium text-warning">{stats.exceptions}</span></div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">暂无统计数据</p>
            )}
          </div>

          {activity.status !== 'weather_cancelled' && (
            <div className="greenway-card p-6 border-2 border-warning/30">
              <h3 className="font-serif text-base font-semibold text-warning mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> 危险操作
              </h3>
              <p className="text-xs text-gray-500 mb-3">因天气原因取消活动将通知所有报名者，并自动处理退款。</p>
              <button onClick={() => setShowCancelDialog(true)} className="w-full py-2 rounded-lg bg-warning text-white hover:bg-red-600 transition-colors text-sm font-medium">
                因天气取消活动
              </button>
            </div>
          )}
        </div>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-warning flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> 确认取消活动
              </h3>
              <button onClick={() => setShowCancelDialog(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              确定因天气原因取消「{activity.name}」吗？此操作将通知所有 {activity.currentCount} 名报名者并自动退款，不可撤销。
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelDialog(false)} className="greenway-btn-outline">取消</button>
              <button onClick={handleWeatherCancel} className="px-4 py-2 rounded-lg bg-warning text-white hover:bg-red-600 transition-colors text-sm font-medium">
                确认取消活动
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
