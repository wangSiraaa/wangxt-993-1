import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, MapPin, Mountain, Bike, Eye, X } from 'lucide-react';
import { activities as api } from '@/api';
import { useStore } from '@/store';
import type { Activity, RouteSegment } from '@/types';
import { cn } from '@/lib/utils';

interface SegmentForm {
  name: string; distance: string; capacity: string; supplyInfo: string; riskLevel: RouteSegment['riskLevel'];
}

const emptySegment = (): SegmentForm => ({ name: '', distance: '', capacity: '', supplyInfo: '', riskLevel: 'low' });

export default function Publish() {
  const { currentUser, addNotification } = useStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<Activity['type']>('hike');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [refundRule, setRefundRule] = useState('活动前48小时可全额退款');
  const [pointsReward, setPointsReward] = useState('20');
  const [equipmentTag, setEquipmentTag] = useState('');
  const [equipmentList, setEquipmentList] = useState<string[]>([]);
  const [segments, setSegments] = useState<SegmentForm[]>([emptySegment()]);

  const addEquipment = () => {
    if (equipmentTag.trim() && !equipmentList.includes(equipmentTag.trim())) {
      setEquipmentList([...equipmentList, equipmentTag.trim()]);
      setEquipmentTag('');
    }
  };

  const removeEquipment = (idx: number) => setEquipmentList(equipmentList.filter((_, i) => i !== idx));

  const addSegment = () => setSegments([...segments, emptySegment()]);

  const removeSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((_, i) => i !== idx));
  };

  const updateSegment = (idx: number, field: keyof SegmentForm, value: string) => {
    const arr = [...segments];
    arr[idx] = { ...arr[idx], [field]: value };
    setSegments(arr);
  };

  const validate = (): boolean => {
    if (!name.trim()) { addNotification('请输入活动名称'); return false; }
    if (!date) { addNotification('请选择日期'); return false; }
    if (!location.trim()) { addNotification('请输入活动地点'); return false; }
    if (!capacity || parseInt(capacity) <= 0) { addNotification('请输入有效的容量'); return false; }
    if (equipmentList.length === 0) { addNotification('请至少添加一项装备要求'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !currentUser) return;
    setSubmitting(true);
    const data: Partial<Activity> = {
      name, type, date, location, description,
      capacity: parseInt(capacity),
      ageMin: parseInt(ageMin) || 12,
      ageMax: parseInt(ageMax) || 65,
      equipmentRequirements: equipmentList,
      refundRule,
      pointsReward: parseInt(pointsReward) || 20,
      status: 'open',
      weatherRiskLevel: 'low',
      createdBy: currentUser.id,
      routeSegments: segments.map((s, i) => ({
        id: `seg-${Date.now()}-${i}`,
        activityId: '',
        name: s.name,
        distance: parseFloat(s.distance) || 0,
        capacity: parseInt(s.capacity) || parseInt(capacity),
        supplyInfo: s.supplyInfo,
        riskLevel: s.riskLevel,
        sortOrder: i + 1,
      })),
      currentCount: 0,
      waitlistCount: 0,
    };
    try {
      const created = await api.create(data);
      addNotification('活动发布成功！');
      navigate(`/activity/${created.id}`);
    } catch (err) {
      addNotification(err instanceof Error ? err.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (preview) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-forest-800">活动预览</h1>
          <button onClick={() => setPreview(false)} className="greenway-btn-outline flex items-center gap-1">
            <X className="w-4 h-4" /> 关闭预览
          </button>
        </div>
        <div className="greenway-card p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            {type === 'hike' ? <Mountain className="w-6 h-6 text-forest-500" /> : <Bike className="w-6 h-6 text-sky-500" />}
            <h2 className="font-serif text-xl font-bold text-forest-800">{name || '未命名活动'}</h2>
          </div>
          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <p>📅 {date || '未设置'}</p>
            <p>📍 {location || '未设置'}</p>
            <p>👥 容量 {capacity || '-'} 人 · 年龄 {ageMin || 12}-{ageMax || 65} 岁</p>
            <p>🎁 积分奖励 {pointsReward}</p>
          </div>
          {description && <p className="text-gray-600 mb-4">{description}</p>}
          {equipmentList.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">装备要求：</p>
              <div className="flex flex-wrap gap-2">
                {equipmentList.map((eq, i) => (
                  <span key={i} className="px-2 py-1 bg-forest-50 text-forest-700 text-xs rounded-full">{eq}</span>
                ))}
              </div>
            </div>
          )}
          {segments.some((s) => s.name) && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">路线分段：</p>
              {segments.filter((s) => s.name).map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded mb-1">
                  <span className="text-sm">{s.name} ({s.distance}km)</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full text-white', s.riskLevel === 'low' ? 'bg-success' : s.riskLevel === 'medium' ? 'bg-waitlist' : 'bg-warning')}>
                    {s.riskLevel === 'low' ? '低风险' : s.riskLevel === 'medium' ? '中风险' : '高风险'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-center gap-4 mt-6">
          <button onClick={() => setPreview(false)} className="greenway-btn-outline">返回编辑</button>
          <button onClick={handleSubmit} disabled={submitting} className="greenway-btn-primary">
            {submitting ? '发布中...' : '确认发布'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-2xl font-bold text-forest-800 mb-6">发布新活动</h1>

      <div className="space-y-6">
        <div className="greenway-card p-6">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">活动名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="greenway-input" placeholder="例：翠湖绿道春季徒步" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">活动类型</label>
              <div className="flex gap-2">
                <button onClick={() => setType('hike')} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors', type === 'hike' ? 'bg-forest-500 text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                  <Mountain className="w-4 h-4" /> 徒步
                </button>
                <button onClick={() => setType('bike')} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors', type === 'bike' ? 'bg-sky-500 text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                  <Bike className="w-4 h-4" /> 骑行
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">活动日期</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="greenway-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">活动地点</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="greenway-input pl-10" placeholder="集合地点" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">容量限制</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="greenway-input" placeholder="最大人数" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最小年龄</label>
              <input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className="greenway-input" placeholder="12" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最大年龄</label>
              <input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className="greenway-input" placeholder="65" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">活动描述</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="greenway-input min-h-[80px]" placeholder="详细介绍活动内容..." />
            </div>
          </div>
        </div>

        <div className="greenway-card p-6">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">装备要求</h2>
          <div className="flex gap-2 mb-3">
            <input value={equipmentTag} onChange={(e) => setEquipmentTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEquipment())} className="greenway-input flex-1" placeholder="输入装备名称，回车添加" />
            <button onClick={addEquipment} className="greenway-btn-outline flex items-center gap-1">
              <PlusCircle className="w-4 h-4" /> 添加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {equipmentList.map((eq, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-forest-50 text-forest-700 text-sm rounded-full">
                {eq}
                <button onClick={() => removeEquipment(i)} className="text-forest-400 hover:text-warning"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="greenway-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-forest-800">路线分段</h2>
            <button onClick={addSegment} className="greenway-btn-outline text-sm flex items-center gap-1">
              <PlusCircle className="w-4 h-4" /> 添加分段
            </button>
          </div>
          <div className="space-y-4">
            {segments.map((seg, i) => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg relative">
                {segments.length > 1 && (
                  <button onClick={() => removeSegment(i)} className="absolute top-2 right-2 text-gray-400 hover:text-warning">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">分段名称</label>
                    <input value={seg.name} onChange={(e) => updateSegment(i, 'name', e.target.value)} className="greenway-input text-sm" placeholder="例：东门→花海区" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">距离(km)</label>
                    <input type="number" value={seg.distance} onChange={(e) => updateSegment(i, 'distance', e.target.value)} className="greenway-input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">容量</label>
                    <input type="number" value={seg.capacity} onChange={(e) => updateSegment(i, 'capacity', e.target.value)} className="greenway-input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">补给信息</label>
                    <input value={seg.supplyInfo} onChange={(e) => updateSegment(i, 'supplyInfo', e.target.value)} className="greenway-input text-sm" placeholder="补给站名称" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">风险等级</label>
                    <select value={seg.riskLevel} onChange={(e) => updateSegment(i, 'riskLevel', e.target.value)} className="greenway-input text-sm">
                      <option value="low">低风险</option>
                      <option value="medium">中风险</option>
                      <option value="high">高风险</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="greenway-card p-6">
          <h2 className="font-serif text-lg font-semibold text-forest-800 mb-4">规则设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">退款规则</label>
              <input value={refundRule} onChange={(e) => setRefundRule(e.target.value)} className="greenway-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">积分奖励</label>
              <input type="number" value={pointsReward} onChange={(e) => setPointsReward(e.target.value)} className="greenway-input" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button onClick={() => setPreview(true)} className="greenway-btn-outline flex items-center gap-1">
            <Eye className="w-4 h-4" /> 预览
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="greenway-btn-primary flex items-center gap-1">
            {submitting ? '发布中...' : '发布活动'}
          </button>
        </div>
      </div>
    </div>
  );
}
