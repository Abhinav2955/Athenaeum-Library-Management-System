import {
  Navigate,
  useLocation,
} from 'react-router-dom';

import {
  useAuth,
} from '../features/auth/AuthContext';

export default function ProtectedRoute({
  children,
  roles,
}) {
  const {
    user,
    loading,
  } = useAuth();

  const location =
    useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="text-center">
          <p className="font-serif text-xl font-semibold text-ink">
            Athenaeum
          </p>

          <p className="mt-2 text-sm text-ink-muted">
            Loading your account…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{
          from:
            location,
        }}
        replace
      />
    );
  }

  if (
    roles &&
    !roles.includes(
      user.role
    )
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}