import {
  Link,
} from 'react-router-dom';

import AppShell
  from '../components/layout/AppShell';

export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col items-start py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
          404
        </p>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">
          Page not found
        </h1>

        <p className="mt-3 text-sm leading-6 text-ink-muted">
          The page you were looking for does not exist or may have moved.
        </p>

        <Link
          to="/dashboard"
          className="mt-6 rounded-card bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Back to dashboard
        </Link>
      </div>
    </AppShell>
  );
}