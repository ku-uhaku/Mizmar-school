"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ArrowUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Lets a column carry responsive classes, applied to both header and cells.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

/**
 * Sorting, filtering and pagination all happen client-side. The dataset here is
 * one organisation's schools/users/roles — hundreds of rows at most — so
 * shipping it in one go is far simpler than paginating on the server, and makes
 * search feel instant.
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  emptyState,
  toolbar,
  pageSize = 10,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyState?: React.ReactNode;
  /** Primary actions, rendered at the inline end of the toolbar. */
  toolbar?: React.ReactNode;
  pageSize?: number;
}) {
  const t = useT();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = data.length;
  const filtered = table.getFilteredRowModel().rows.length;

  // An empty dataset is a different story from "your filter matched nothing".
  if (total === 0 && emptyState) {
    return (
      <div className="bg-card overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="@container/table bg-card overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder ?? t.common.search}
            className="ps-9 pe-9"
            aria-label={searchPlaceholder ?? t.common.search}
          />
          {globalFilter ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setGlobalFilter("")}
              aria-label={t.common.close}
              className="absolute end-1 top-1/2 -translate-y-1/2"
            >
              <XIcon />
            </Button>
          ) : null}
        </div>

        <span className="text-muted-foreground hidden text-sm tabular-nums sm:inline">
          {globalFilter ? `${filtered} / ${total}` : total}
        </span>

        {toolbar ? <div className="ms-auto flex gap-2">{toolbar}</div> : null}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.className}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 uppercase transition-colors",
                            "hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
                            sorted && "text-foreground",
                          )}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ChevronsUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-32 text-center"
                >
                  {t.common.noResults}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <p className="text-muted-foreground text-sm tabular-nums">
            {table.getState().pagination.pageIndex + 1} {t.common.of}{" "}
            {table.getPageCount()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="rtl-flip" />
              {t.common.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t.common.next}
              <ChevronRightIcon className="rtl-flip" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
