import {
  useEffect,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import StatCard
  from '../features/admin/StatCard';

import TopBooksList
  from '../features/admin/TopBooksList';

import OverdueTable
  from '../features/admin/OverdueTable';

import CirculationBars
  from '../features/admin/CirculationBars';

import {
  getDashboardSummary,
  getTopBooks,
  getOverdueLoans,
  getFineRevenue,
  getCirculationStats,
  downloadOverdueCsv,
  downloadInventoryCsv,
} from '../api/reports.api';

const InventoryItem = ({
  label,
  value,
  danger = false,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-hairline py-2 last:border-b-0">
      <span className="text-sm text-ink-muted">
        {label}
      </span>

      <span
        className={`font-mono text-sm ${
          danger
            ? 'font-semibold text-status-danger'
            : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
};

export default function AdminDashboard() {
  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    topBooks,
    setTopBooks,
  ] = useState([]);

  const [
    overdueLoans,
    setOverdueLoans,
  ] = useState([]);

  const [
    fineRevenue,
    setFineRevenue,
  ] = useState(null);

  const [
    circulation,
    setCirculation,
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
    exportingOverdue,
    setExportingOverdue,
  ] = useState(false);

  const [
    exportingInventory,
    setExportingInventory,
  ] = useState(false);

  useEffect(() => {
    let cancelled =
      false;

    Promise.all([
      getDashboardSummary(),

      getTopBooks(5),

      getOverdueLoans(),

      getFineRevenue(),

      getCirculationStats(
        30
      ),
    ])
      .then(
        ([
          summaryResult,
          topBooksResult,
          overdueResult,
          revenueResult,
          circulationResult,
        ]) => {
          if (
            cancelled
          ) {
            return;
          }

          setSummary(
            summaryResult
          );

          setTopBooks(
            topBooksResult
          );

          setOverdueLoans(
            overdueResult
          );

          setFineRevenue(
            revenueResult
          );

          setCirculation(
            circulationResult
          );
        }
      )
      .catch(
        (err) => {
          if (
            !cancelled
          ) {
            setError(
              err.response
                ?.data
                ?.message ||
                'Could not load the dashboard.'
            );
          }
        }
      )
      .finally(
        () => {
          if (
            !cancelled
          ) {
            setIsLoading(
              false
            );
          }
        }
      );

    return () => {
      cancelled =
        true;
    };
  }, []);

  const handleOverdueExport =
    async () => {
      setExportingOverdue(
        true
      );

      setError('');

      try {
        await downloadOverdueCsv();
      } catch {
        setError(
          'Could not export the overdue report.'
        );
      } finally {
        setExportingOverdue(
          false
        );
      }
    };

  const handleInventoryExport =
    async () => {
      setExportingInventory(
        true
      );

      setError('');

      try {
        await downloadInventoryCsv();
      } catch {
        setError(
          'Could not export the inventory report.'
        );
      } finally {
        setExportingInventory(
          false
        );
      }
    };

  if (isLoading) {
    return (
      <AppShell>
        <p className="font-mono text-sm text-ink-muted">
          Loading dashboard…
        </p>
      </AppShell>
    );
  }

  if (
    error &&
    !summary
  ) {
    return (
      <AppShell>
        <div className="rounded-card border border-status-danger bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      </AppShell>
    );
  }

  const inventory =
    summary.inventory;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
              Operations
            </p>

            <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
              Admin Dashboard
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              Circulation, inventory, reservations and financial health.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={
                exportingOverdue
              }
              onClick={
                handleOverdueExport
              }
            >
              {exportingOverdue
                ? 'Exporting…'
                : 'Export Overdue CSV'}
            </Button>

            <Button
              variant="secondary"
              disabled={
                exportingInventory
              }
              onClick={
                handleInventoryExport
              }
            >
              {exportingInventory
                ? 'Exporting…'
                : 'Export Inventory CSV'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-card border border-status-danger bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Books"
            value={
              summary.totalBooks
            }
          />

          <StatCard
            label="Members"
            value={
              summary.totalMembers
            }
          />

          <StatCard
            label="Open Loans"
            value={
              summary.activeLoans
            }
          />

          <StatCard
            label="Overdue"
            value={
              summary.overdueLoans
            }
            tone={
              summary.overdueLoans >
              0
                ? 'danger'
                : 'neutral'
            }
          />

          <StatCard
            label="Overdue Rate"
            value={`${summary.overdueRate.toFixed(
              1
            )}%`}
            tone={
              summary.overdueRate >
              0
                ? 'danger'
                : 'neutral'
            }
          />

          <StatCard
            label="Ready Pickups"
            value={
              summary.readyReservations
            }
            tone="brass"
          />

          <StatCard
            label="Waiting Queue"
            value={
              summary.waitingReservations
            }
          />

          <StatCard
            label="Active Copies"
            value={
              summary.totalCopies
            }
          />

          <StatCard
            label="Available Now"
            value={
              summary.availableCopies
            }
          />

          <StatCard
            label="Maintenance"
            value={
              summary.maintenanceCopies
            }
            tone={
              summary.maintenanceCopies >
              0
                ? 'danger'
                : 'neutral'
            }
          />

          <StatCard
            label="Pending Fines"
            value={`₹${summary.pendingFinesTotal.toFixed(
              2
            )}`}
            tone="brass"
          />

          <StatCard
            label="Collected Fines"
            value={`₹${summary.collectedFinesTotal.toFixed(
              2
            )}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-card border border-hairline bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  Circulation — Last 30 Days
                </h2>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    circulation.checkoutTotal
                  }{' '}
                  checkouts ·{' '}
                  {
                    circulation.returnTotal
                  }{' '}
                  returns
                </p>
              </div>
            </div>

            <div className="mt-5">
              <CirculationBars
                checkoutsByDay={
                  circulation.checkoutsByDay
                }
              />
            </div>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Most Borrowed
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              Based on historical checkout records.
            </p>

            <div className="mt-3">
              <TopBooksList
                books={
                  topBooks
                }
              />
            </div>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  Inventory Health
                </h2>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    inventory.availabilityRate
                  }
                  % of active inventory is currently available.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <InventoryItem
                label="Available"
                value={
                  inventory.available
                }
              />

              <InventoryItem
                label="Borrowed"
                value={
                  inventory.borrowed
                }
              />

              <InventoryItem
                label="Reserved"
                value={
                  inventory.reserved
                }
              />

              <InventoryItem
                label="Damaged"
                value={
                  inventory.damaged
                }
                danger={
                  inventory.damaged >
                  0
                }
              />

              <InventoryItem
                label="Under Repair"
                value={
                  inventory.under_repair
                }
                danger={
                  inventory.under_repair >
                  0
                }
              />

              <InventoryItem
                label="Historical Lost"
                value={
                  inventory.lost
                }
                danger={
                  inventory.lost >
                  0
                }
              />
            </div>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">
              Fine Overview
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-xs uppercase text-ink-muted">
                  Pending
                </p>

                <p className="mt-1 font-serif text-xl font-semibold text-brass-dark">
                  ₹
                  {fineRevenue.pending.toFixed(
                    2
                  )}
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    fineRevenue.pendingCount
                  }{' '}
                  fine(s)
                </p>
              </div>

              <div>
                <p className="font-mono text-xs uppercase text-ink-muted">
                  Collected
                </p>

                <p className="mt-1 font-serif text-xl font-semibold text-status-success">
                  ₹
                  {fineRevenue.collected.toFixed(
                    2
                  )}
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    fineRevenue.paidCount
                  }{' '}
                  fine(s)
                </p>
              </div>

              <div>
                <p className="font-mono text-xs uppercase text-ink-muted">
                  Waived
                </p>

                <p className="mt-1 font-serif text-xl font-semibold text-ink-muted">
                  ₹
                  {fineRevenue.waived.toFixed(
                    2
                  )}
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    fineRevenue.waivedCount
                  }{' '}
                  fine(s)
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5 xl:col-span-2">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  Overdue Loans
                </h2>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    overdueLoans.length
                  }{' '}
                  current overdue obligation
                  {overdueLoans.length ===
                  1
                    ? ''
                    : 's'}.
                </p>
              </div>

              <Button
                variant="secondary"
                className="text-xs"
                disabled={
                  exportingOverdue
                }
                onClick={
                  handleOverdueExport
                }
              >
                Export CSV
              </Button>
            </div>

            <div className="mt-4">
              <OverdueTable
                loans={
                  overdueLoans
                }
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}