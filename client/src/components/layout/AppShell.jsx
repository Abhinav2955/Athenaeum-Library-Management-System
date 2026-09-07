import {
  NavLink,
} from 'react-router-dom';

import Button
  from '../common/Button';

import {
  useAuth,
} from '../../features/auth/AuthContext';

import NotificationBell
  from '../../features/notifications/NotificationBell';

const navLinkClass = ({
  isActive,
}) =>
  `rounded-card px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brass-light text-brass-dark'
      : 'text-ink-muted hover:bg-paper hover:text-ink'
  }`;

export default function AppShell({
  children,
}) {
  const {
    user,
    logout,
  } = useAuth();

  const isStaff =
    [
      'admin',
      'librarian',
    ].includes(
      user?.role
    );

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-56 flex-col border-r border-hairline bg-white px-4 py-6 sm:flex">
        <p className="px-3 font-mono text-xs uppercase tracking-[0.2em] text-brass">
          Athenaeum
        </p>

        <nav className="mt-8 flex flex-col gap-1">
          <NavLink
            to="/dashboard"
            className={
              navLinkClass
            }
            end
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/catalog"
            className={
              navLinkClass
            }
          >
            Catalog
          </NavLink>

          <NavLink
            to="/loans"
            className={
              navLinkClass
            }
          >
            My Loans
          </NavLink>

          <NavLink
            to="/reservations"
            className={
              navLinkClass
            }
          >
            Reservations
          </NavLink>

          <NavLink
            to="/fines"
            className={
              navLinkClass
            }
          >
            Fines
          </NavLink>

          {isStaff && (
            <>
              <div className="my-2 border-t border-hairline" />

              <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Staff
              </p>

              <NavLink
                to="/admin"
                className={
                  navLinkClass
                }
                end
              >
                Admin Dashboard
              </NavLink>

              <NavLink
                to="/admin/circulation"
                className={
                  navLinkClass
                }
              >
                Circulation Desk
              </NavLink>

              <NavLink
                to="/admin/books"
                className={
                  navLinkClass
                }
              >
                Manage Books
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-white px-6 py-3 sm:px-8">
          <p className="font-mono text-xs text-ink-muted">
            Signed in as{' '}

            <span className="text-ink">
              {user?.name}
            </span>{' '}

            <span className="text-ink-muted">
              · {user?.role}
            </span>
          </p>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <Button
              variant="secondary"
              onClick={
                logout
              }
              className="text-xs"
            >
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}