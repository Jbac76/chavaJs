import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';

/**
 * Public users directory — members-only listing rendered as a proper
 * data table: live search, sortable columns, client pagination.
 * Deletion is policy-gated (can.deleteUser comes from the controller).
 */

interface PostSummary { id: number }

interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at?: string;
  posts?: PostSummary[] | null;
}

interface UsersPageProps {
  users: {
    data: UserRecord[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  can?: { deleteUser: boolean };
}

const columnHelper = createColumnHelper<UserRecord>();

export default function UsersIndex() {
  const props = usePage().props as unknown as UsersPageProps;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'role',
      header: 'Role',
      enableSorting: false,
      cell: (info) =>
        info.row.original.is_admin
          ? <Badge variant="default">Admin</Badge>
          : <Badge variant="secondary">Member</Badge>,
    }),
    columnHelper.display({
      id: 'posts',
      header: 'Posts',
      enableSorting: false,
      cell: (info) => (info.row.original.posts?.length ?? 0),
    }),
    ...((props.can?.deleteUser) ? [columnHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: (info) => (
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
          onClick={() => {
            if (window.confirm(`Delete ${info.row.original.name}? This cannot be undone.`)) {
              router.delete(`/users/${info.row.original.id}`, { preserveScroll: true });
            }
          }}
        >
          Delete
        </Button>
      ),
    })] : []),
  ];

  const table = useReactTable({
    data: props.users?.data ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>

      <div className="mt-4">
        <Input
          value={globalFilter ?? ''}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Live search..."
          className="max-w-xs"
        />
      </div>

      <div className="mt-4 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        disabled={!header.column.getCanSort()}
                        className={header.column.getCanSort() ? 'flex items-center gap-1 hover:text-foreground' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{table.getPrePaginationRowModel().rows.length} on this page · {props.users?.total ?? 0} total</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span>Page {table.getState().pagination.pageIndex + 1}</span>
          <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
