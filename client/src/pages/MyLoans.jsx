import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import AppShell from '../components/layout/AppShell';
import Pagination from '../components/common/Pagination';
import LoanRow from '../features/borrowing/LoanRow';

import {
  listMyLoans,
  renewLoan,
} from '../api/borrow.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

export default function MyLoans() {
  const [records, setRecords] =
    useState([]);

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
    renewingId,
    setRenewingId,
  ] = useState(null);

  const [
    renewErrors,
    setRenewErrors,
  ] = useState({});

  const loansVersion =
    useResourceVersion(
      'loans'
    );

  const fetchLoans = useCallback(
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
          records: results,
          meta: resultMeta,
        } =
          await listMyLoans({
            page:
              currentPage,
          });

        setRecords(results);
        setMeta(resultMeta);
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not load your loans.'
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
    fetchLoans(page);
  }, [
    page,
    fetchLoans,
  ]);

  useRealtimeChange(
    loansVersion,
    () => {
      fetchLoans(
        page,
        {
          silent: true,
        }
      );
    }
  );

  const handleRenew =
    async (recordId) => {
      setRenewingId(
        recordId
      );

      setRenewErrors(
        (prev) => ({
          ...prev,
          [recordId]: '',
        })
      );

      try {
        await renewLoan(
          recordId
        );

        await fetchLoans(
          page,
          {
            silent: true,
          }
        );
      } catch (err) {
        const message =
          err.response?.data
            ?.message ||
          'Could not renew this loan.';

        setRenewErrors(
          (prev) => ({
            ...prev,
            [recordId]:
              message,
          })
        );
      } finally {
        setRenewingId(null);
      }
    };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          My Loans
        </h1>

        <p className="mt-1 text-sm text-ink-muted">
          Everything you currently have checked out.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="rounded-card border border-hairline bg-white px-5">
        {isLoading ? (
          <p className="py-6 font-mono text-sm text-ink-muted">
            Loading your loans…
          </p>
        ) : records.length ===
          0 ? (
          <p className="py-6 text-sm text-ink-muted">
            You don't have any loans yet.
          </p>
        ) : (
          records.map(
            (record) => (
              <LoanRow
                key={
                  record.id
                }
                record={
                  record
                }
                onRenew={
                  handleRenew
                }
                isRenewing={
                  renewingId ===
                  record.id
                }
                renewError={
                  renewErrors[
                    record.id
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