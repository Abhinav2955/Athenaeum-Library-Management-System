import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import Input
  from '../components/common/Input';

import {
  listAllFines,
  recordManualPayment,
  waiveFine,
} from '../api/fines.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

const STATUS_TABS = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'pending',
    label: 'Pending',
  },
  {
    key: 'paid',
    label: 'Paid',
  },
  {
    key: 'waived',
    label: 'Waived',
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
  ).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );
};

const statusClass = (
  status
) => {
  switch (status) {
    case 'pending':
      return (
        'bg-status-warningBg text-status-warning'
      );

    case 'paid':
      return (
        'bg-status-successBg text-status-success'
      );

    case 'waived':
      return (
        'bg-paper text-ink-muted'
      );

    default:
      return (
        'bg-paper text-ink-muted'
      );
  }
};

const FineCard = ({
  fine,
  payingId,
  waivingId,
  waiverReason,
  onWaiverReasonChange,
  onPay,
  onWaive,
}) => {
  const member =
    fine.member;

  const loan =
    fine.borrowRecord;

  const copy =
    loan?.copy;

  const book =
    copy?.book;

  const isPending =
    fine.status ===
    'pending';

  return (
    <div className="rounded-card border border-hairline bg-white p-5">
      <div className="flex flex-col justify-between gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-serif text-lg font-semibold text-ink">
              ₹
              {Number(
                fine.amount
              ).toFixed(
                2
              )}
            </h3>

            <span
              className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClass(
                fine.status
              )}`}
            >
              {fine.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-ink">
            {fine.reason}
          </p>

          <div className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Member
              </p>

              <p className="mt-1 text-ink">
                {member?.name ||
                  'Unknown Member'}
              </p>

              <p className="mt-1 text-xs text-ink-muted">
                {member?.email ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Book
              </p>

              <p className="mt-1 text-ink">
                {book?.title ||
                  '—'}
              </p>

              <p className="mt-1 font-mono text-xs text-ink-muted">
                {book?.isbn
                  ? `ISBN ${book.isbn}`
                  : '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Copy
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {copy?.barcode ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Fine Issued
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  fine.createdAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Due Date
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan?.dueAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Returned
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan?.returnedAt
                )}
              </p>
            </div>

            {fine.status ===
              'paid' && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                  Paid
                </p>

                <p className="mt-1 text-status-success">
                  {formatDate(
                    fine.paidAt
                  )}
                </p>
              </div>
            )}

            {fine.status ===
              'waived' && (
              <div className="sm:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                  Waiver Reason
                </p>

                <p className="mt-1 text-ink">
                  {fine.waivedReason ||
                    '—'}
                </p>
              </div>
            )}
          </div>

          {isPending && (
            <div className="mt-5 border-t border-hairline pt-4">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Waive Fine
              </p>

              <div className="mt-2 max-w-lg">
                <Input
                  id={`waiver-${fine.id}`}
                  label="Reason"
                  value={
                    waiverReason ||
                    ''
                  }
                  onChange={(
                    event
                  ) =>
                    onWaiverReasonChange(
                      fine.id,
                      event.target
                        .value
                    )
                  }
                  placeholder="Reason for waiver"
                />
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
            <Button
              variant="brass"
              disabled={
                payingId ===
                fine.id
              }
              onClick={() =>
                onPay(
                  fine
                )
              }
            >
              {payingId ===
              fine.id
                ? 'Recording…'
                : 'Record Payment'}
            </Button>

            <Button
              variant="secondary"
              disabled={
                waivingId ===
                fine.id
              }
              onClick={() =>
                onWaive(
                  fine
                )
              }
            >
              {waivingId ===
              fine.id
                ? 'Waiving…'
                : 'Waive Fine'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function StaffFines() {
  const [
    activeTab,
    setActiveTab,
  ] = useState(
    'all'
  );

  const [
    fines,
    setFines,
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
    payingId,
    setPayingId,
  ] = useState(null);

  const [
    waivingId,
    setWaivingId,
  ] = useState(null);

  const [
    waiverReasons,
    setWaiverReasons,
  ] = useState({});

  const finesVersion =
    useResourceVersion(
      'fines'
    );

  const loadFines =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setLoading(true);
        }

        setError('');

        try {
          if (
            activeTab ===
            'all'
          ) {
            const [
              pending,
              paid,
              waived,
            ] =
              await Promise.all([
                listAllFines({
                  status:
                    'pending',

                  limit:
                    100,
                }),

                listAllFines({
                  status:
                    'paid',

                  limit:
                    100,
                }),

                listAllFines({
                  status:
                    'waived',

                  limit:
                    100,
                }),
              ]);

            const combined = [
              ...(pending.fines ||
                []),

              ...(paid.fines ||
                []),

              ...(waived.fines ||
                []),
            ];

            const unique =
              Array.from(
                new Map(
                  combined.map(
                    (fine) => [
                      fine.id,
                      fine,
                    ]
                  )
                ).values()
              );

            unique.sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ) -
                new Date(
                  a.createdAt
                )
            );

            setFines(
              unique
            );
          } else {
            const result =
              await listAllFines({
                status:
                  activeTab,

                limit:
                  100,
              });

            setFines(
              result.fines ||
                []
            );
          }
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load fines.'
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [activeTab]
    );

  useEffect(() => {
    loadFines();
  }, [
    loadFines,
  ]);

  useRealtimeChange(
    finesVersion,
    () => {
      loadFines({
        silent: true,
      });
    }
  );

  const filteredFines =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return fines;
      }

      return fines.filter(
        (fine) => {
          const values = [
            fine.member
              ?.name,

            fine.member
              ?.email,

            fine.member
              ?.phone,

            fine.borrowRecord
              ?.copy
              ?.book
              ?.title,

            fine.borrowRecord
              ?.copy
              ?.book
              ?.isbn,

            fine.borrowRecord
              ?.copy
              ?.barcode,

            fine.reason,

            fine.status,
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
      fines,
      search,
    ]);

  const handleManualPayment =
    async (fine) => {
      setError('');
      setSuccess('');

      setPayingId(
        fine.id
      );

      try {
        await recordManualPayment(
          fine.id
        );

        setSuccess(
          `Payment of ₹${Number(
            fine.amount
          ).toFixed(
            2
          )} recorded for ${fine.member?.name || 'member'}.`
        );

        await loadFines({
          silent: true,
        });
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not record payment.'
        );
      } finally {
        setPayingId(
          null
        );
      }
    };

  const handleWaiverReason =
    (
      fineId,
      value
    ) => {
      setWaiverReasons(
        (previous) => ({
          ...previous,

          [fineId]:
            value,
        })
      );
    };

  const handleWaive =
    async (fine) => {
      setError('');
      setSuccess('');

      const reason =
        (
          waiverReasons[
            fine.id
          ] || ''
        ).trim();

      if (
        reason.length < 3
      ) {
        setError(
          'Enter a waiver reason of at least 3 characters.'
        );

        return;
      }

      setWaivingId(
        fine.id
      );

      try {
        await waiveFine(
          fine.id,
          reason
        );

        setSuccess(
          `Fine of ₹${Number(
            fine.amount
          ).toFixed(
            2
          )} waived for ${fine.member?.name || 'member'}.`
        );

        setWaiverReasons(
          (previous) => {
            const updated = {
              ...previous,
            };

            delete updated[
              fine.id
            ];

            return updated;
          }
        );

        await loadFines({
          silent: true,
        });
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not waive fine.'
        );
      } finally {
        setWaivingId(
          null
        );
      }
    };

  const pendingTotal =
    useMemo(
      () =>
        fines
          .filter(
            (fine) =>
              fine.status ===
              'pending'
          )
          .reduce(
            (
              total,
              fine
            ) =>
              total +
              Number(
                fine.amount ||
                  0
              ),

            0
          ),

      [fines]
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
              Staff Operations
            </p>

            <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
              Fine Management
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              Review overdue charges, record counter payments and manage waivers.
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Loaded Pending Balance
            </p>

            <p className="mt-1 font-serif text-2xl font-semibold text-ink">
              ₹
              {pendingTotal.toFixed(
                2
              )}
            </p>
          </div>
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
                  id="fine-search"
                  label="Search fines"
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
                filteredFines.length
              }{' '}
              fine
              {filteredFines.length ===
              1
                ? ''
                : 's'}
            </p>
          </div>

          <div className="p-5">
            {loading ? (
              <p className="font-mono text-sm text-ink-muted">
                Loading fines…
              </p>
            ) : filteredFines.length ===
              0 ? (
              <div className="rounded-card bg-paper p-6 text-center">
                <p className="text-sm text-ink-muted">
                  No matching fines.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFines.map(
                  (fine) => (
                    <FineCard
                      key={
                        fine.id
                      }
                      fine={
                        fine
                      }
                      payingId={
                        payingId
                      }
                      waivingId={
                        waivingId
                      }
                      waiverReason={
                        waiverReasons[
                          fine.id
                        ]
                      }
                      onWaiverReasonChange={
                        handleWaiverReason
                      }
                      onPay={
                        handleManualPayment
                      }
                      onWaive={
                        handleWaive
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