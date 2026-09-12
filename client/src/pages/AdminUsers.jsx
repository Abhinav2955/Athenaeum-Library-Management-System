import {
  useEffect,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import {
  useAuth,
} from '../features/auth/AuthContext';

import {
  getUsers,
  updateMembershipStatus,
  updateUserRole,
} from '../api/users.api';

const formatDate =
  (value) => {
    if (!value) {
      return '—';
    }

    return new Date(
      value
    ).toLocaleDateString();
  };

const roleLabel =
  (role) =>
    role
      ? role
          .charAt(0)
          .toUpperCase() +
        role.slice(1)
      : '—';

const statusClass =
  (status) => {
    if (
      status ===
      'active'
    ) {
      return 'bg-status-successBg text-status-success';
    }

    if (
      status ===
      'suspended'
    ) {
      return 'bg-status-dangerBg text-status-danger';
    }

    return 'bg-paper text-ink-muted';
  };

export default function AdminUsers() {
  const {
    user:
      currentUser,
  } = useAuth();

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    meta,
    setMeta,
  ] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    searchInput,
    setSearchInput,
  ] = useState('');

  const [
    role,
    setRole,
  ] = useState('');

  const [
    membershipStatus,
    setMembershipStatus,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    updatingId,
    setUpdatingId,
  ] = useState(null);

  const loadUsers =
    async (
      page = 1
    ) => {
      setLoading(true);
      setError('');

      try {
        const result =
          await getUsers({
            page,
            limit:
              meta.limit,
            search,
            role,
            membershipStatus,
          });

        setUsers(
          result.users
        );

        setMeta(
          result.meta
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not load users.'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadUsers(1);
  }, [
    search,
    role,
    membershipStatus,
  ]);

  const handleSearch =
    (event) => {
      event.preventDefault();

      setSearch(
        searchInput.trim()
      );
    };

  const handleMembershipChange =
    async (
      target,
      nextStatus
    ) => {
      if (
        target.id ===
        currentUser?.id
      ) {
        setError(
          'You cannot change your own membership status.'
        );

        return;
      }

      setUpdatingId(
        target.id
      );

      setError('');

      try {
        const updated =
          await updateMembershipStatus(
            target.id,
            nextStatus
          );

        setUsers(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                updated.id
                  ? {
                      ...item,
                      ...updated,
                    }
                  : item
            )
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not update membership status.'
        );
      } finally {
        setUpdatingId(
          null
        );
      }
    };

  const handleRoleChange =
    async (
      target,
      nextRole
    ) => {
      if (
        target.id ===
        currentUser?.id
      ) {
        setError(
          'You cannot change your own role.'
        );

        return;
      }

      setUpdatingId(
        target.id
      );

      setError('');

      try {
        const updated =
          await updateUserRole(
            target.id,
            nextRole
          );

        setUsers(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                updated.id
                  ? {
                      ...item,
                      ...updated,
                    }
                  : item
            )
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            'Could not update user role.'
        );
      } finally {
        setUpdatingId(
          null
        );
      }
    };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Administration
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Users
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Manage library memberships and staff access.
          </p>
        </div>

        <div className="rounded-card border border-hairline bg-white p-4">
          <form
            onSubmit={
              handleSearch
            }
            className="grid gap-3 lg:grid-cols-[1fr_180px_190px_auto]"
          >
            <input
              type="search"
              value={
                searchInput
              }
              onChange={
                (event) =>
                  setSearchInput(
                    event.target
                      .value
                  )
              }
              placeholder="Search name or email"
              className="rounded-card border border-hairline bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            />

            <select
              value={
                role
              }
              onChange={
                (event) =>
                  setRole(
                    event.target
                      .value
                  )
              }
              className="rounded-card border border-hairline bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            >
              <option value="">
                All roles
              </option>

              <option value="member">
                Members
              </option>

              <option value="librarian">
                Librarians
              </option>

              <option value="admin">
                Admins
              </option>
            </select>

            <select
              value={
                membershipStatus
              }
              onChange={
                (event) =>
                  setMembershipStatus(
                    event.target
                      .value
                  )
              }
              className="rounded-card border border-hairline bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            >
              <option value="">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="suspended">
                Suspended
              </option>

              <option value="expired">
                Expired
              </option>
            </select>

            <Button
              type="submit"
            >
              Search
            </Button>
          </form>
        </div>

        {error && (
          <div className="mt-4 rounded-card border border-status-danger bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-card border border-hairline bg-white">
          {loading ? (
            <div className="p-6 text-sm text-ink-muted">
              Loading users…
            </div>
          ) : users.length ===
            0 ? (
            <div className="p-6 text-sm text-ink-muted">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-hairline bg-paper">
                  <tr>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      User
                    </th>

                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      Role
                    </th>

                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      Membership
                    </th>

                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      Joined
                    </th>

                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {users.map(
                    (item) => {
                      const isSelf =
                        item.id ===
                        currentUser?.id;

                      const updating =
                        updatingId ===
                        item.id;

                      return (
                        <tr
                          key={
                            item.id
                          }
                          className="border-b border-hairline last:border-b-0"
                        >
                          <td className="px-4 py-4">
                            <p className="text-sm font-medium text-ink">
                              {item.name}
                              {isSelf &&
                                ' (You)'}
                            </p>

                            <p className="mt-1 text-xs text-ink-muted">
                              {item.email}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            {currentUser?.role ===
                            'admin' ? (
                              <select
                                value={
                                  item.role
                                }
                                disabled={
                                  updating ||
                                  isSelf
                                }
                                onChange={
                                  (
                                    event
                                  ) =>
                                    handleRoleChange(
                                      item,
                                      event
                                        .target
                                        .value
                                    )
                                }
                                className="rounded-card border border-hairline bg-white px-2 py-1.5 text-sm capitalize text-ink disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="member">
                                  Member
                                </option>

                                <option value="librarian">
                                  Librarian
                                </option>

                                <option value="admin">
                                  Admin
                                </option>
                              </select>
                            ) : (
                              <span className="text-sm text-ink">
                                {roleLabel(
                                  item.role
                                )}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2">
                              <span
                                className={`w-fit rounded-full px-2 py-1 text-xs font-medium capitalize ${statusClass(
                                  item.membershipStatus
                                )}`}
                              >
                                {
                                  item.membershipStatus
                                }
                              </span>

                              <select
                                value={
                                  item.membershipStatus
                                }
                                disabled={
                                  updating ||
                                  isSelf
                                }
                                onChange={
                                  (
                                    event
                                  ) =>
                                    handleMembershipChange(
                                      item,
                                      event
                                        .target
                                        .value
                                    )
                                }
                                className="max-w-[140px] rounded-card border border-hairline bg-white px-2 py-1.5 text-xs text-ink disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="active">
                                  Active
                                </option>

                                <option value="suspended">
                                  Suspended
                                </option>

                                <option value="expired">
                                  Expired
                                </option>
                              </select>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-ink-muted">
                            {formatDate(
                              item.createdAt
                            )}
                          </td>

                          <td className="px-4 py-4 text-right text-xs text-ink-muted">
                            {updating
                              ? 'Saving…'
                              : item.isEmailVerified
                                ? 'Verified'
                                : 'Pending'}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading &&
          meta.totalPages >
            1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-ink-muted">
                Page{' '}
                {meta.page}{' '}
                of{' '}
                {
                  meta.totalPages
                }
              </p>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={
                    meta.page <=
                    1
                  }
                  onClick={() =>
                    loadUsers(
                      meta.page -
                        1
                    )
                  }
                >
                  Previous
                </Button>

                <Button
                  variant="secondary"
                  disabled={
                    meta.page >=
                    meta.totalPages
                  }
                  onClick={() =>
                    loadUsers(
                      meta.page +
                        1
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
      </div>
    </AppShell>
  );
}