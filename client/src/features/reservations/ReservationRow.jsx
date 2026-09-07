import StampBadge
  from '../../components/common/StampBadge';

import Button
  from '../../components/common/Button';

const statusBadge = {
  waiting: {
    tone: 'neutral',
    label: 'Waiting',
  },

  ready: {
    tone: 'brass',
    label: 'Ready for Pickup',
  },

  fulfilled: {
    tone: 'success',
    label: 'Collected',
  },

  cancelled: {
    tone: 'neutral',
    label: 'Cancelled',
  },

  expired: {
    tone: 'danger',
    label: 'Expired',
  },
};

const formatDate = (
  iso
) => {
  if (!iso) {
    return '—';
  }

  return new Date(
    iso
  ).toLocaleString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};

export default function ReservationRow({
  reservation,
  onCancel,
  isCancelling,
  cancelError,
}) {
  const badge =
    statusBadge[
      reservation.status
    ] || {
      tone: 'neutral',
      label:
        reservation.status,
    };

  const canCancel =
    [
      'waiting',
      'ready',
    ].includes(
      reservation.status
    );

  const isReady =
    reservation.status ===
    'ready';

  const isWaiting =
    reservation.status ===
    'waiting';

  return (
    <div className="border-b border-hairline py-5 last:border-b-0">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-serif text-base font-semibold text-ink">
            {reservation.book
              ?.title ||
              'Unknown Book'}
          </h3>

          <p className="mt-1 font-mono text-xs text-ink-muted">
            Requested{' '}
            {formatDate(
              reservation.requestedAt
            )}
          </p>

          {isWaiting &&
            reservation.queuePosition && (
              <div className="mt-3 rounded-card bg-paper px-3 py-2">
                <p className="text-sm text-ink">
                  Queue position:{' '}
                  <span className="font-semibold">
                    #
                    {
                      reservation.queuePosition
                    }
                  </span>
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  You will be notified when a copy becomes available.
                </p>
              </div>
            )}

          {isReady && (
            <div className="mt-3 rounded-card border border-brass bg-brass-light px-3 py-3">
              <p className="font-medium text-brass-dark">
                Ready for pickup
              </p>

              <p className="mt-1 text-xs text-ink-muted">
                Collect before{' '}
                {formatDate(
                  reservation.expiresAt
                )}
              </p>

              {reservation
                .heldCopy
                ?.barcode && (
                <p className="mt-2 font-mono text-xs text-ink">
                  Copy:{' '}
                  {
                    reservation
                      .heldCopy
                      .barcode
                  }
                </p>
              )}

              {reservation
                .heldCopy
                ?.shelfLocation && (
                <p className="mt-1 text-xs text-ink-muted">
                  Location:{' '}
                  {
                    reservation
                      .heldCopy
                      .shelfLocation
                  }
                </p>
              )}

              <p className="mt-2 text-xs text-ink-muted">
                Visit the circulation desk to collect this book.
              </p>
            </div>
          )}

          {reservation.status ===
            'fulfilled' && (
            <p className="mt-3 text-sm text-status-success">
              This reservation was collected and converted into a loan.
            </p>
          )}

          {reservation.status ===
            'expired' && (
            <p className="mt-3 text-sm text-status-danger">
              The pickup window expired and the held copy was released.
            </p>
          )}

          {reservation.status ===
            'cancelled' && (
            <p className="mt-3 text-sm text-ink-muted">
              This reservation was cancelled.
            </p>
          )}
        </div>

        <StampBadge
          tone={
            badge.tone
          }
        >
          {badge.label}
        </StampBadge>
      </div>

      {cancelError && (
        <p className="mt-3 text-xs text-status-danger">
          {cancelError}
        </p>
      )}

      {canCancel && (
        <Button
          variant="secondary"
          className="mt-3 text-xs"
          disabled={
            isCancelling
          }
          onClick={() =>
            onCancel(
              reservation.id
            )
          }
        >
          {isCancelling
            ? 'Cancelling…'
            : isReady
              ? 'Cancel Pickup'
              : 'Cancel Reservation'}
        </Button>
      )}
    </div>
  );
}