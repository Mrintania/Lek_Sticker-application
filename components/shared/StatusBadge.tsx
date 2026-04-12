import { AttendanceStatus, STATUS_LABELS } from '@/lib/types'

const statusClasses: Record<AttendanceStatus, string> = {
  present: 'status-present',
  late: 'status-late',
  earlyLeave: 'status-earlyLeave',
  halfDay: 'status-halfDay',
  noCheckout: 'status-noCheckout',
  absent: 'status-absent',
  leave_sick: 'status-earlyLeave',
  leave_sick_cert: 'status-present',
  leave_half_morning: 'status-halfDay',
  leave_half_afternoon: 'status-halfDay',
  leave_full_day: 'status-absent',
  holiday: 'status-noCheckout',
  noCheckIn: 'status-noCheckout',
}

export default function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
