import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mountain, Bike, MapPin, Calendar, Users, Shield, AlertTriangle,
  CheckCircle, XCircle, Clock, ChevronRight, Package, Info
} from 'lucide-react';
import { activities as activityApi, registrations as regApi } from '@/api';
import type { Activity, Registration, WeatherInfo } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import WeatherAlert from '@/components/WeatherAlert';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';

const riskColors: Record<string, string> = { low: 'bg-success', medium: 'bg-waitlist', high: 'bg-warning' };
const riskLabels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' };

interface FormState {
  name: string; phone: string; age: string;
  emergencyContact: string; emergencyPhone: string;
  liabilitySigned: boolean; equipmentConfirmed: boolean[];
}

interface FormErrors {
  name?: string; phone?: string; age?: string;
  emergencyContact?: string; emergencyPhone?: string;
  liabilitySigned?: string; equipmentConfirmed?: string;
  general?: string;
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, addNotification } = useStore();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [myReg, setMyReg] = useState<Registration | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: '', phone: '', age: '',
    emergencyContact: '', emergencyPhone: '',
    liabilitySigned: false, equipmentConfirmed: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    activityApi.getDetail(id!)
      .then((a) => { setActivity(a); setForm((f) => ({ ...f, equipmentConfirmed: new Array(a.equipmentRequirements.length).fill(false) })); })
      .catch(() => setActivity(null))
      .finally(() => setLoading(false));

    activityApi.getWeather(id!)
      .then(setWeather)
      .catch(() => setWeather(null));
  }, [id]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = '请输入姓名';
    if (!/^1\d{10}$/.test(form.phone)) e.phone = '请输入正确的手机号';
    const age = parseInt(form.age);
    if (!form.age || isNaN(age)) e.age = '请输入年龄';
    else if (activity && (age < activity.ageMin || age > activity.ageMax)) e.age = `年龄需在 ${activity.ageMin}-${activity.ageMax} 之间`;
    if (!form.emergencyContact.trim()) e.emergencyContact = '请输入紧急联系人';
    if (!/^1\d{10}$/.test(form.emergencyPhone)) e.emergencyPhone = '请输入正确的紧急联系人电话';
    if (!form.liabilitySigned) e.liabilitySigned = '请阅读并同意免责声明';
    if (activity && form.equipmentConfirmed.some((v) => !v)) e.equipmentConfirmed = '请确认所有装备要求';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate() || !activity || !currentUser) return;
    setSubmitting(true);
    try {
      const result = await regApi.register(activity.id, {
        name: form.name,
        phone: form.phone,
        age: parseInt(form.age),
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        liabilitySigned: form.liabilitySigned,
        equipmentConfirmed: form.equipmentConfirmed.every(Boolean),
        userId: currentUser.id,
      });
      const fullReg: Registration = {
        id: result.id,
        activityId: activity.id,
        userId: currentUser.id,
        name: form.name,
        phone: form.phone,
        age: parseInt(form.age),
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        liabilitySigned: form.liabilitySigned,
        equipmentConfirmed: form.equipmentConfirmed.every(Boolean),
        status: result.status,
        waitlistPosition: result.waitlistPosition ?? null,
        registeredAt: new Date().toISOString(),
      };
      setMyReg(fullReg);
      addNotification(result.status === 'waitlisted' ? `已加入候补，排在第 ${result.waitlistPosition} 位` : '报名成功！');
      setActivity((a) => a ? { ...a, currentCount: a.currentCount + 1 } : a);
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : '报名失败，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!myReg || !currentUser) return;
    try {
      await regApi.cancel(myReg.id);
      setMyReg({ ...myReg, status: 'cancelled', waitlistPosition: null });
      addNotification('已取消报名');
      setActivity((a) => a ? { ...a, currentCount: Math.max(a.currentCount - 1, 0) } : a);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '取消失败');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!activity) return <div className="container mx-auto px-4 py-8 text-center text-gray-400">活动不存在</div>;

  const isFull = activity.currentCount >= activity.capacity;
  const totalDistance = activity.routeSegments.reduce((s, r) => s + r.distance, 0);
  const canRegister = (activity.status === 'open' || activity.status === 'full') && !myReg;

  return (
    <div className="container mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-forest-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="greenway-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {activity.type === 'hike' ? <Mountain className="w-6 h-6 text-forest-500" /> : <Bike className="w-6 h-6 text-sky-500" />}
                <h1 className="font-serif text-2xl font-bold text-forest-800">{activity.name}</h1>
              </div>
              <StatusBadge status={activity.status} type="activity" />
            </div>
            <p className="text-gray-600 mb-4">{activity.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="w-4 h-4 text-earth-400" /> {activity.date}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <MapPin className="w-4 h-4 text-earth-400" /> {activity.location}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Users className="w-4 h-4 text-forest-400" /> {activity.currentCount}/{activity.capacity}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Shield className="w-4 h-4 text-sky-400" /> {activity.pointsReward} 积分
              </div>
            </div>
          </div>

          {activity.routeSegments.length > 0 && (
            <div className="greenway-card p-6">
              <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">路线分段</h2>
              <div className="flex items-center gap-1 mb-4">
                {activity.routeSegments.map((seg, i) => (
                  <div key={seg.id} className="flex items-center flex-1">
                    <div className={cn('h-3 rounded-full flex-1', riskColors[seg.riskLevel])} />
                    {i < activity.routeSegments.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-0.5" />}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {activity.routeSegments.map((seg) => (
                  <div key={seg.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <div className="font-medium text-sm text-forest-800">{seg.name}</div>
                      <div className="text-xs text-gray-500">{seg.distance}km · {seg.supplyInfo || '无补给点'}</div>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', riskColors[seg.riskLevel], 'text-white')}>
                      {riskLabels[seg.riskLevel]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-500">总里程：{totalDistance} 公里</div>
            </div>
          )}

          <div className="greenway-card p-6">
            <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">
              <Package className="w-5 h-5 inline mr-2" />装备要求
            </h2>
            <div className="space-y-2">
              {activity.equipmentRequirements.map((eq, i) => (
                <label key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  {form.equipmentConfirmed[i] ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-300" />
                  )}
                  {eq}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {weather && <WeatherAlert weather={weather} />}

          <div className="greenway-card p-6">
            <h3 className="font-serif text-lg font-semibold text-forest-800 mb-3">报名进度</h3>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>已报名 {activity.currentCount}/{activity.capacity}</span>
                <span>{Math.round((activity.currentCount / activity.capacity) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={cn('h-3 rounded-full transition-all', isFull ? 'bg-waitlist' : 'bg-forest-400')}
                  style={{ width: `${Math.min((activity.currentCount / activity.capacity) * 100, 100)}%` }}
                />
              </div>
            </div>
            {activity.waitlistCount > 0 && (
              <p className="text-sm text-waitlist flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 候补 {activity.waitlistCount} 人
              </p>
            )}
          </div>

          {myReg ? (
            <div className="greenway-card p-6 border-2 border-forest-200">
              <h3 className="font-serif text-lg font-semibold text-forest-800 mb-3">我的报名</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-gray-500">姓名</span><span>{myReg.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">状态</span><StatusBadge status={myReg.status} type="registration" /></div>
                {myReg.waitlistPosition && (
                  <div className="flex justify-between"><span className="text-gray-500">候补位次</span><span className="text-waitlist font-medium">第 {myReg.waitlistPosition} 位</span></div>
                )}
              </div>
              {(myReg.status === 'confirmed' || myReg.status === 'waitlisted') && (
                <button onClick={handleCancel} className="w-full py-2 rounded-lg border border-warning text-warning hover:bg-red-50 transition-colors text-sm font-medium">
                  取消报名
                </button>
              )}
            </div>
          ) : canRegister ? (
            <div className="greenway-card p-6">
              <h3 className="font-serif text-lg font-semibold text-forest-800 mb-4">{isFull ? '加入候补' : '立即报名'}</h3>

              {errors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-warning">
                  {errors.general}
                </div>
              )}

              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="greenway-input" placeholder="请输入真实姓名" />
                    {errors.name && <p className="text-warning text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="greenway-input" placeholder="请输入手机号" />
                    {errors.phone && <p className="text-warning text-xs mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
                    <input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="greenway-input" placeholder={`${activity.ageMin}-${activity.ageMax}岁`} />
                    {errors.age && <p className="text-warning text-xs mt-1">{errors.age}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">紧急联系人</label>
                    <input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} className="greenway-input" placeholder="联系人姓名" />
                    {errors.emergencyContact && <p className="text-warning text-xs mt-1">{errors.emergencyContact}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">紧急联系人电话</label>
                    <input value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} className="greenway-input" placeholder="联系人手机号" />
                    {errors.emergencyPhone && <p className="text-warning text-xs mt-1">{errors.emergencyPhone}</p>}
                  </div>
                  <button onClick={() => { setStep(1); }} className="greenway-btn-primary w-full flex items-center justify-center gap-1">
                    下一步 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium mb-1">免责声明</p>
                        <p>本人理解并自愿参加本次绿道活动，知晓户外活动存在一定风险。本人承诺身体状况适合参加本次活动，在活动中注意自身安全。如因个人原因造成意外伤害，组织方不承担法律责任。</p>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.liabilitySigned} onChange={(e) => setForm({ ...form, liabilitySigned: e.target.checked })} className="rounded border-gray-300 text-forest-600 focus:ring-forest-500" />
                    <span>我已阅读并同意以上免责声明</span>
                  </label>
                  {errors.liabilitySigned && <p className="text-warning text-xs">{errors.liabilitySigned}</p>}

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">装备确认</p>
                    {activity.equipmentRequirements.map((eq, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                        <input type="checkbox" checked={form.equipmentConfirmed[i] || false} onChange={(e) => {
                          const arr = [...form.equipmentConfirmed];
                          arr[i] = e.target.checked;
                          setForm({ ...form, equipmentConfirmed: arr });
                        }} className="rounded border-gray-300 text-forest-600 focus:ring-forest-500" />
                        <span>{eq}</span>
                      </label>
                    ))}
                    {errors.equipmentConfirmed && <p className="text-warning text-xs">{errors.equipmentConfirmed}</p>}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setStep(0)} className="greenway-btn-outline flex-1">上一步</button>
                    <button onClick={handleRegister} disabled={submitting} className="greenway-btn-primary flex-1 flex items-center justify-center gap-1">
                      {submitting ? '提交中...' : isFull ? '加入候补' : '确认报名'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activity.status === 'weather_cancelled' ? (
            <div className="greenway-card p-6">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                <p className="text-forest-800 font-medium mb-1">活动已因天气原因取消</p>
              </div>
            </div>
          ) : !myReg && (activity.status === 'ended' || activity.status === 'ongoing') ? (
            <div className="greenway-card p-6">
              <div className="text-center">
                <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">活动{activity.status === 'ended' ? '已结束' : '进行中'}，无法报名</p>
              </div>
            </div>
          ) : null}

          <div className="greenway-card p-6">
            <h3 className="font-serif text-base font-semibold text-forest-800 mb-2">
              <Info className="w-4 h-4 inline mr-1" />退款规则
            </h3>
            <p className="text-sm text-gray-600">{activity.refundRule}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
