import { cn } from '@/lib/utils';

type ActivityStatus = 'open' | 'full' | 'ongoing' | 'ended' | 'weather_cancelled';
type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded';

const activityColors: Record<ActivityStatus, string> = {
  open: 'bg-success/10 text-success border-success/30',
  full: 'bg-waitlist/10 text-waitlist border-waitlist/30',
  ongoing: 'bg-sky-400/10 text-sky-600 border-sky-400/30',
  ended: 'bg-gray-100 text-gray-500 border-gray-200',
  weather_cancelled: 'bg-warning/10 text-warning border-warning/30',
};

const registrationColors: Record<RegistrationStatus, string> = {
  confirmed: 'bg-success/10 text-success border-success/30',
  waitlisted: 'bg-waitlist/10 text-waitlist border-waitlist/30',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  refunded: 'bg-sky-400/10 text-sky-600 border-sky-400/30',
};

const activityLabels: Record<ActivityStatus, string> = {
  open: '报名中',
  full: '已满员',
  ongoing: '进行中',
  ended: '已结束',
  weather_cancelled: '天气取消',
};

const registrationLabels: Record<RegistrationStatus, string> = {
  confirmed: '已确认',
  waitlisted: '候补中',
  cancelled: '已取消',
  refunded: '已退款',
};

interface StatusBadgeProps {
  status: ActivityStatus | RegistrationStatus;
  type?: 'activity' | 'registration';
  className?: string;
}

export default function StatusBadge({ status, type = 'activity', className }: StatusBadgeProps) {
  const colors = type === 'activity' ? activityColors : registrationColors;
  const labels = type === 'activity' ? activityLabels : registrationLabels;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colors[status as keyof typeof colors],
        className
      )}
    >
      {labels[status as keyof typeof labels]}
    </span>
  );
}
