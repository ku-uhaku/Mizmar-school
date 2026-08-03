"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ArrowUpIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";

import { DataTableFacet, type FacetDef } from "@/components/data-table/data-table-facet";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * Keeps rows whose value for the column is one of the ticked facet values.
 *
 * Generic over the row type so it can be the table's `defaultColumn` filter
 * without pinning `TData` to `unknown`.
 */
function facetedFilter<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  return filterValue.includes(String(row.getValue(columnId)));
}

/**
 * What to call a column in the visibility menu. Headers are usually plain
 * translated strings; a column that renders its header falls back to its id,
 * which is at least stable.
 */
function columnLabel(id: string, header: unknown): string {
  return typeof header === "string" ? header : id;
}

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
  facets,
  initialColumnVisibility = {},
  pageSize = 10,
  rowClassName,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyState?: React.ReactNode;
  /** Primary actions, rendered at the inline end of the toolbar. */
  toolbar?: React.ReactNode;
  /**
   * Styling that belongs to the whole row rather than to one cell — the ledger
   * dims a cancelled movement this way, and dimming it column by column would
   * put the same rule in seven places.
   */
  rowClassName?: (row: TData) => string | undefined;
  /**
   * Columns offered as multi-select filters. A screen with facets answers
   * "which of these are unplaced?" without anybody having to know what to type
   * into the search box.
   */
  facets?: FacetDef[];
  /**
   * Columns hidden on first render, keyed by column id.
   *
   * For a column that exists to be *filtered* rather than read — a facet needs
   * a real column to attach to, and a value already shown inside another cell
   * does not need a second column of its own. The reader can still turn it on
   * from the Columns menu, which is why this seeds the state rather than
   * suppressing the column outright.
   */
  initialColumnVisibility?: VisibilityState;
  pageSize?: number;
}) {
  const t = useT();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Feeds the counts beside each facet value.
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    // Facets filter a column to a *set* of values, which no built-in filterFn
    // does — `arrIncludesSome` expects the cell to be the array, not the
    // filter. Set as the default so a facet works on any column without the
    // caller having to remember to wire it up.
    defaultColumn: { filterFn: facetedFilter as FilterFn<TData> },
    // Pinned rather than left on "auto", which would otherwise resolve the
    // global search to the column filter above and break free-text search.
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = data.length;
  const filtered = table.getFilteredRowModel().rows.length;
  const isFiltered = columnFilters.length > 0 || globalFilter !== "";

  /** Columns a reader may sensibly hide — an actions column is not one. */
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && column.id !== "actions");

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

        {facets?.map((facet) => {
          const column = table.getColumn(facet.columnId);
          if (!column) return null;
          return (
            <DataTableFacet
              key={facet.columnId}
              column={column}
              label={facet.label}
              options={facet.options}
            />
          );
        })}

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter("");
            }}
          >
            {t.common.reset}
            <XIcon />
          </Button>
        ) : null}

        <span className="text-muted-foreground hidden text-sm tabular-nums sm:inline">
          {isFiltered ? `${filtered} / ${total}` : total}
        </span>

        <div className="ms-auto flex gap-2">
          {hideableColumns.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontalIcon />
                  <span className="hidden sm:inline">{t.common.columns}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>{t.common.columns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(value)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span className="truncate">
                      {columnLabel(column.id, column.columnDef.header)}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {toolbar}
        </div>
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
                <TableRow
                  key={row.id}
                  className={rowClassName?.(row.original)}
                >
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
