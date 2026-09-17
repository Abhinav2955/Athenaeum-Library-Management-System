import {
  useCallback,
  useState,
} from 'react';

import AppShell
  from '../components/layout/AppShell';

import Button
  from '../components/common/Button';

import Input
  from '../components/common/Input';

import {
  searchMembers,
} from '../api/members.api';

import {
  listBooks,
} from '../api/books.api';

import {
  staffCheckoutBook,
  listAllLoans,
  returnLoan,
} from '../api/borrow.api';

import {
  useResourceVersion,
} from '../features/notifications/NotificationContext';

import {
  useRealtimeChange,
} from '../features/notifications/useRealtimeChange';

const MemberCard = ({
  member,
  selected,
  onSelect,
}) => {
  const isActive =
    member.membershipStatus ===
    'active';

  return (
    <button
      type="button"
      onClick={() =>
        onSelect(member)
      }
      className={`w-full rounded-card border p-4 text-left transition-colors ${
        selected
          ? 'border-brass bg-brass-light'
          : 'border-hairline bg-white hover:bg-paper'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">
            {member.name}
          </p>

          <p className="mt-1 text-sm text-ink-muted">
            {member.email}
          </p>

          {member.phone && (
            <p className="mt-1 text-xs text-ink-muted">
              {member.phone}
            </p>
          )}
        </div>

        <span
          className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${
            isActive
              ? 'bg-status-successBg text-status-success'
              : 'bg-status-dangerBg text-status-danger'
          }`}
        >
          {member.membershipStatus}
        </span>
      </div>
    </button>
  );
};

const BookResult = ({
  book,
  onIssue,
  disabled,
  isIssuing,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {book.title}
        </p>

        <p className="mt-1 font-mono text-xs text-ink-muted">
          ISBN {book.isbn}
        </p>

        <p className="mt-1 text-xs text-ink-muted">
          {book.availableCopies}{' '}
          available /{' '}
          {book.totalCopies}{' '}
          total
        </p>
      </div>

      <Button
        variant="brass"
        disabled={
          disabled ||
          isIssuing
        }
        onClick={() =>
          onIssue(book)
        }
      >
        {isIssuing
          ? 'Issuing…'
          : 'Issue'}
      </Button>
    </div>
  );
};

