import Button from './Button';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-hairline pt-4">
      <p className="font-mono text-xs text-ink-muted">
        Page {meta.page} of {meta.totalPages} · {meta.total} result{meta.total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="text-xs"
          disabled={!meta.hasPrevPage}
          onClick={() => onPageChange(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          className="text-xs"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}