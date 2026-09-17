import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useParams,
} from 'react-router-dom';

import AppShell
  from '../components/layout/AppShell';

import Input
  from '../components/common/Input';

import Button
  from '../components/common/Button';

import StampBadge
  from '../components/common/StampBadge';

import {
  getBook,
} from '../api/books.api';

import {
  listCopiesForBook,
  addCopies,
  retireCopy,
  updateCopyStatus,
} from '../api/borrow.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

const statusTone = {
  available:
    'success',

  borrowed:
    'brass',

  reserved:
    'neutral',

  lost:
    'danger',

  damaged:
    'danger',

  under_repair:
    'warning',
};

export default function AdminBookCopies() {
  const {
    bookId,
  } = useParams();

  const [
    book,
    setBook,
  ] = useState(null);

  const [
    copies,
    setCopies,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    quantity,
    setQuantity,
  ] = useState('1');

  const [
    shelfLocation,
    setShelfLocation,
  ] = useState('');

  const [
    isAdding,
    setIsAdding,
  ] = useState(false);

  const [
    workingCopyId,
    setWorkingCopyId,
  ] = useState(null);

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
          setIsLoading(
            true
          );
        }

        setError('');

        try {
          const [
            bookRes,
            copiesRes,
          ] =
            await Promise.all([
              getBook(
                bookId
              ),

              listCopiesForBook(
                bookId
              ),
            ]);

          setBook(
            bookRes
          );

          setCopies(
            copiesRes
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
      [bookId]
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

  const handleAddCopies =
    async (event) => {
      event.preventDefault();

      setIsAdding(true);
      setError('');
      setSuccess('');

      try {
        await addCopies({
          bookId,

          quantity:
            Number(
              quantity
            ) || 1,

          shelfLocation:
            shelfLocation
              .trim() ||
            undefined,
        });

        setQuantity('1');
        setShelfLocation('');

        setSuccess(
          'Physical copies added successfully.'
        );

        await fetchData({
          silent: true,
        });
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not add copies.'
        );
      } finally {
        setIsAdding(false);
      }
    };

  const changeStatus =
    async (
      copy,
      status
    ) => {
      setWorkingCopyId(
        copy.id
      );

      setError('');
      setSuccess('');

      try {
        await updateCopyStatus(
          copy.id,
          status
        );

        setSuccess(
          `${copy.barcode} changed to ${status.replace(
            '_',
            ' '
          )}.`
        );

        await fetchData({
          silent: true,
        });
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not update copy status.'
        );
      } finally {
        setWorkingCopyId(
          null
        );
      }
    };

  const handleRetire =
    async (copy) => {
      if (
        !window.confirm(
          'Retire this available copy as lost? This removes it from active inventory.'
        )
      ) {
        return;
      }

      setWorkingCopyId(
        copy.id
      );

      setError('');
      setSuccess('');

      try {
        await retireCopy(
          copy.id
        );

        setSuccess(
          `${copy.barcode} retired from inventory.`
        );

        await fetchData({
          silent: true,
        });
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not retire this copy.'
        );
      } finally {
        setWorkingCopyId(
          null
        );
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

  return (
    <AppShell>
      <Link
        to="/admin/books"
        className="text-sm font-medium text-brass hover:underline"
      >
        ← Back to Manage Books
      </Link>

      <div className="mb-6 mt-3">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          {book?.title}
        </h1>

        <p className="mt-1 font-mono text-xs text-ink-muted">
          ISBN{' '}
          {book?.isbn}
        </p>

        <p className="mt-2 text-sm text-ink-muted">
          {book?.availableCopies}{' '}
          available /{' '}
          {book?.totalCopies}{' '}
          active copies
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-card border border-status-success bg-status-successBg px-3 py-2 text-sm text-status-success">
          {success}
        </div>
      )}

      <div className="mb-6 rounded-card border border-hairline bg-white p-5">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">
          Add Copies
        </h2>

        <form
          onSubmit={
            handleAddCopies
          }
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="w-32">
            <Input
              id="quantity"
              label="Quantity"
              type="number"
              min="1"
              max="50"
              value={
                quantity
              }
              onChange={(
                event
              ) =>
                setQuantity(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div className="flex-1">
            <Input
              id="shelfLocation"
              label="Shelf location (optional)"
              placeholder="e.g. Fiction — Aisle 3"
              value={
                shelfLocation
              }
              onChange={(
                event
              ) =>
                setShelfLocation(
                  event.target
                    .value
                )
              }
            />
          </div>

          <Button
            type="submit"
            disabled={
              isAdding
            }
          >
            {isAdding
              ? 'Adding…'
              : 'Add'}
          </Button>
        </form>
      </div>

      <div className="rounded-card border border-hairline bg-white">
        {copies.length ===
        0 ? (
          <p className="p-6 text-sm text-ink-muted">
            No physical copies yet — add some above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3 font-medium">
                    Barcode
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Shelf
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Status
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-hairline">
                {copies.map(
                  (copy) => (
                    <tr
                      key={
                        copy.id
                      }
                    >
                      <td className="px-5 py-3 font-mono text-xs text-ink">
                        {
                          copy.barcode
                        }
                      </td>

                      <td className="px-5 py-3 text-ink-muted">
                        {copy.shelfLocation ||
                          '—'}
                      </td>

                      <td className="px-5 py-3">
                        <StampBadge
                          tone={
                            statusTone[
                              copy.status
                            ] ||
                            'neutral'
                          }
                        >
                          {copy.status.replace(
                            '_',
                            ' '
                          )}
                        </StampBadge>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          {copy.status ===
                            'available' && (
                            <>
                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    copy,
                                    'damaged'
                                  )
                                }
                              >
                                Mark Damaged
                              </Button>

                              <Button
                                variant="secondary"
                                className="text-xs text-status-danger"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  handleRetire(
                                    copy
                                  )
                                }
                              >
                                Retire (Lost)
                              </Button>
                            </>
                          )}

                          {copy.status ===
                            'damaged' && (
                            <>
                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    copy,
                                    'under_repair'
                                  )
                                }
                              >
                                Send to Repair
                              </Button>

                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    copy,
                                    'available'
                                  )
                                }
                              >
                                Return to Available
                              </Button>
                            </>
                          )}

                          {copy.status ===
                            'under_repair' && (
                            <>
                              <Button
                                variant="brass"
                                className="text-xs"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    copy,
                                    'available'
                                  )
                                }
                              >
                                Repair Complete
                              </Button>

                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={
                                  workingCopyId ===
                                  copy.id
                                }
                                onClick={() =>
                                  changeStatus(
                                    copy,
                                    'damaged'
                                  )
                                }
                              >
                                Repair Failed
                              </Button>
                            </>
                          )}

                          {[
                            'borrowed',
                            'reserved',
                            'lost',
                          ].includes(
                            copy.status
                          ) && (
                            <span className="text-xs text-ink-muted">
                              No maintenance action available
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}