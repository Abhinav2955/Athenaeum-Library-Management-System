import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import AppShell from '../components/layout/AppShell';
import StampBadge from '../components/common/StampBadge';
import Pagination from '../components/common/Pagination';
import FineRow from '../features/fines/FineRow';

import {
  loadRazorpayScript,
} from '../features/fines/loadRazorpayScript';

import {
  listMyFines,
  createPaymentOrder,
  verifyPayment,
} from '../api/fines.api';

import {
  useAuth,
} from '../features/auth/AuthContext';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

export default function Fines() {
  const { user } =
    useAuth();

  const [fines, setFines] =
    useState([]);

  const [
    pendingBalance,
    setPendingBalance,
  ] = useState(0);

  const [meta, setMeta] =
    useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [error, setError] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [
    payingId,
    setPayingId,
  ] = useState(null);

  const [
    payErrors,
    setPayErrors,
  ] = useState({});

  const finesVersion =
    useResourceVersion(
      'fines'
    );

  const fetchFines = useCallback(
    async (
      currentPage,
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
          fines: results,
          pendingBalance:
            balance,
          meta: resultMeta,
        } =
          await listMyFines({
            page:
              currentPage,
          });

        setFines(results);
        setPendingBalance(
          balance
        );
        setMeta(resultMeta);
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not load your fines.'
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
    fetchFines(page);
  }, [
    page,
    fetchFines,
  ]);

  useRealtimeChange(
    finesVersion,
    () => {
      fetchFines(
        page,
        {
          silent: true,
        }
      );
    }
  );

  const handlePay =
    async (fine) => {
      setPayingId(
        fine.id
      );

      setPayErrors(
        (prev) => ({
          ...prev,
          [fine.id]: '',
        })
      );

      try {
        const scriptLoaded =
          await loadRazorpayScript();

        if (!scriptLoaded) {
          throw new Error(
            'Could not load the payment popup. Check your connection.'
          );
        }

        const {
          orderId,
          amount,
          currency,
          keyId,
        } =
          await createPaymentOrder(
            fine.id
          );

        const checkout =
          new window.Razorpay({
            key: keyId,
            amount,
            currency,
            name:
              'Athenaeum Library',
            description:
              fine.reason,
            order_id:
              orderId,

            prefill: {
              name:
                user?.name,
              email:
                user?.email,
            },

            theme: {
              color:
                '#A8763E',
            },

            handler:
              async (
                response
              ) => {
                try {
                  await verifyPayment(
                    fine.id,
                    response
                  );

                  await fetchFines(
                    page,
                    {
                      silent:
                        true,
                    }
                  );
                } catch {
                  setPayErrors(
                    (prev) => ({
                      ...prev,
                      [fine.id]:
                        'Payment verification failed. Contact staff if you were charged.',
                    })
                  );
                } finally {
                  setPayingId(
                    null
                  );
                }
              },

            modal: {
              ondismiss: () =>
                setPayingId(
                  null
                ),
            },
          });

        checkout.open();
      } catch (err) {
        const message =
          err.response?.data
            ?.message ||
          err.message ||
          'Could not start the payment.';

        setPayErrors(
          (prev) => ({
            ...prev,
            [fine.id]:
              message,
          })
        );

        setPayingId(null);
      }
    };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Fines
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Overdue charges and payment history.
          </p>
        </div>

        {!isLoading && (
          <div className="text-right">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
              Pending balance
            </p>

            <p className="font-serif text-2xl font-semibold text-ink">
              ₹
              {pendingBalance.toFixed(
                2
              )}
            </p>
          </div>
        )}
      </div>

      {pendingBalance >
        10 && (
        <div className="mb-4 rounded-card border border-status-warning bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          Your pending balance
          exceeds ₹10.00 — new
          checkouts are blocked
          until this is paid down.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="rounded-card border border-hairline bg-white px-5">
        {isLoading ? (
          <p className="py-6 font-mono text-sm text-ink-muted">
            Loading your fines…
          </p>
        ) : fines.length ===
          0 ? (
          <p className="py-6 text-sm text-ink-muted">
            No fines on record —{' '}
            <StampBadge tone="success">
              Good Standing
            </StampBadge>
          </p>
        ) : (
          fines.map(
            (fine) => (
              <FineRow
                key={
                  fine.id
                }
                fine={fine}
                onPay={
                  handlePay
                }
                isPaying={
                  payingId ===
                  fine.id
                }
                payError={
                  payErrors[
                    fine.id
                  ]
                }
              />
            )
          )
        )}
      </div>

      <div className="mt-6">
        <Pagination
          meta={meta}
          onPageChange={
            setPage
          }
        />
      </div>
    </AppShell>
  );
}