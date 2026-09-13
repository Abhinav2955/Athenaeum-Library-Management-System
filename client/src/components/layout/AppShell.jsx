import {
  useState,
} from 'react';

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

const navLinkClass =
  ({
    isActive,
  }) =>
    `block rounded-card px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brass-light text-brass-dark'
        : 'text-ink-muted hover:bg-paper hover:text-ink'
    }`;

const NavItem = ({
  to,
  children,
  end = false,
  onClick,
}) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={
      navLinkClass
    }
  >
    {children}
  </NavLink>
);

export default function AppShell({
  children,
}) {
  const {
    user,
    logout,
  } = useAuth();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const isStaff =
    [
      'admin',
      'librarian',
    ].includes(
      user?.role
    );

  const closeMobileMenu =
    () => {
      setMobileOpen(false);
    };

  const handleLogout =
    async () => {
      setMobileOpen(false);
      await logout();
    };

  const navigation = (
    <>
      <div className="space-y-1">
        <NavItem
          to="/dashboard"
          end
          onClick={
            closeMobileMenu
          }
        >
          Dashboard
        </NavItem>

        <NavItem
          to="/catalog"
          onClick={
            closeMobileMenu
          }
        >
          Catalog
        </NavItem>

        <NavItem
          to="/loans"
          onClick={
            closeMobileMenu
          }
        >
          My Loans
        </NavItem>

        <NavItem
          to="/reservations"
          onClick={
            closeMobileMenu
          }
        >
          Reservations
        </NavItem>

        <NavItem
          to="/fines"
          onClick={
            closeMobileMenu
          }
        >
          Fines
        </NavItem>
      </div>

      {isStaff && (
        <div className="mt-6">
          <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Staff
          </p>

          <div className="space-y-1">
            <NavItem
              to="/admin"
              end
              onClick={
                closeMobileMenu
              }
            >
              Overview
            </NavItem>

            <NavItem
              to="/admin/circulation"
              onClick={
                closeMobileMenu
              }
            >
              Circulation Desk
            </NavItem>

            <NavItem
              to="/admin/loans"
              onClick={
                closeMobileMenu
              }
            >
              Loans
            </NavItem>

            <NavItem
              to="/admin/reservations"
              onClick={
                closeMobileMenu
              }
            >
              Reservations
            </NavItem>

            <NavItem
              to="/admin/fines"
              onClick={
                closeMobileMenu
              }
            >
              Fines
            </NavItem>

            <NavItem
              to="/admin/books"
              onClick={
                closeMobileMenu
              }
            >
              Books & Inventory
            </NavItem>

            <NavItem
              to="/admin/users"
              onClick={
                closeMobileMenu
              }
            >
              Users
            </NavItem>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-white lg:flex">
        <div className="border-b border-hairline px-6 py-6">
          <p className="font-serif text-xl font-semibold text-ink">
            Athenaeum
          </p>

          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-brass">
            Library
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {navigation}
        </nav>

        <div className="border-t border-hairline p-4">
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-medium text-ink">
              {user?.name}
            </p>

            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {user?.email}
            </p>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={
              handleLogout
            }
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-hairline bg-white">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={
                  mobileOpen
                    ? 'Close navigation'
                    : 'Open navigation'
                }
                onClick={() =>
                  setMobileOpen(
                    (current) =>
                      !current
                  )
                }
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-card border border-hairline bg-white px-2 text-sm font-medium text-ink hover:bg-paper lg:hidden"
              >
                {mobileOpen
                  ? 'Close'
                  : 'Menu'}
              </button>

              <div className="lg:hidden">
                <p className="font-serif text-lg font-semibold text-ink">
                  Athenaeum
                </p>
              </div>

              <div className="hidden sm:block lg:hidden">
                <span className="text-sm text-ink-muted">
                  {user?.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />

              <Button
                variant="secondary"
                className="hidden text-xs sm:inline-flex lg:hidden"
                onClick={
                  handleLogout
                }
              >
                Sign out
              </Button>
            </div>
          </div>

          {mobileOpen && (
            <div className="border-t border-hairline bg-white px-4 py-4 lg:hidden">
              <div className="mb-4 border-b border-hairline pb-4">
                <p className="text-sm font-medium text-ink">
                  {user?.name}
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {user?.email}
                </p>
              </div>

              <nav className="max-h-[70vh] overflow-y-auto">
                {navigation}

                <Button
                  variant="secondary"
                  className="mt-6 w-full sm:hidden"
                  onClick={
                    handleLogout
                  }
                >
                  Sign out
                </Button>
              </nav>
            </div>
          )}
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}