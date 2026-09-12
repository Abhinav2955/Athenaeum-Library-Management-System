import {
  Link,
} from 'react-router-dom';

import AppShell
  from '../components/layout/AppShell';

import StampBadge
  from '../components/common/StampBadge';

import {
  useAuth,
} from '../features/auth/AuthContext';

export default function Dashboard() {
  const {
    user,
  } = useAuth();

  const firstName =
    user?.name
      ?.trim()
      ?.split(' ')[0] ||
    'Member';

  const membershipStatus =
    user?.membershipStatus ||
    'active';

  const membershipLabel =
    membershipStatus
      .replace(/_/g, ' ')
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );

  const membershipTone =
    membershipStatus ===
    'active'
      ? 'success'
      : membershipStatus ===
          'suspended'
        ? 'danger'
        : 'neutral';

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-7">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Member Portal
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Welcome back,{' '}
            {firstName}
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Browse books, manage loans,
            track reservations and review
            your account activity.
          </p>
        </div>

        <section className="rounded-card border border-hairline bg-white p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink">
                My Account
              </h2>

              <p className="mt-1 text-sm text-ink-muted">
                Your library membership details.
              </p>
            </div>

            <StampBadge
              tone={
                membershipTone
              }
            >
              {membershipLabel}
            </StampBadge>
          </div>

          <div className="mt-5 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Name
              </p>

              <p className="mt-1 text-sm font-medium text-ink">
                {user?.name ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Email
              </p>

              <p className="mt-1 break-all text-sm font-medium text-ink">
                {user?.email ||
                  '—'}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Membership
              </p>

              <p className="mt-1 text-sm font-medium text-ink">
                {membershipLabel}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Library
            </h2>

            <p className="mt-1 text-sm text-ink-muted">
              Quick access to your library activity.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Link
              to="/catalog"
              className="rounded-card border border-hairline bg-white p-5 transition-colors hover:border-brass"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
                Discover
              </p>

              <h3 className="mt-3 font-serif text-lg font-semibold text-ink">
                Browse Catalog
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Search books and check
                availability across the library.
              </p>

              <p className="mt-5 text-sm font-medium text-brass">
                Browse books →
              </p>
            </Link>

            <Link
              to="/loans"
              className="rounded-card border border-hairline bg-white p-5 transition-colors hover:border-brass"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
                Borrowing
              </p>

              <h3 className="mt-3 font-serif text-lg font-semibold text-ink">
                My Loans
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                View borrowed books,
                due dates and renewal options.
              </p>

              <p className="mt-5 text-sm font-medium text-brass">
                View loans →
              </p>
            </Link>

            <Link
              to="/reservations"
              className="rounded-card border border-hairline bg-white p-5 transition-colors hover:border-brass"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
                Holds
              </p>

              <h3 className="mt-3 font-serif text-lg font-semibold text-ink">
                Reservations
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Track your waiting list
                position and ready pickups.
              </p>

              <p className="mt-5 text-sm font-medium text-brass">
                View reservations →
              </p>
            </Link>

            <Link
              to="/fines"
              className="rounded-card border border-hairline bg-white p-5 transition-colors hover:border-brass"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
                Payments
              </p>

              <h3 className="mt-3 font-serif text-lg font-semibold text-ink">
                Fines
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Review outstanding and
                previous library fines.
              </p>

              <p className="mt-5 text-sm font-medium text-brass">
                View fines →
              </p>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}