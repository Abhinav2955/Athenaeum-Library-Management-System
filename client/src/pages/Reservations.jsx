import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Pagination
  from '../components/common/Pagination';

import ReservationRow
  from '../features/reservations/ReservationRow';

import {
  listMyReservations,
  cancelReservation,
} from '../api/reservations.api';

import {
  useNotifications,
} from '../features/notifications/NotificationContext';

const FILTERS = [
  {
    key: 'all',
    label: 'All',
  },
  {
    key: 'waiting',
    label: 'Waiting',
  },
  {
    key: 'ready',
    label: 'Ready',
  },
  {
    key: 'fulfilled',
    label: 'Collected',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
  },
  {
    key: 'expired',
    label: 'Expired',
  },
];

export default function Reservations() {
  const [
    reservations,
    setReservations,
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
    success,
    setSuccess,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    activeFilter,
    setActiveFilter,
  ] = useState('all');

  const [
    cancellingId,
    setCancellingId,
  ] = useState(null);

  const [
    cancelErrors,
    setCancelErrors,
  ] = useState({});

  const {
    notifications,
  } = useNotifications();

  const lastReadyNotificationId =
    useRef(null);

  const fetchReservations =
    useCallback(
      async (
        currentPage,
        showLoading = true
      ) => {
        if (showLoading) {
          setIsLoading(true);
        }

        setError('');

        try {
          const {
            reservations:
              results,

            meta:
              resultMeta,
          } =
            await listMyReservations({
              page:
                currentPage,

              limit: 50,
            });

          setReservations(
            results
          );

          setMeta(
            resultMeta
          );
        } catch (err) {
          setError(
            err.response
              ?.data
              ?.message ||
              'Could not load your reservations.'
          );
        } finally {
          if (showLoading) {
            setIsLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    fetchReservations(
      page
    );
  }, [
    page,
    fetchReservations,
  ]);

  useEffect(() => {
    const readyNotification =
      notifications.find(
        (notification) =>
          notification.type ===
          'reservation_ready'
      );

    if (!readyNotification) {
      return;
    }

    if (
      lastReadyNotificationId.current ===
      readyNotification.id
    ) {
      return;
    }

    lastReadyNotificationId.current =
      readyNotification.id;

    fetchReservations(
      page,
      false
    );
  }, [
    notifications,
    page,
    fetchReservations,
  ]);

  const filteredReservations =
    useMemo(() => {
      if (
        activeFilter ===
        'all'
      ) {
        return reservations;
      }

      return reservations.filter(
        (reservation) =>
          reservation.status ===
          activeFilter
      );
    }, [
      reservations,
      activeFilter,
    ]);

  const handleCancel =
    async (
      reservationId
    ) => {
      setSuccess('');

      setCancellingId(
        reservationId
      );

      setCancelErrors(
        (prev) => ({
          ...prev,

          [reservationId]:
            '',
        })
      );

      try {
        await cancelReservation(
          reservationId
        );

        setSuccess(
          'Reservation cancelled successfully.'
        );

        await fetchReservations(
          page,
          false
        );
      } catch (err) {
        const message =
          err.response
            ?.data
            ?.message ||
          'Could not cancel this reservation.';

        setCancelErrors(
          (prev) => ({
            ...prev,

            [reservationId]:
              message,
          })
        );
      } finally {
        setCancellingId(
          null
        );
      }
    };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-ink">
            My Reservations
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Track waiting lists, ready pickups and reservation history.
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

        <div className="mb-4 flex flex-wrap gap-1">
          {FILTERS.map(
            (filter) => (
              <button
                key={
                  filter.key
                }
                type="button"
                onClick={() =>
                  setActiveFilter(
                    filter.key
                  )
                }
                className={`rounded-card px-3 py-2 text-sm font-medium transition-colors ${
                  activeFilter ===
                  filter.key
                    ? 'bg-brass-light text-brass-dark'
                    : 'text-ink-muted hover:bg-white hover:text-ink'
                }`}
              >
                {filter.label}
              </button>
            )
          )}
        </div>

        <div className="rounded-card border border-hairline bg-white px-5">
          {isLoading ? (
            <p className="py-6 font-mono text-sm text-ink-muted">
              Loading your reservations…
            </p>
          ) : filteredReservations.length ===
            0 ? (
            <p className="py-6 text-sm text-ink-muted">
              No reservations in this category.
            </p>
          ) : (
            filteredReservations.map(
              (
                reservation
              ) => (
                <ReservationRow
                  key={
                    reservation.id
                  }
                  reservation={
                    reservation
                  }
                  onCancel={
                    handleCancel
                  }
                  isCancelling={
                    cancellingId ===
                    reservation.id
                  }
                  cancelError={
                    cancelErrors[
                      reservation.id
                    ]
                  }
                />
              )
            )
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
      </div>
    </AppShell>
  );
}