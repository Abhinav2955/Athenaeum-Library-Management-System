import StampBadge from '../../components/common/StampBadge';
import Button from '../../components/common/Button';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const getDisplayStatus = (record) => {
  if (record.status === 'returned') return 'returned';
  if (new Date(record.dueAt) < new Date()) return 'overdue';
  return 'active';
};

const statusBadge = {
  active: { tone: 'brass', label: 'On Loan' },
  overdue: { tone: 'danger', label: 'Overdue' },
  returned: { tone: 'success', label: 'Returned' },
};

export default function LoanRow({ record, onRenew, isRenewing, renewError }) {
  const displayStatus = getDisplayStatus(record);
  const badge = statusBadge[displayStatus];
  const canRenew = record.status === 'active'; // backend enforces the rest (max renewals, queue)

  return (
    <div className="border-b border-hairline py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-base font-semibold text-ink">{record.copy?.book?.title}</h3>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Borrowed {formatDate(record.borrowedAt)} · Due {formatDate(record.dueAt)}
            {record.renewedCount > 0 && ` · Renewed ${record.renewedCount}×`}
          </p>
        </div>
        <StampBadge tone={badge.tone}>{badge.label}</StampBadge>
      </div>

      {renewError && <p className="mt-2 text-xs text-status-danger">{renewError}</p>}

      {canRenew && (
        <Button
          variant="secondary"
          className="mt-3 text-xs"
          disabled={isRenewing}
          onClick={() => onRenew(record.id)}
        >
          {isRenewing ? 'Renewing…' : 'Renew'}
        </Button>
      )}
    </div>
  );
}