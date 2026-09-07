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
  listAllLoans,
  renewLoan,
  returnLoan,
} from '../api/borrow.api';

const STATUS_TABS = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'active',
    label: 'Active',
  },
  {
    key: 'overdue',
    label: 'Overdue',
  },
  {
    key: 'returned',
    label: 'Returned',
  },
  {
    key: 'lost',
    label: 'Lost',
  },
];

const getEffectiveStatus = (
  loan
) => {
  /*
   * Part 2 made dueAt authoritative.
   *
   * The cron job might not yet have changed
   * active -> overdue, so the UI should also
   * recognize an active loan whose due date
   * has already passed.
   */
  if (
    loan.status === 'active' &&
    new Date(loan.dueAt) <
      new Date()
  ) {
    return 'overdue';
  }

  return loan.status;
};

const getStatusClasses = (
  status
) => {
  switch (status) {
    case 'active':
      return (
        'bg-paper text-ink'
      );

    case 'overdue':
      return (
        'bg-status-dangerBg text-status-danger'
      );

    case 'returned':
      return (
        'bg-status-successBg text-status-success'
      );

    case 'lost':
      return (
        'bg-status-dangerBg text-status-danger'
      );

    default:
      return (
        'bg-paper text-ink-muted'
      );
  }
};

const formatDate = (
  value
) => {
  if (!value) {
    return '—';
  }

  return new Date(
    value
  ).toLocaleDateString();
};

const LoanCard = ({
  loan,
  renewingLoanId,
  returningLoanId,
  onRenew,
  onReturn,
}) => {
  const status =
    getEffectiveStatus(
      loan
    );

  const book =
    loan.copy?.book;

  const borrower =
    loan.borrower;

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
              className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${getStatusClasses(
                status
              )}`}
            >
              {status}
            </span>
          </div>

          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Member
              </p>

              <p className="mt-1 text-ink">
                {borrower?.name ||
                  'Unknown Member'}
              </p>

              <p className="mt-0.5 text-xs text-ink-muted">
                {borrower?.email ||
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
                Copy Barcode
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {loan.copy
                  ?.barcode ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Borrowed
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan.borrowedAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Due
              </p>

              <p
                className={`mt-1 ${
                  status ===
                  'overdue'
                    ? 'font-medium text-status-danger'
                    : 'text-ink'
                }`}
              >
                {formatDate(
                  loan.dueAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Returned
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan.returnedAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Renewals
              </p>

              <p className="mt-1 text-ink">
                {loan.renewedCount ||
                  0}{' '}
                / 2
              </p>
            </div>
          </div>
        </div>

        {(status ===
          'active' ||
          status ===
            'overdue') && (
          <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
            {status ===
              'active' && (
              <Button
                variant="secondary"
                disabled={
                  renewingLoanId ===
                  loan.id
                }
                onClick={() =>
                  onRenew(loan)
                }
              >
                {renewingLoanId ===
                loan.id
                  ? 'Renewing…'
                  : 'Renew'}
              </Button>
            )}

            <Button
              variant="brass"
              disabled={
                returningLoanId ===
                loan.id
              }
              onClick={() =>
                onReturn(loan)
              }
            >
              {returningLoanId ===
              loan.id
                ? 'Returning…'
                : 'Return'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function StaffLoans() {
  const [
    activeTab,
    setActiveTab,
  ] = useState('all');

  const [
    loans,
    setLoans,
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
    renewingLoanId,
    setRenewingLoanId,
  ] = useState(null);

  const [
    returningLoanId,
    setReturningLoanId,
  ] = useState(null);

  const loadLoans =
    useCallback(
      async () => {
        setLoading(true);
        setError('');

        try {
          /*
           * The existing backend endpoint accepts
           * one status at a time.
           *
           * For "All", fetch each relevant status
           * and combine the results.
           *
           * Part 4 intentionally does not alter
           * the already-green backend service.
           */
          if (
            activeTab ===
            'all'
          ) {
            const [
              active,
              overdue,
              returned,
              lost,
            ] =
              await Promise.all([
                listAllLoans({
                  status:
                    'active',
                  limit: 100,
                }),

                listAllLoans({
                  status:
                    'overdue',
                  limit: 100,
                }),

                listAllLoans({
                  status:
                    'returned',
                  limit: 100,
                }),

                listAllLoans({
                  status:
                    'lost',
                  limit: 100,
                }),
              ]);

            const combined = [
              ...(active.records ||
                []),

              ...(overdue.records ||
                []),

              ...(returned.records ||
                []),

              ...(lost.records ||
                []),
            ];

            /*
             * Defensive duplicate removal.
             */
            const unique =
              Array.from(
                new Map(
                  combined.map(
                    (
                      loan
                    ) => [
                      loan.id,
                      loan,
                    ]
                  )
                ).values()
              );

            unique.sort(
              (a, b) =>
                new Date(
                  b.borrowedAt
                ) -
                new Date(
                  a.borrowedAt
                )
            );

            setLoans(
              unique
            );
          } else {
            const result =
              await listAllLoans({
                status:
                  activeTab,

                limit: 100,
              });

            setLoans(
              result.records ||
                []
            );
          }
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load loan records.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [activeTab]
    );

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const filteredLoans =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return loans;
      }

      return loans.filter(
        (loan) => {
          const values = [
            loan.borrower
              ?.name,

            loan.borrower
              ?.email,

            loan.copy
              ?.book
              ?.title,

            loan.copy
              ?.book
              ?.isbn,

            loan.copy
              ?.barcode,

            getEffectiveStatus(
              loan
            ),
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
      loans,
      search,
    ]);

  const handleRenew =
    async (loan) => {
      setError('');
      setSuccess('');

      setRenewingLoanId(
        loan.id
      );

      try {
        const updated =
          await renewLoan(
            loan.id
          );

        setSuccess(
          `"${loan.copy?.book?.title || 'Book'}" renewed successfully. New due date: ${formatDate(
            updated.dueAt
          )}.`
        );

        await loadLoans();
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not renew this loan.'
        );
      } finally {
        setRenewingLoanId(
          null
        );
      }
    };

  const handleReturn =
    async (loan) => {
      setError('');
      setSuccess('');

      setReturningLoanId(
        loan.id
      );

      try {
        const result =
          await returnLoan(
            loan.id
          );

        setSuccess(
          `"${loan.copy?.book?.title || 'Book'}": ${result.message}`
        );

        await loadLoans();
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not return this loan.'
        );
      } finally {
        setReturningLoanId(
          null
        );
      }
    };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Staff Operations
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Loan Management
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Review current and historical circulation records.
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
          <div className="border-b border-hairline p-4 sm:p-5">
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

                        setSuccess(
                          ''
                        );

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
                  id="loan-search"
                  label="Search records"
                  value={search}
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
                filteredLoans.length
              }{' '}
              record
              {filteredLoans.length ===
              1
                ? ''
                : 's'}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <p className="font-mono text-sm text-ink-muted">
                Loading loans…
              </p>
            ) : filteredLoans.length ===
              0 ? (
              <div className="rounded-card bg-paper p-6 text-center">
                <p className="text-sm text-ink-muted">
                  No matching loan records found.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLoans.map(
                  (loan) => (
                    <LoanCard
                      key={
                        loan.id
                      }
                      loan={
                        loan
                      }
                      renewingLoanId={
                        renewingLoanId
                      }
                      returningLoanId={
                        returningLoanId
                      }
                      onRenew={
                        handleRenew
                      }
                      onReturn={
                        handleReturn
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