import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import {
  useParams,
  Link,
} from 'react-router-dom';

import AppShell from '../components/layout/AppShell';
import Button from '../components/common/Button';
import StampBadge from '../components/common/StampBadge';

import {
  getBook,
  getRecommendations,
} from '../api/books.api';

import {
  checkoutBook,
} from '../api/borrow.api';

import {
  createReservation,
} from '../api/reservations.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

export default function BookDetail() {
  const { id } =
    useParams();

  const [book, setBook] =
    useState(null);

  const [related, setRelated] =
    useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [error, setError] =
    useState('');

  const [
    isActing,
    setIsActing,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState('');

  const [
    actionSuccess,
    setActionSuccess,
  ] = useState('');

  const booksVersion =
    useResourceVersion(
      'books'
    );

  const inventoryVersion =
    useResourceVersion(
      'inventory'
    );

  const fetchData =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setIsLoading(true);
        }

        setError('');

        try {
          const [
            bookRes,
            relatedRes,
          ] =
            await Promise.all([
              getBook(id),
              getRecommendations(
                id
              ),
            ]);

          setBook(bookRes);
          setRelated(
            relatedRes
          );
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load this book.'
          );
        } finally {
          if (!silent) {
            setIsLoading(
              false
            );
          }
        }
      },
      [id]
    );

  useEffect(() => {
    fetchData();
  }, [
    fetchData,
  ]);

  useRealtimeChange(
    [
      booksVersion,
      inventoryVersion,
    ],
    () => {
      fetchData({
        silent: true,
      });
    }
  );

  const handleBorrow =
    async () => {
      setIsActing(true);
      setActionError('');
      setActionSuccess('');

      try {
        await checkoutBook(
          id
        );

        setActionSuccess(
          'Checked out — see it under My Loans.'
        );

        await fetchData({
          silent: true,
        });
      } catch (err) {
        setActionError(
          err.response?.data
            ?.message ||
            'Could not borrow this book.'
        );
      } finally {
        setIsActing(false);
      }
    };

  const handleReserve =
    async () => {
      setIsActing(true);
      setActionError('');
      setActionSuccess('');

      try {
        await createReservation(
          id
        );

        setActionSuccess(
          "You're on the list — see it under Reservations."
        );
      } catch (err) {
        setActionError(
          err.response?.data
            ?.message ||
            'Could not reserve this book.'
        );
      } finally {
        setIsActing(false);
      }
    };

  if (isLoading) {
    return (
      <AppShell>
        <p className="font-mono text-sm text-ink-muted">
          Loading…
        </p>
      </AppShell>
    );
  }

  if (error || !book) {
    return (
      <AppShell>
        <div className="rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error ||
            'Book not found.'}
        </div>
      </AppShell>
    );
  }

  const isAvailable =
    book.availableCopies >
    0;

  const authorNames =
    book.authors
      ?.map(
        (author) =>
          author.name
      )
      .join(', ') ||
    'Unknown author';

  return (
    <AppShell>
      <Link
        to="/catalog"
        className="text-sm font-medium text-brass hover:underline"
      >
        ← Back to Catalog
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="flex h-48 w-32 flex-shrink-0 items-center justify-center rounded-sm border border-hairline bg-brass-light font-serif text-3xl text-brass-dark">
          {book.title
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div className="flex-1">
          <h1 className="font-serif text-2xl font-semibold text-ink">
            {book.title}
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            {authorNames}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isAvailable ? (
              <StampBadge tone="success">
                {
                  book.availableCopies
                }{' '}
                Available
              </StampBadge>
            ) : (
              <StampBadge tone="danger">
                Checked Out
              </StampBadge>
            )}

            {book.categories?.map(
              (category) => (
                <StampBadge
                  key={
                    category.id
                  }
                  tone="neutral"
                >
                  {
                    category.name
                  }
                </StampBadge>
              )
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs text-ink-muted sm:grid-cols-3">
            <div>
              <dt className="uppercase">
                ISBN
              </dt>

              <dd className="text-ink">
                {book.isbn}
              </dd>
            </div>

            {book.publisher && (
              <div>
                <dt className="uppercase">
                  Publisher
                </dt>

                <dd className="text-ink">
                  {
                    book.publisher
                  }
                </dd>
              </div>
            )}

            {book.publishedYear && (
              <div>
                <dt className="uppercase">
                  Published
                </dt>

                <dd className="text-ink">
                  {
                    book.publishedYear
                  }
                </dd>
              </div>
            )}

            {book.language && (
              <div>
                <dt className="uppercase">
                  Language
                </dt>

                <dd className="text-ink">
                  {
                    book.language
                  }
                </dd>
              </div>
            )}
          </dl>

          {book.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink">
              {
                book.description
              }
            </p>
          )}

          {actionError && (
            <p className="mt-3 text-sm text-status-danger">
              {actionError}
            </p>
          )}

          {actionSuccess && (
            <p className="mt-3 text-sm text-status-success">
              {actionSuccess}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            {isAvailable ? (
              <Button
                disabled={
                  isActing
                }
                onClick={
                  handleBorrow
                }
              >
                {isActing
                  ? 'Borrowing…'
                  : 'Borrow'}
              </Button>
            ) : (
              <Button
                variant="brass"
                disabled={
                  isActing
                }
                onClick={
                  handleReserve
                }
              >
                {isActing
                  ? 'Reserving…'
                  : 'Reserve'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {related.length >
        0 && (
        <div className="mt-10">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Readers Also Borrowed
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map(
              ({
                book:
                  relatedBook,
                coBorrowerCount,
              }) => (
                <Link
                  key={
                    relatedBook.id
                  }
                  to={`/catalog/${relatedBook.id}`}
                  className="rounded-card border border-hairline bg-white p-4 hover:border-brass"
                >
                  <div className="flex h-16 w-12 items-center justify-center rounded-sm border border-hairline bg-brass-light font-serif text-xs text-brass-dark">
                    {relatedBook.title
                      .slice(
                        0,
                        1
                      )
                      .toUpperCase()}
                  </div>

                  <p className="mt-2 font-serif text-sm font-semibold text-ink">
                    {
                      relatedBook.title
                    }
                  </p>

                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    Shared by{' '}
                    {
                      coBorrowerCount
                    }{' '}
                    reader
                    {coBorrowerCount ===
                    1
                      ? ''
                      : 's'}
                  </p>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}