import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import AppShell
  from '../components/layout/AppShell';

import Input
  from '../components/common/Input';

import Button
  from '../components/common/Button';

import StampBadge
  from '../components/common/StampBadge';

import Pagination
  from '../components/common/Pagination';

import BookForm
  from '../features/admin/BookForm';

import {
  listBooks,
  createBook,
  updateBook,
  deleteBook,
} from '../api/books.api';

import {
  addCopies,
} from '../api/borrow.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

export default function AdminBooks() {
  const [
    books,
    setBooks,
  ] = useState([]);

  const [
    meta,
    setMeta,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    searchInput,
    setSearchInput,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    formMode,
    setFormMode,
  ] = useState(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

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
        currentPage,
        currentSearch,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setIsLoading(
            true
          );
        }

        setError('');

        try {
          const {
            books: results,
            meta: resultMeta,
          } =
            await listBooks({
              page:
                currentPage,

              search:
                currentSearch,

              limit: 10,
            });

          setBooks(
            results
          );

          setMeta(
            resultMeta
          );
        } catch (err) {
          setError(
            err.response?.data
              ?.message ||
              'Could not load books.'
          );
        } finally {
          if (!silent) {
            setIsLoading(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    fetchBooks(
      page,
      search
    );
  }, [
    page,
    search,
    fetchBooks,
  ]);

  useRealtimeChange(
    [
      booksVersion,
      inventoryVersion,
    ],
    () => {
      fetchBooks(
        page,
        search,
        {
          silent: true,
        }
      );
    }
  );

  const handleSearchSubmit =
    (event) => {
      event.preventDefault();

      setPage(1);

      setSearch(
        searchInput.trim()
      );
    };

  const handleCreate =
    async (
      payload,
      initialCopies
    ) => {
      setIsSubmitting(
        true
      );

      setError('');

      try {
        const book =
          await createBook(
            payload
          );

        if (
          initialCopies > 0
        ) {
          await addCopies({
            bookId:
              book.id,

            quantity:
              initialCopies,
          });
        }

        setFormMode(
          null
        );

        await fetchBooks(
          page,
          search,
          {
            silent: true,
          }
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not create the book.'
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  const handleUpdate =
    async (payload) => {
      setIsSubmitting(
        true
      );

      setError('');

      try {
        await updateBook(
          formMode.id,
          payload
        );

        setFormMode(
          null
        );

        await fetchBooks(
          page,
          search,
          {
            silent: true,
          }
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not update the book.'
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  const handleDelete =
    async (bookId) => {
      if (
        !window.confirm(
          'Delete this book? This can be reversed by a database admin but not from the UI.'
        )
      ) {
        return;
      }

      setDeletingId(
        bookId
      );

      setError('');

      try {
        await deleteBook(
          bookId
        );

        await fetchBooks(
          page,
          search,
          {
            silent: true,
          }
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not delete the book.'
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Manage Books
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Add, edit, and retire titles in the catalog.
          </p>
        </div>

        {!formMode && (
          <Button
            onClick={() =>
              setFormMode(
                'create'
              )
            }
          >
            Add Book
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}

      {formMode && (
        <div className="mb-6 rounded-card border border-hairline bg-white p-5">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink">
            {formMode ===
            'create'
              ? 'Add a new book'
              : `Edit "${formMode.title}"`}
          </h2>

          <BookForm
            mode={
              formMode ===
              'create'
                ? 'create'
                : 'edit'
            }
            initialValues={
              formMode ===
              'create'
                ? null
                : formMode
            }
            onSubmit={
              formMode ===
              'create'
                ? handleCreate
                : handleUpdate
            }
            onCancel={() =>
              setFormMode(
                null
              )
            }
            isSubmitting={
              isSubmitting
            }
          />
        </div>
      )}

      {!formMode && (
        <>
          <form
            onSubmit={
              handleSearchSubmit
            }
            className="mb-4 flex gap-3"
          >
            <div className="flex-1">
              <Input
                id="admin-search"
                label="Search"
                placeholder="Title or ISBN…"
                value={
                  searchInput
                }
                onChange={(
                  event
                ) =>
                  setSearchInput(
                    event.target
                      .value
                  )
                }
              />
            </div>

            <Button
              type="submit"
              className="self-end"
            >
              Search
            </Button>
          </form>

          <div className="rounded-card border border-hairline bg-white">
            {isLoading ? (
              <p className="p-6 font-mono text-sm text-ink-muted">
                Loading books…
              </p>
            ) : books.length ===
              0 ? (
              <p className="p-6 text-sm text-ink-muted">
                No books found.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-3 font-medium">
                      Title
                    </th>

                    <th className="px-5 py-3 font-medium">
                      ISBN
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Copies
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-hairline">
                  {books.map(
                    (book) => (
                      <tr
                        key={
                          book.id
                        }
                      >
                        <td className="px-5 py-3 font-serif text-ink">
                          {
                            book.title
                          }
                        </td>

                        <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                          {
                            book.isbn
                          }
                        </td>

                        <td className="px-5 py-3">
                          <StampBadge
                            tone={
                              book.availableCopies >
                              0
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {
                              book.availableCopies
                            }
                            /
                            {
                              book.totalCopies
                            }
                          </StampBadge>
                        </td>

                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              className="text-xs"
                              onClick={() =>
                                setFormMode(
                                  book
                                )
                              }
                            >
                              Edit
                            </Button>

                            <Link
                              to={`/admin/books/${book.id}/copies`}
                            >
                              <Button
                                variant="secondary"
                                className="text-xs"
                              >
                                Copies
                              </Button>
                            </Link>

                            <Button
                              variant="secondary"
                              className="text-xs text-status-danger"
                              disabled={
                                deletingId ===
                                book.id
                              }
                              onClick={() =>
                                handleDelete(
                                  book.id
                                )
                              }
                            >
                              {deletingId ===
                              book.id
                                ? 'Deleting…'
                                : 'Delete'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6">
            <Pagination
              meta={
                meta
              }
              onPageChange={
                setPage
              }
            />
          </div>
        </>
      )}
    </AppShell>
  );
}