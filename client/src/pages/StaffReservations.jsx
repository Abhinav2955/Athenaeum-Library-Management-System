import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import Input
  from '../components/common/Input';

import {
  listAllReservations,
  cancelReservation,
} from '../api/reservations.api';

const STATUS_TABS = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'waiting',
    label: 'Waiting',
  },
  {
    key: 'ready',
    label: 'Ready',
  },
  {
    key: 'fulfilled',
    label: 'Collected',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
  },
  {
    key: 'expired',
    label: 'Expired',
  },
];

const formatDate = (
  value
) => {
  if (!value) {
    return '—';
  }

  return new Date(
    value
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

const statusClass = (
  status
) => {
  switch (status) {
    case 'ready':
      return 'bg-brass-light text-brass-dark';

    case 'fulfilled':
      return 'bg-status-successBg text-status-success';

    case 'expired':
      return 'bg-status-dangerBg text-status-danger';

    case 'cancelled':
      return 'bg-paper text-ink-muted';

    default:
      return 'bg-paper text-ink';
  }
};

const ReservationCard = ({
  reservation,
  cancellingId,
  onCancel,
  onOpenDesk,
}) => {
  const member =
    reservation.member;

  const book =
    reservation.book;

  const copy =
    reservation.heldCopy;

  const canCancel =
    [
      'waiting',
      'ready',
    ].includes(
      reservation.status
    );

  return (
    <div className="rounded-card border border-hairline bg-white p-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-ink">
              {book?.title ||
                'Unknown Book'}
            </h3>

            <span
              className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClass(
                reservation.status
              )}`}
            >
              {
                reservation.status
              }
            </span>

            {reservation.status ===
              'waiting' &&
              reservation.queuePosition && (
                <span className="rounded-full bg-paper px-2 py-1 font-mono text-[10px] text-ink-muted">
                  Queue #
                  {
                    reservation.queuePosition
                  }
                </span>
              )}
          </div>

          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Member
              </p>

              <p className="mt-1 text-ink">
                {member?.name ||
                  'Unknown Member'}
              </p>

              <p className="mt-0.5 text-xs text-ink-muted">
                {member?.email ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Membership
              </p>

              <p className="mt-1 capitalize text-ink">
                {member?.membershipStatus ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                ISBN
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {book?.isbn ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Requested
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  reservation.requestedAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Ready
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  reservation.readyAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Pickup Deadline
              </p>

              <p
                className={`mt-1 ${
                  reservation.status ===
                  'ready'
                    ? 'font-medium text-brass-dark'
                    : 'text-ink'
                }`}
              >
                {formatDate(
                  reservation.expiresAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Held Copy
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {copy?.barcode ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Shelf
              </p>

              <p className="mt-1 text-ink">
                {copy?.shelfLocation ||
                  '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
          {reservation.status ===
            'ready' && (
            <Button
              variant="brass"
              onClick={() =>
                onOpenDesk(
                  reservation
                )
              }
            >
              Open Circulation
            </Button>
          )}

          {canCancel && (
            <Button
              variant="secondary"
              disabled={
                cancellingId ===
                reservation.id
              }
              onClick={() =>
                onCancel(
                  reservation
                )
              }
            >
              {cancellingId ===
              reservation.id
                ? 'Cancelling…'
                : 'Cancel'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function StaffReservations() {
  const navigate =
    useNavigate();

  const [
    activeTab,
    setActiveTab,
  ] = useState('all');

  const [
    reservations,
    setReservations,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    cancellingId,
    setCancellingId,
  ] = useState(null);

  const loadReservations =
    useCallback(
      async () => {
        setLoading(true);
        setError('');

        try {
          if (
            activeTab ===
            'all'
          ) {
            const [
              waiting,
              ready,
              fulfilled,
              cancelled,
              expired,
            ] =
              await Promise.all([
                listAllReservations({
                  status:
                    'waiting',
                  limit: 100,
                }),

                listAllReservations({
                  status:
                    'ready',
                  limit: 100,
                }),

                listAllReservations({
                  status:
                    'fulfilled',
                  limit: 100,
                }),

                listAllReservations({
                  status:
                    'cancelled',
                  limit: 100,
                }),

                listAllReservations({
                  status:
                    'expired',
                  limit: 100,
                }),
              ]);

            const combined = [
              ...(waiting.reservations ||
                []),

              ...(ready.reservations ||
                []),

              ...(fulfilled.reservations ||
                []),

              ...(cancelled.reservations ||
                []),

              ...(expired.reservations ||
                []),
            ];

            const unique =
              Array.from(
                new Map(
                  combined.map(
                    (reservation) => [
                      reservation.id,
                      reservation,
                    ]
                  )
                ).values()
              );

            unique.sort(
              (a, b) =>
                new Date(
                  b.requestedAt
                ) -
                new Date(
                  a.requestedAt
                )
            );

            setReservations(
              unique
            );
          } else {
            const result =
              await listAllReservations({
                status:
                  activeTab,

                limit: 100,
              });

            setReservations(
              result.reservations ||
                []
            );
          }
        } catch (err) {
          setError(
            err.response
              ?.data
              ?.message ||
              'Could not load reservations.'
          );
        } finally {
          setLoading(false);
        }
      },
      [activeTab]
    );

  useEffect(() => {
    loadReservations();
  }, [
    loadReservations,
  ]);

  const filteredReservations =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return reservations;
      }

      return reservations.filter(
        (reservation) => {
          const values = [
            reservation.member
              ?.name,

            reservation.member
              ?.email,

            reservation.member
              ?.phone,

            reservation.book
              ?.title,

            reservation.book
              ?.isbn,

            reservation.heldCopy
              ?.barcode,

            reservation.heldCopy
              ?.shelfLocation,

            reservation.status,
          ];

          return values.some(
            (value) =>
              String(
                value || ''
              )
                .toLowerCase()
                .includes(
                  term
                )
          );
        }
      );
    }, [
      reservations,
      search,
    ]);

  const handleCancel =
    async (
      reservation
    ) => {
      setError('');
      setSuccess('');

      setCancellingId(
        reservation.id
      );

      try {
        await cancelReservation(
          reservation.id
        );

        setSuccess(
          `Reservation for "${reservation.book?.title || 'book'}" cancelled.`
        );

        await loadReservations();
      } catch (err) {
        setError(
          err.response
            ?.data
            ?.message ||
            'Could not cancel this reservation.'
        );
      } finally {
        setCancellingId(
          null
        );
      }
    };

  const handleOpenDesk =
    () => {
      /*
       * Part 3 circulation desk performs the
       * actual physical checkout.
       *
       * The backend automatically detects the
       * member's ready reservation and checks
       * out their held copy.
       */
      navigate(
        '/admin/circulation'
      );
    };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Staff Operations
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Reservation Management
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Manage waiting queues, ready pickups and reservation history.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-card border border-status-danger bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-card border border-status-success bg-status-successBg px-4 py-3 text-sm text-status-success">
            {success}
          </div>
        )}

        <div className="rounded-card border border-hairline bg-white">
          <div className="border-b border-hairline p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="flex flex-wrap gap-1">
                {STATUS_TABS.map(
                  (tab) => (
                    <button
                      key={
                        tab.key
                      }
                      type="button"
                      onClick={() => {
                        setActiveTab(
                          tab.key
                        );

                        setSuccess('');
                        setError('');
                      }}
                      className={`rounded-card px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab ===
                        tab.key
                          ? 'bg-brass-light text-brass-dark'
                          : 'text-ink-muted hover:bg-paper hover:text-ink'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                )}
              </div>

              <div className="w-full lg:w-80">
                <Input
                  id="reservation-search"
                  label="Search"
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Member, book, ISBN, barcode…"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-hairline px-5 py-3">
            <p className="font-mono text-xs text-ink-muted">
              Showing{' '}
              {
                filteredReservations.length
              }{' '}
              reservation
              {filteredReservations.length ===
              1
                ? ''
                : 's'}
            </p>
          </div>

          <div className="p-5">
            {loading ? (
              <p className="font-mono text-sm text-ink-muted">
                Loading reservations…
              </p>
            ) : filteredReservations.length ===
              0 ? (
              <div className="rounded-card bg-paper p-6 text-center">
                <p className="text-sm text-ink-muted">
                  No matching reservations.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReservations.map(
                  (
                    reservation
                  ) => (
                    <ReservationCard
                      key={
                        reservation.id
                      }
                      reservation={
                        reservation
                      }
                      cancellingId={
                        cancellingId
                      }
                      onCancel={
                        handleCancel
                      }
                      onOpenDesk={
                        handleOpenDesk
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}