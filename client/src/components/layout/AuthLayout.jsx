export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-ink px-12 py-10 text-paper lg:flex">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass-light/70">
            Est. Circulation System
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold">
            Athenaeum
          </h1>
        </div>

        <blockquote className="font-serif text-xl italic text-paper/80">
          “A library is the delivery room for the birth of ideas.”

          <footer className="mt-3 font-sans text-sm not-italic text-paper/50">
            — Norman Cousins
          </footer>
        </blockquote>

        <p className="font-mono text-xs text-paper/40">
          Catalog · Circulation · Reservations
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
              Athenaeum
            </p>
          </div>

          <h2 className="font-serif text-2xl font-semibold text-ink">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1.5 text-sm text-ink-muted">
              {subtitle}
            </p>
          )}

          <div className="mt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}