const LoanResult = ({
  loan,
  onReturn,
  returning,
}) => {
  const dueAt =
    new Date(
      loan.dueAt
    );

  const overdue =
    loan.status ===
      'overdue' ||
    (
      loan.status ===
        'active' &&
      dueAt <
        new Date()
    );

  return (
    <div className="rounded-card border border-hairline bg-white p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">
              {
                loan.copy
                  ?.book
                  ?.title ||
                'Unknown book'
              }
            </p>

            <span
              className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase ${
                overdue
                  ? 'bg-status-dangerBg text-status-danger'
                  : 'bg-paper text-ink-muted'
              }`}
            >
              {overdue
                ? 'Overdue'
                : 'Active'}
            </span>
          </div>

          <p className="mt-2 font-mono text-xs text-ink-muted">
            Barcode:{' '}
            {loan.copy
              ?.barcode ||
              '—'}
          </p>

          <p className="mt-1 text-xs text-ink-muted">
            Borrowed:{' '}
            {new Date(
              loan.borrowedAt
            ).toLocaleDateString()}
          </p>

          <p
            className={`mt-1 text-xs ${
              overdue
                ? 'font-medium text-status-danger'
                : 'text-ink-muted'
            }`}
          >
            Due:{' '}
            {dueAt.toLocaleDateString()}
          </p>
        </div>

        <Button
          variant="brass"
          disabled={
            returning
          }
          onClick={() =>
            onReturn(loan)
          }
        >
          {returning
            ? 'Returning…'
            : 'Confirm Return'}
        </Button>
      </div>
    </div>
  );
};

export default function CirculationDesk() {
  const [
    mode,
    setMode,
  ] = useState(
    'issue'
  );

  const [
    memberSearch,
    setMemberSearch,
  ] = useState('');

  const [
    memberResults,
    setMemberResults,
  ] = useState([]);

  const [
    selectedMember,
    setSelectedMember,
  ] = useState(null);

  const [
    searchingMembers,
    setSearchingMembers,
  ] = useState(false);

  const [
    bookSearch,
    setBookSearch,
  ] = useState('');

  const [
    books,
    setBooks,
  ] = useState([]);

  const [
    searchingBooks,
    setSearchingBooks,
  ] = useState(false);

  const [
    issuingBookId,
    setIssuingBookId,
  ] = useState(null);

  const [
    loans,
    setLoans,
  ] = useState([]);

  const [
    loadingLoans,
    setLoadingLoans,
  ] = useState(false);

  const [
    returningLoanId,
    setReturningLoanId,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const loansVersion =
    useResourceVersion(
      'loans'
    );

  const booksVersion =
    useResourceVersion(
      'books'
    );

  const inventoryVersion =
    useResourceVersion(
      'inventory'
    );

  const usersVersion =
    useResourceVersion(
      'users'
    );

  const clearMessages =
    () => {
      setError('');
      setSuccess('');
    };

  const resetWorkArea =
    () => {
      setSelectedMember(
        null
      );

      setMemberResults(
        []
      );

      setMemberSearch(
        ''
      );

      setBookSearch(
        ''
      );

      setBooks(
        []
      );

      setLoans(
        []
      );

      setError('');
      setSuccess('');
    };

  const switchMode =
    (
      nextMode
    ) => {
      setMode(
        nextMode
      );

      resetWorkArea();
    };

  const searchForMembers =
    useCallback(
      async (
        term,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setSearchingMembers(
            true
          );
        }

        try {
          const results =
            await searchMembers(
              term
            );

          setMemberResults(
            results
          );

          setSelectedMember(
            (current) => {
              if (!current) {
                return current;
              }

              const updated =
                results.find(
                  (member) =>
                    member.id ===
                    current.id
                );

              return (
                updated ||
                current
              );
            }
          );

          return results;
        } catch (err) {
          if (!silent) {
            setError(
              err.response
                ?.data
                ?.message ||
                'Could not search members.'
            );
          }

          return [];
        } finally {
          if (!silent) {
            setSearchingMembers(
              false
            );
          }
        }
      },
      []
    );

  const handleMemberSearch =
    async (event) => {
      event.preventDefault();

      clearMessages();

      const term =
        memberSearch.trim();

      if (
        term.length < 2
      ) {
        setError(
          'Enter at least 2 characters to search for a member.'
        );

        return;
      }

      const results =
        await searchForMembers(
          term
        );

      if (
        results.length ===
        0
      ) {
        setError(
          'No matching members found.'
        );
      }
    };

  const loadMemberLoans =
    useCallback(
      async (
        member,
        {
          silent = false,
        } = {}
      ) => {
        if (!member) {
          return;
        }

        if (!silent) {
          setLoadingLoans(
            true
          );
        }

        try {
          const [
            activeResult,
            overdueResult,
          ] =
            await Promise.all([
              listAllLoans({
                userId:
                  member.id,

                status:
                  'active',

                limit: 100,
              }),

              listAllLoans({
                userId:
                  member.id,

                status:
                  'overdue',

                limit: 100,
              }),
            ]);

          const combined = [
            ...(activeResult.records ||
              []),

            ...(overdueResult.records ||
              []),
          ];

          const unique =
            Array.from(
              new Map(
                combined.map(
                  (loan) => [
                    loan.id,
                    loan,
                  ]
                )
              ).values()
            );

          unique.sort(
            (a, b) =>
              new Date(
                a.dueAt
              ) -
              new Date(
                b.dueAt
              )
          );

          setLoans(
            unique
          );
        } catch (err) {
          if (!silent) {
            setError(
              err.response
                ?.data
                ?.message ||
                'Could not load this member’s loans.'
            );
          }
        } finally {
          if (!silent) {
            setLoadingLoans(
              false
            );
          }
        }
      },
      []
    );

  const searchForBooks =
    useCallback(
      async (
        term,
        {
          silent = false,
        } = {}
      ) => {
        if (!silent) {
          setSearchingBooks(
            true
          );
        }

        try {
          const result =
            await listBooks({
              search:
                term,

              page: 1,

              limit: 10,
            });

          setBooks(
            result.books ||
              []
          );

          return (
            result.books ||
            []
          );
        } catch (err) {
          if (!silent) {
            setError(
              err.response
                ?.data
                ?.message ||
                'Could not search the catalog.'
            );
          }

          return [];
        } finally {
          if (!silent) {
            setSearchingBooks(
              false
            );
          }
        }
      },
      []
    );

  useRealtimeChange(
    loansVersion,
    () => {
      if (
        mode !==
          'return' ||
        !selectedMember
      ) {
        return;
      }

      loadMemberLoans(
        selectedMember,
        {
          silent: true,
        }
      );
    }
  );

  useRealtimeChange(
    [
      booksVersion,
      inventoryVersion,
    ],
    () => {
      if (
        mode !==
          'issue' ||
        !selectedMember
      ) {
        return;
      }

      const term =
        bookSearch.trim();

      if (!term) {
        return;
      }

      searchForBooks(
        term,
        {
          silent: true,
        }
      );
    }
  );

  useRealtimeChange(
    usersVersion,
    () => {
      const term =
        memberSearch.trim();

      if (
        term.length < 2
      ) {
        return;
      }

      searchForMembers(
        term,
        {
          silent: true,
        }
      );
    }
  );

  const handleMemberSelect =
    async (member) => {
      clearMessages();

      setSelectedMember(
        member
      );

      setBooks(
        []
      );

      setBookSearch(
        ''
      );

      setLoans(
        []
      );

      if (
        mode ===
        'return'
      ) {
        await loadMemberLoans(
          member
        );
      }
    };

  const handleBookSearch =
    async (event) => {
      event.preventDefault();

      clearMessages();

      if (
        !selectedMember
      ) {
        setError(
          'Select a member first.'
        );

        return;
      }

      const term =
        bookSearch.trim();

      if (!term) {
        setError(
          'Enter a title or ISBN.'
        );

        return;
      }

      const results =
        await searchForBooks(
          term
        );

      if (
        results.length ===
        0
      ) {
        setError(
          'No matching books found.'
        );
      }
    };

  const handleIssue =
    async (book) => {
      clearMessages();

      if (
        !selectedMember
      ) {
        return;
      }

      if (
        selectedMember
          .membershipStatus !==
        'active'
      ) {
        setError(
          'This member does not have an active membership.'
        );

        return;
      }

      setIssuingBookId(
        book.id
      );

      try {
        const record =
          await staffCheckoutBook({
            bookId:
              book.id,

            userId:
              selectedMember.id,
          });

        setSuccess(
          `"${book.title}" issued successfully to ${selectedMember.name}. Due ${new Date(
            record.dueAt
          ).toLocaleDateString()}.`
        );

        const term =
          bookSearch.trim();

        if (term) {
          await searchForBooks(
            term,
            {
              silent: true,
            }
          );
        }
      } catch (err) {
        setError(
          err.response
            ?.data
            ?.message ||
            'Could not issue the book.'
        );
      } finally {
        setIssuingBookId(
          null
        );
      }
    };

  const handleReturn =
    async (loan) => {
      clearMessages();

      const title =
        loan.copy
          ?.book
          ?.title ||
        'Book';

      setReturningLoanId(
        loan.id
      );

      try {
        const result =
          await returnLoan(
            loan.id
          );

        setSuccess(
          `${title}: ${result.message}`
        );

        if (
          selectedMember
        ) {
          await loadMemberLoans(
            selectedMember,
            {
              silent: true,
            }
          );
        }
      } catch (err) {
        setError(
          err.response
            ?.data
            ?.message ||
            'Could not return the book.'
        );
      } finally {
        setReturningLoanId(
          null
        );
      }
    };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
            Staff Operations
          </p>

          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink">
            Circulation Desk
          </h1>

          <p className="mt-1 text-sm text-ink-muted">
            Issue and return physical library books.
          </p>
        </div>

        <div className="mb-6 flex gap-2 border-b border-hairline">
          <button
            type="button"
            onClick={() =>
              switchMode(
                'issue'
              )
            }
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode ===
              'issue'
                ? 'border-brass text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Issue Book
          </button>

          <button
            type="button"
            onClick={() =>
              switchMode(
                'return'
              )
            }
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode ===
              'return'
                ? 'border-brass text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Return Book
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-card border border-status-danger bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-card border border-status-success bg-status-successBg px-4 py-3 text-sm text-status-success">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-card border border-hairline bg-white p-5">
            <h2 className="font-serif text-lg font-semibold text-ink">
              1. Find Member
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              Search by name, email, or phone.
            </p>

            <form
              className="mt-4"
              onSubmit={
                handleMemberSearch
              }
            >
              <Input
                id="member-search"
                label="Member"
                value={
                  memberSearch
                }
                onChange={(
                  event
                ) =>
                  setMemberSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Name, email, or phone"
              />

              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={
                  searchingMembers
                }
              >
                {searchingMembers
                  ? 'Searching…'
                  : 'Search Member'}
              </Button>
            </form>

            <div className="mt-4 space-y-2">
              {memberResults.map(
                (member) => (
                  <MemberCard
                    key={
                      member.id
                    }
                    member={
                      member
                    }
                    selected={
                      selectedMember
                        ?.id ===
                      member.id
                    }
                    onSelect={
                      handleMemberSelect
                    }
                  />
                )
              )}
            </div>

            {selectedMember && (
              <div className="mt-5 border-t border-hairline pt-4">
                <p className="font-mono text-xs uppercase text-ink-muted">
                  Selected
                </p>

                <p className="mt-1 font-medium text-ink">
                  {
                    selectedMember.name
                  }
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {
                    selectedMember.email
                  }
                </p>
              </div>
            )}
          </section>

          <section className="rounded-card border border-hairline bg-white p-5">
            {mode ===
            'issue' ? (
              <>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  2. Find Book
                </h2>

                {!selectedMember ? (
                  <p className="mt-4 text-sm text-ink-muted">
                    Select a member before searching for a book.
                  </p>
                ) : (
                  <>
                    <form
                      className="mt-4"
                      onSubmit={
                        handleBookSearch
                      }
                    >
                      <Input
                        id="book-search"
                        label="Book"
                        value={
                          bookSearch
                        }
                        onChange={(
                          event
                        ) =>
                          setBookSearch(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="Title or ISBN"
                      />

                      <Button
                        type="submit"
                        variant="secondary"
                        className="mt-3"
                        disabled={
                          searchingBooks
                        }
                      >
                        {searchingBooks
                          ? 'Searching…'
                          : 'Search Catalog'}
                      </Button>
                    </form>

                    <div className="mt-5">
                      {books.map(
                        (book) => (
                          <BookResult
                            key={
                              book.id
                            }
                            book={
                              book
                            }
                            disabled={
                              selectedMember
                                .membershipStatus !==
                              'active'
                            }
                            isIssuing={
                              issuingBookId ===
                              book.id
                            }
                            onIssue={
                              handleIssue
                            }
                          />
                        )
                      )}
                    </div>

                    {selectedMember
                      .membershipStatus !==
                      'active' && (
                      <p className="mt-4 text-xs text-status-danger">
                        This member cannot borrow books because the membership is{' '}
                        {
                          selectedMember.membershipStatus
                        }.
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  2. Select Loan to Return
                </h2>

                {!selectedMember && (
                  <p className="mt-4 text-sm text-ink-muted">
                    Select a member to see their current loans.
                  </p>
                )}

                {selectedMember &&
                  loadingLoans && (
                    <p className="mt-4 font-mono text-sm text-ink-muted">
                      Loading loans…
                    </p>
                  )}

                {selectedMember &&
                  !loadingLoans &&
                  loans.length ===
                    0 && (
                    <div className="mt-4 rounded-card bg-paper p-4 text-sm text-ink-muted">
                      This member has no active or overdue loans.
                    </div>
                  )}

                <div className="mt-4 space-y-3">
                  {loans.map(
                    (loan) => (
                      <LoanResult
                        key={
                          loan.id
                        }
                        loan={
                          loan
                        }
                        returning={
                          returningLoanId ===
                          loan.id
                        }
                        onReturn={
                          handleReturn
                        }
                      />
                    )
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}