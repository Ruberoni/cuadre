import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortOrder = "asc" | "desc";

export type Column<Row, SortKey extends string> = {
  id: string;
  header: string;
  /** Numbers, money and dates are right-aligned, header included. */
  align?: "left" | "right";
  /** Makes the header a sort button. */
  sortKey?: SortKey;
  cell: (row: Row) => ReactNode;
};

type DataTableProps<Row, SortKey extends string> = {
  columns: readonly Column<Row, SortKey>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Screen-reader caption naming the list. */
  caption: string;
  sort: SortKey;
  order: SortOrder;
  onSort: (key: SortKey) => void;
  /** First load: 5 skeleton rows instead of data. */
  loading?: boolean;
};

const SKELETON_ROWS = 5;

/** Compact table for a list screen (Design System → DataTable): 32 px rows, sortable headers. */
export function DataTable<Row, SortKey extends string>({
  columns,
  rows,
  rowKey,
  caption,
  sort,
  order,
  onSort,
  loading = false,
}: DataTableProps<Row, SortKey>) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table aria-busy={loading || undefined}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-muted">
            {columns.map((column) => {
              const sorted = column.sortKey !== undefined && column.sortKey === sort;
              return (
                <TableHead
                  key={column.id}
                  scope="col"
                  aria-sort={
                    column.sortKey === undefined
                      ? undefined
                      : sorted
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                  }
                  className={column.align === "right" ? "text-right" : undefined}
                >
                  {column.sortKey === undefined ? (
                    column.header
                  ) : (
                    <SortButton
                      label={column.header}
                      active={sorted}
                      order={order}
                      right={column.align === "right"}
                      onClick={() => onSort(column.sortKey as SortKey)}
                    />
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(column.align === "right" && "text-right tabular-nums")}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortButton({
  label,
  active,
  order,
  right,
  onClick,
}: {
  label: string;
  active: boolean;
  order: SortOrder;
  right: boolean;
  onClick: () => void;
}) {
  const Arrow = order === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-(--target-min) w-full items-center gap-1 rounded-sm",
        right && "justify-end",
      )}
    >
      {label}
      {active ? <Arrow aria-hidden="true" className="size-3" /> : null}
    </button>
  );
}

type PagerProps = {
  /** Text such as "1–25 de 30 productos". */
  summary: string;
  previousLabel: string;
  nextLabel: string;
  hasPrevious: boolean;
  hasNext: boolean;
  /** Disables both buttons, e.g. while the next page loads. */
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function Pager({
  summary,
  previousLabel,
  nextLabel,
  hasPrevious,
  hasNext,
  busy,
  onPrevious,
  onNext,
}: PagerProps) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p aria-live="polite" className="text-caption text-muted-foreground">
        {summary}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={previousLabel}
          disabled={busy || !hasPrevious}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={nextLabel}
          disabled={busy || !hasNext}
          onClick={onNext}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
