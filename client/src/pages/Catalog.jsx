import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import AppShell from '../components/layout/AppShell';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Pagination from '../components/common/Pagination';
import BookCard from '../features/catalog/BookCard';

import {
  listBooks,
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

const SORT_OPTIONS = [
  {
    value: 'createdAt-desc',
    label: 'Newest first',
  },
  {
    value: 'title-asc',
    label: 'Title A–Z',
  },
  {
    value: 'title-desc',
    label: 'Title Z–A',
  },
  {
    value: 'avgRating-desc',
    label: 'Highest rated',
  },
  {
    value: 'publishedYear-desc',
    label: 'Newest publication',
  },
];

export default function Catalog() {
  const [books, setBooks] =
    useState([]);

  const [meta, setMeta] =
    useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [error, setError] =
    useState('');

  const [
    borrowingId,
    setBorrowingId,
  ] = useState(null);

  const [
    borrowErrors,
    setBorrowErrors,
  ] = useState({});

  const [
    reservingId,
    setReservingId,
  ] = useState(null);

  const [
    reserveErrors,
    setReserveErrors,
  ] = useState({});

  const [
    reserveSuccesses,
    setReserveSuccesses,
  ] = useState({});

  const [
    banner,
    setBanner,
  ] = useState({
    type: '',
    message: '',
  });

  const [
    searchInput,
    setSearchInput,
  ] = useState('');

  const [
    filters,
    setFilters,
  ] = useState({
    search: '',
    language: '',
    availableOnly: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
  });

  const booksVersion =
    useResourceVersion(
      'books'
    );

  const inventoryVersion =
    useResourceVersion(
      'inventory'
    );

  const fetchBooks =
    useCallback(
      async (
        query,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setIsLoading(true);
        }

        setError('');

        try {
          const {
            books: results,
            meta: resultMeta,
          } =
            await listBooks(
              query
            );

          setBooks(results);
          setMeta(resultMeta);
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load the catalog. Please try again.'
          );
        } finally {
          if (!silent) {
            setIsLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    fetchBooks(filters);
  }, [
    filters,
    fetchBooks,
  ]);

  useRealtimeChange(
    [
      booksVersion,
      inventoryVersion,
    ],
    () => {
      fetchBooks(
        filters,
        {
          silent: true,
        }
      );
    }
  );

  const handleSearchSubmit =
    (e) => {
      e.preventDefault();

      setFilters(
        (current) => ({
          ...current,
          search:
            searchInput.trim(),
          page: 1,
        })
      );
    };

  const handleSortChange =
    (e) => {
      const [
        sortBy,
        sortOrder,
      ] =
        e.target.value.split(
          '-'
        );

      setFilters(
        (current) => ({
          ...current,
          sortBy,
          sortOrder,
          page: 1,
        })
      );
    };

  const handleAvailabilityToggle =
    () => {
      setFilters(
        (current) => ({
          ...current,

          availableOnly:
            current.availableOnly ===
            'true'
              ? ''
              : 'true',

          page: 1,
        })
      );
    };

  const handlePageChange =
    (page) => {
      setFilters(
        (current) => ({
          ...current,
          page,
        })
      );
    };

  const handleBorrow =
    async (bookId) => {
      setBorrowingId(
        bookId
      );

      setBorrowErrors(
        (prev) => ({
          ...prev,
          [bookId]: '',
        })
      );

      setBanner({
        type: '',
        message: '',
      });

      try {
        await checkoutBook(
          bookId
        );

        setBanner({
          type: 'success',
          message:
            'Checked out — see it under My Loans.',
        });

        await fetchBooks(
          filters,
          {
            silent: true,
          }
        );
      } catch (err) {
        const message =
          err.response?.data
            ?.message ||
          'Could not borrow this book.';

        setBorrowErrors(
          (prev) => ({
            ...prev,
            [bookId]:
              message,
          })
        );
      } finally {
        setBorrowingId(null);
      }
    };

  const handleReserve =
    async (bookId) => {
      setReservingId(
        bookId
      );

      setReserveErrors(
        (prev) => ({
          ...prev,
          [bookId]: '',
        })
      );

      setReserveSuccesses(
        (prev) => ({
          ...prev,
          [bookId]: '',
        })
      );

      try {
        await createReservation(
          bookId
        );

        setReserveSuccesses(
          (prev) => ({
            ...prev,

            [bookId]:
              "You're on the list — see it under Reservations.",
          })
        );
      } catch (err) {
        const message =
          err.response?.data
            ?.message ||
          'Could not reserve this book.';

        setReserveErrors(
          (prev) => ({
            ...prev,
            [bookId]:
              message,
          })
        );
      } finally {
        setReservingId(null);
      }
    };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Catalog
        </h1>

        <p className="mt-1 text-sm text-ink-muted">
          Search and browse the full collection.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-card border border-hairline bg-white p-4 sm:flex-row sm:items-end">
        <form
          onSubmit={
            handleSearchSubmit
          }
          className="flex-1"
        >
          <Input
            id="search"
            label="Search"
            placeholder="Title or ISBN…"
            value={
              searchInput
            }
            onChange={(e) =>
              setSearchInput(
                e.target.value
              )
            }
          />
        </form>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sort"
            className="text-sm font-medium text-ink"
          >
            Sort by
          </label>

          <select
            id="sort"
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={
              handleSortChange
            }
            className="rounded-card border border-hairline bg-white px-3 py-2 text-sm text-ink focus:border-brass"
          >
            {SORT_OPTIONS.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              )
            )}
          </select>
        </div>

        <Button
          type="button"
          variant={
            filters.availableOnly ===
            'true'
              ? 'brass'
              : 'secondary'
          }
          onClick={
            handleAvailabilityToggle
          }
        >
          Available only
        </Button>

        <Button
          type="submit"
          onClick={
            handleSearchSubmit
          }
        >
          Search
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}

      {banner.message && (
        <div
          className={`mb-4 rounded-card border px-3 py-2 text-sm ${
            banner.type ===
            'success'
              ? 'border-status-success bg-status-successBg text-status-success'
              : 'border-status-danger bg-status-dangerBg text-status-danger'
          }`}
        >
          {banner.message}
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-ink-muted">
          Loading catalog…
        </p>
      ) : books.length ===
        0 ? (
        <div className="rounded-card border border-dashed border-hairline bg-white p-8 text-center">
          <p className="text-sm text-ink-muted">
            No books match your search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {books.map(
            (book) => (
              <BookCard
                key={
                  book.id
                }
                book={book}
                onBorrow={
                  handleBorrow
                }
                isBorrowing={
                  borrowingId ===
                  book.id
                }
                borrowError={
                  borrowErrors[
                    book.id
                  ]
                }
                onReserve={
                  handleReserve
                }
                isReserving={
                  reservingId ===
                  book.id
                }
                reserveError={
                  reserveErrors[
                    book.id
                  ]
                }
                reserveSuccess={
                  reserveSuccesses[
                    book.id
                  ]
                }
              />
            )
          )}
        </div>
      )}

      <div className="mt-6">
        <Pagination
          meta={meta}
          onPageChange={
            handlePageChange
          }
        />
      </div>
    </AppShell>
  );
}