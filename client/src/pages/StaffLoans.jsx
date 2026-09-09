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
  markLoanLost,
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
  if (
    loan.status ===
      'active' &&
    new Date(
      loan.dueAt
    ) <
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
      return 'bg-paper text-ink';

    case 'overdue':
      return 'bg-status-dangerBg text-status-danger';

    case 'returned':
      return 'bg-status-successBg text-status-success';

    case 'lost':
      return 'bg-status-dangerBg text-status-danger';

    default:
      return 'bg-paper text-ink-muted';
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
  workingLoanId,
  onRenew,
  onReturn,
  onLost,
}) => {
  const status =
    getEffectiveStatus(
      loan
    );

  const book =
    loan.copy?.book;

  const borrower =
    loan.borrower;

  const actionable =
    [
      'active',
      'overdue',
    ].includes(
      status
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
              className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${getStatusClasses(
                status
              )}`}
            >
              {status}
            </span>
          </div>

          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Member
              </p>

              <p className="mt-1 text-ink">
                {borrower?.name ||
                  'Unknown'}
              </p>

              <p className="mt-1 text-xs text-ink-muted">
                {borrower?.email ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                ISBN
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {book?.isbn ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Barcode
              </p>

              <p className="mt-1 font-mono text-xs text-ink">
                {loan.copy?.barcode ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Borrowed
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan.borrowedAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
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
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Returned
              </p>

              <p className="mt-1 text-ink">
                {formatDate(
                  loan.returnedAt
                )}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Renewals
              </p>

              <p className="mt-1 text-ink">
                {loan.renewedCount ||
                  0}{' '}
                / 2
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase text-ink-muted">
                Copy Condition
              </p>

              <p className="mt-1 capitalize text-ink">
                {loan.copy?.status
                  ?.replace(
                    '_',
                    ' '
                  ) ||
                  '—'}
              </p>
            </div>
          </div>
        </div>

        {actionable && (
          <div className="flex shrink-0 flex-wrap gap-2 lg:w-44 lg:flex-col">
            {status ===
              'active' && (
              <Button
                variant="secondary"
                disabled={
                  workingLoanId ===
                  loan.id
                }
                onClick={() =>
                  onRenew(
                    loan
                  )
                }
              >
                Renew
              </Button>
            )}

            <Button
              variant="brass"
              disabled={
                workingLoanId ===
                loan.id
              }
              onClick={() =>
                onReturn(
                  loan,
                  'good'
                )
              }
            >
              Return Good
            </Button>

            <Button
              variant="secondary"
              disabled={
                workingLoanId ===
                loan.id
              }
              onClick={() => {
                if (
                  window.confirm(
                    'Return this physical copy as damaged? It will be removed from available circulation.'
                  )
                ) {
                  onReturn(
                    loan,
                    'damaged'
                  );
                }
              }}
            >
              Return Damaged
            </Button>

            <Button
              variant="secondary"
              className="text-status-danger"
              disabled={
                workingLoanId ===
                loan.id
              }
              onClick={() => {
                if (
                  window.confirm(
                    'Mark this checked-out book as lost? The physical copy will be removed from active inventory.'
                  )
                ) {
                  onLost(
                    loan
                  );
                }
              }}
            >
              Mark Lost
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
    workingLoanId,
    setWorkingLoanId,
  ] = useState(null);

  const loadLoans =
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

            const unique =
              Array.from(
                new Map(
                  combined.map(
                    (loan) => [
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
          setLoading(false);
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
            loan.borrower?.name,
            loan.borrower?.email,
            loan.copy?.book?.title,
            loan.copy?.book?.isbn,
            loan.copy?.barcode,
            loan.copy?.status,
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

      setWorkingLoanId(
        loan.id
      );

      try {
        const updated =
          await renewLoan(
            loan.id
          );

        setSuccess(
          `"${loan.copy?.book?.title || 'Book'}" renewed. New due date: ${formatDate(
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
        setWorkingLoanId(
          null
        );
      }
    };

  const handleReturn =
    async (
      loan,
      condition
    ) => {
      setError('');
      setSuccess('');

      setWorkingLoanId(
        loan.id
      );

      try {
        const result =
          await returnLoan(
            loan.id,
            condition
          );

        setSuccess(
          result.message
        );

        await loadLoans();
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not return this loan.'
        );
      } finally {
        setWorkingLoanId(
          null
        );
      }
    };

  const handleLost =
    async (loan) => {
      setError('');
      setSuccess('');

      setWorkingLoanId(
        loan.id
      );

      try {
        await markLoanLost(
          loan.id
        );

        setSuccess(
          `"${loan.copy?.book?.title || 'Book'}" marked as lost.`
        );

        await loadLoans();
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not mark this loan lost.'
        );
      } finally {
        setWorkingLoanId(
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
            Review circulation records and handle returns, damage and lost books.
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
                      className={`rounded-card px-3 py-2 text-sm font-medium ${
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

          <div className="p-5">
            {loading ? (
              <p className="font-mono text-sm text-ink-muted">
                Loading loans…
              </p>
            ) : filteredLoans.length ===
              0 ? (
              <p className="rounded-card bg-paper p-6 text-sm text-ink-muted">
                No matching loan records found.
              </p>
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
                      workingLoanId={
                        workingLoanId
                      }
                      onRenew={
                        handleRenew
                      }
                      onReturn={
                        handleReturn
                      }
                      onLost={
                        handleLost
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