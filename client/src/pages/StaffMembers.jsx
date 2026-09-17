import {
  useCallback,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import Input
  from '../components/common/Input';

import {
  searchMembers,
  getMemberById,
  updateMembershipStatus,
} from '../api/members.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

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

const statusClasses = (
  status
) => {
  switch (status) {
    case 'active':
      return 'bg-status-successBg text-status-success';

    case 'suspended':
      return 'bg-status-dangerBg text-status-danger';

    case 'expired':
      return 'bg-paper text-ink-muted';

    default:
      return 'bg-paper text-ink-muted';
  }
};

const MemberResult = ({
  member,
  selected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          member
        )
      }
      className={`w-full rounded-card border p-4 text-left transition-colors ${
        selected
          ? 'border-brass bg-brass-light'
          : 'border-hairline bg-white hover:bg-paper'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {member.name}
          </p>

          <p className="mt-1 truncate text-sm text-ink-muted">
            {member.email}
          </p>

          {member.phone && (
            <p className="mt-1 text-xs text-ink-muted">
              {member.phone}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClasses(
            member.membershipStatus
          )}`}
        >
          {
            member.membershipStatus
          }
        </span>
      </div>
    </button>
  );
};

const SummaryCard = ({
  label,
  value,
  danger = false,
}) => {
  return (
    <div className="rounded-card border border-hairline bg-paper p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${
          danger
            ? 'text-status-danger'
            : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
};

const RecentLoan = ({
  loan,
}) => {
  const overdue =
    loan.status ===
      'overdue' ||
    (
      loan.status ===
        'active' &&
      new Date(
        loan.dueAt
      ) <
        new Date()
    );

  return (
    <div className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex flex-col justify-between gap-2 sm:flex-row">
        <div>
          <p className="font-medium text-ink">
            {loan.copy?.book
              ?.title ||
              'Unknown Book'}
          </p>

          <p className="mt-1 font-mono text-xs text-ink-muted">
            {loan.copy
              ?.barcode ||
              '—'}
          </p>
        </div>

        <span
          className={`self-start rounded-full px-2 py-1 font-mono text-[10px] uppercase ${
            overdue
              ? 'bg-status-dangerBg text-status-danger'
              : loan.status ===
                  'returned'
                ? 'bg-status-successBg text-status-success'
                : 'bg-paper text-ink-muted'
          }`}
        >
          {overdue
            ? 'overdue'
            : loan.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span>
          Borrowed:{' '}
          {formatDate(
            loan.borrowedAt
          )}
        </span>

        <span>
          Due:{' '}
          {formatDate(
            loan.dueAt
          )}
        </span>

        {loan.returnedAt && (
          <span>
            Returned:{' '}
            {formatDate(
              loan.returnedAt
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default function StaffMembers() {
  const [
    search,
    setSearch,
  ] = useState('');

  const [
    results,
    setResults,
  ] = useState([]);

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(false);

  const [
    updatingStatus,
    setUpdatingStatus,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const usersVersion =
    useResourceVersion(
      'users'
    );

  const loansVersion =
    useResourceVersion(
      'loans'
    );

  const reservationsVersion =
    useResourceVersion(
      'reservations'
    );

  const finesVersion =
    useResourceVersion(
      'fines'
    );

  const runSearch =
    useCallback(
      async (
        term,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setSearching(
            true
          );
        }

        try {
          const members =
            await searchMembers(
              term,
              20
            );

          setResults(
            members
          );

          return members;
        } catch (err) {
          if (!silent) {
            setError(
              err.response?.data
                ?.message ||
                'Could not search members.'
            );
          }

          return [];
        } finally {
          if (!silent) {
            setSearching(
              false
            );
          }
        }
      },
      []
    );

  const loadProfile =
    useCallback(
      async (
        memberId,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setLoadingProfile(
            true
          );
        }

        setError('');

        try {
          const result =
            await getMemberById(
              memberId
            );

          setProfile(
            result
          );

          setSelectedMemberId(
            memberId
          );
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load member profile.'
          );
        } finally {
          if (!silent) {
            setLoadingProfile(
              false
            );
          }
        }
      },
      []
    );

  useRealtimeChange(
    usersVersion,
    () => {
      const term =
        search.trim();

      if (
        term.length >= 2 &&
        results.length > 0
      ) {
        runSearch(
          term,
          {
            silent: true,
          }
        );
      }

      if (
        selectedMemberId
      ) {
        loadProfile(
          selectedMemberId,
          {
            silent: true,
          }
        );
      }
    }
  );

  useRealtimeChange(
    [
      loansVersion,
      reservationsVersion,
      finesVersion,
    ],
    () => {
      if (
        !selectedMemberId
      ) {
        return;
      }

      loadProfile(
        selectedMemberId,
        {
          silent: true,
        }
      );
    }
  );

  const handleSearch =
    async (event) => {
      event.preventDefault();

      setError('');
      setSuccess('');

      const term =
        search.trim();

      if (
        term.length < 2
      ) {
        setError(
          'Enter at least 2 characters to search.'
        );

        return;
      }

      const members =
        await runSearch(
          term
        );

      if (
        members.length ===
        0
      ) {
        setError(
          'No matching members found.'
        );
      }
    };

  const handleStatusChange =
    async (
      nextStatus
    ) => {
      if (
        !profile?.member
      ) {
        return;
      }

      setUpdatingStatus(
        true
      );

      setError('');
      setSuccess('');

      try {
        await updateMembershipStatus(
          profile.member.id,
          nextStatus
        );

        setSuccess(
          `Membership changed to ${nextStatus}.`
        );

        await loadProfile(
          profile.member.id,
          {
            silent: true,
          }
        );

        setResults(
          (previous) =>
            previous.map(
              (member) =>
                member.id ===
                profile.member.id
                  ? {
                      ...member,
                      membershipStatus:
                        nextStatus,
                    }
                  : member
            )
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not update membership status.'
        );
      } finally {
        setUpdatingStatus(
          false
        );
      }
    };

  const member =
    profile?.member;

  const summary =
    profile?.summary;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Staff Operations
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Member Management
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Search members, review circulation activity and manage membership status.
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

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-card border border-hairline bg-white p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Find Member
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              Search by name, email or phone.
            </p>

            <form
              className="mt-4"
              onSubmit={
                handleSearch
              }
            >
              <Input
                id="member-management-search"
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
                placeholder="Name, email or phone"
              />

              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={
                  searching
                }
              >
                {searching
                  ? 'Searching…'
                  : 'Search Members'}
              </Button>
            </form>

            <div className="mt-5 space-y-2">
              {results.map(
                (result) => (
                  <MemberResult
                    key={
                      result.id
                    }
                    member={
                      result
                    }
                    selected={
                      selectedMemberId ===
                      result.id
                    }
                    onSelect={(
                      selected
                    ) =>
                      loadProfile(
                        selected.id
                      )
                    }
                  />
                )
              )}
            </div>
          </section>

          <section>
            {!member &&
              !loadingProfile && (
                <div className="rounded-card border border-hairline bg-white p-8 text-center">
                  <p className="text-sm text-ink-muted">
                    Search for a member and select their profile.
                  </p>
                </div>
              )}

            {loadingProfile && (
              <div className="rounded-card border border-hairline bg-white p-8">
                <p className="font-mono text-sm text-ink-muted">
                  Loading member profile…
                </p>
              </div>
            )}

            {member &&
              !loadingProfile && (
                <div className="space-y-5">
                  <div className="rounded-card border border-hairline bg-white p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-serif text-xl font-semibold text-ink">
                            {
                              member.name
                            }
                          </h2>

                          <span
                            className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${statusClasses(
                              member.membershipStatus
                            )}`}
                          >
                            {
                              member.membershipStatus
                            }
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-ink-muted">
                          {
                            member.email
                          }
                        </p>

                        <p className="mt-1 text-sm text-ink-muted">
                          {member.phone ||
                            'No phone number'}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-muted">
                          <span>
                            Member since{' '}
                            {formatDate(
                              member.createdAt
                            )}
                          </span>

                          <span>
                            Email:{' '}
                            {member.isEmailVerified
                              ? 'Verified'
                              : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-hairline pt-5">
                      <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                        Membership Controls
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant={
                            member.membershipStatus ===
                            'active'
                              ? 'brass'
                              : 'secondary'
                          }
                          disabled={
                            updatingStatus ||
                            member.membershipStatus ===
                              'active'
                          }
                          onClick={() =>
                            handleStatusChange(
                              'active'
                            )
                          }
                        >
                          Activate
                        </Button>

                        <Button
                          variant="secondary"
                          disabled={
                            updatingStatus ||
                            member.membershipStatus ===
                              'suspended'
                          }
                          onClick={() =>
                            handleStatusChange(
                              'suspended'
                            )
                          }
                        >
                          Suspend
                        </Button>

                        <Button
                          variant="secondary"
                          disabled={
                            updatingStatus ||
                            member.membershipStatus ===
                              'expired'
                          }
                          onClick={() =>
                            handleStatusChange(
                              'expired'
                            )
                          }
                        >
                          Mark Expired
                        </Button>
                      </div>

                      <p className="mt-3 text-xs text-ink-muted">
                        Suspended and expired members cannot borrow or renew books.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard
                      label="Active Loans"
                      value={
                        summary?.activeLoans ??
                        0
                      }
                    />

                    <SummaryCard
                      label="Overdue"
                      value={
                        summary?.overdueLoans ??
                        0
                      }
                      danger={
                        (
                          summary?.overdueLoans ??
                          0
                        ) > 0
                      }
                    />

                    <SummaryCard
                      label="Total Loans"
                      value={
                        summary?.totalLoans ??
                        0
                      }
                    />

                    <SummaryCard
                      label="Reservations"
                      value={
                        summary?.activeReservations ??
                        0
                      }
                    />

                    <SummaryCard
                      label="Pending Fines"
                      value={`₹${Number(
                        summary?.pendingFineBalance ||
                          0
                      ).toFixed(
                        2
                      )}`}
                      danger={
                        Number(
                          summary?.pendingFineBalance ||
                            0
                        ) > 0
                      }
                    />
                  </div>

                  <div className="rounded-card border border-hairline bg-white p-5">
                    <h3 className="font-serif text-lg font-semibold text-ink">
                      Current Reservations
                    </h3>

                    {!profile.reservations
                      ?.length ? (
                      <p className="mt-4 text-sm text-ink-muted">
                        No waiting or ready reservations.
                      </p>
                    ) : (
                      <div className="mt-3">
                        {profile.reservations.map(
                          (
                            reservation
                          ) => (
                            <div
                              key={
                                reservation.id
                              }
                              className="border-b border-hairline py-3 last:border-b-0"
                            >
                              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                                <div>
                                  <p className="font-medium text-ink">
                                    {reservation.book
                                      ?.title ||
                                      'Unknown Book'}
                                  </p>

                                  <p className="mt-1 font-mono text-xs text-ink-muted">
                                    ISBN{' '}
                                    {reservation.book
                                      ?.isbn ||
                                      '—'}
                                  </p>

                                  {reservation
                                    .heldCopy
                                    ?.barcode && (
                                    <p className="mt-1 font-mono text-xs text-ink-muted">
                                      Copy{' '}
                                      {
                                        reservation
                                          .heldCopy
                                          .barcode
                                      }
                                    </p>
                                  )}
                                </div>

                                <span
                                  className={`self-start rounded-full px-2 py-1 font-mono text-[10px] uppercase ${
                                    reservation.status ===
                                    'ready'
                                      ? 'bg-brass-light text-brass-dark'
                                      : 'bg-paper text-ink-muted'
                                  }`}
                                >
                                  {
                                    reservation.status
                                  }
                                </span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-card border border-hairline bg-white p-5">
                    <h3 className="font-serif text-lg font-semibold text-ink">
                      Recent Borrowing History
                    </h3>

                    {!profile.recentLoans
                      ?.length ? (
                      <p className="mt-4 text-sm text-ink-muted">
                        No borrowing history.
                      </p>
                    ) : (
                      <div className="mt-3">
                        {profile.recentLoans.map(
                          (
                            loan
                          ) => (
                            <RecentLoan
                              key={
                                loan.id
                              }
                              loan={
                                loan
                              }
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}