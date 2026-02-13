import { ContactStatus } from '@/types/crm';
import { getStatusColor } from '@/types/crm';

export default function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}
