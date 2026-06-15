import { AlertTriangle, CloudRain, Wind, Thermometer } from 'lucide-react';
import type { WeatherInfo } from '@/types';
import { cn } from '@/lib/utils';

const alertColors: Record<WeatherInfo['alertLevel'], { bg: string; border: string; text: string }> = {
  none: { bg: 'bg-green-50', border: 'border-success/30', text: 'text-green-800' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800' },
  orange: { bg: 'bg-orange-50', border: 'border-waitlist', text: 'text-orange-800' },
  red: { bg: 'bg-red-50', border: 'border-warning', text: 'text-red-800' },
};

const alertLabels: Record<WeatherInfo['alertLevel'], string> = {
  none: '天气正常',
  yellow: '黄色预警',
  orange: '橙色预警',
  red: '红色预警',
};

const conditionIcons: Record<WeatherInfo['condition'], string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
};

interface WeatherAlertProps {
  weather: WeatherInfo;
  className?: string;
}

export default function WeatherAlert({ weather, className }: WeatherAlertProps) {
  const colors = alertColors[weather.alertLevel];

  return (
    <div className={cn('rounded-xl border p-4', colors.bg, colors.border, className)}>
      <div className="flex items-start gap-3">
        {weather.alertLevel !== 'none' ? (
          <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colors.text)} />
        ) : (
          <span className="text-xl">{conditionIcons[weather.condition]}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn('font-semibold text-sm', colors.text)}>
            {alertLabels[weather.alertLevel]}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" />
              {weather.temperature}°C
            </span>
            <span className="flex items-center gap-1">
              <CloudRain className="w-3.5 h-3.5" />
              {conditionIcons[weather.condition]}
            </span>
            <span className="flex items-center gap-1">
              <Wind className="w-3.5 h-3.5" />
              {weather.windSpeed} km/h
            </span>
          </div>
          {weather.alertLevel !== 'none' && (
            <p className="mt-2 text-xs text-gray-500">
              {weather.alertLevel === 'yellow' && '请注意天气变化，活动可能受到影响。'}
              {weather.alertLevel === 'orange' && '恶劣天气预警，建议减少户外活动，活动可能推迟。'}
              {weather.alertLevel === 'red' && '极端天气预警，活动将取消，请注意安全！'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
