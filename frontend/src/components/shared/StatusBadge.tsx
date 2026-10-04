import { cn, getStatusColor, formatStatus } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      getStatusColor(status),
      className
    )}>
      {formatStatus(status)}
    </span>
  )
}
