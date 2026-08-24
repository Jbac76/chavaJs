import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
 * Public users directory — members-only data table.
 *
 * Columns: Name | Email | Role | Permissions | Actions (View/Edit/Delete).
 * All data columns are sortable; live search filters the loaded page;
 * Previous/Next drive SERVER-side pagination so it scales to any dataset.
 */

interface PostSummary { id: number }

interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_admin?: boolean;
  roles?: string[];
  permissions?: string[];
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
  can?: { viewUser: boolean; editUser: boolean; deleteUser: boolean };
}

const columnHelper = createColumnHelper<UserRecord>();

export default function UsersIndex() {
  const props = usePage().props as unknown as UsersPageProps;
  const can = props.can ?? { viewUser: true, editUser: false, deleteUser: false };

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const goPage = (page: number) => router.get('/users', { page }, { preserveState: true });

  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <a href={`/users/${info.row.original.id}`} className="font-medium hover:underline">
          {info.getValue()}
        </a>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'role',
      header: 'Role',
      enableSorting: true,
      sortingFn: (a, b: { original: UserRecord }) =>
        (a.original.roles ?? []).join(',').localeCompare((b.original.roles ?? []).join(',')),
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {(info.row.original.roles ?? []).length === 0
            ? <Badge variant="secondary">Member</Badge>
            : (info.row.original.roles ?? []).map((role) => (
                <Badge key={role} variant={role === 'super-admin' ? 'default' : 'secondary'}>
                  {role === 'super-admin' ? 'Super Admin' : role}
                </Badge>
              ))}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'permissions',
      header: 'Permissions',
      enableSorting: true,
      sortingFn: (a, b: { original: UserRecord }) =>
        (a.original.permissions ?? []).length - (b.original.permissions ?? []).length,
      cell: (info) => {
        const permissions = info.row.original.permissions ?? [];
        const shown = permissions.slice(0, 2);
        const rest = permissions.length - shown.length;
        return (
          <div className="flex flex-wrap items-center gap-1" title={permissions.join(', ')}>
            {permissions.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {shown.map((permission) => (
              <Badge key={permission} variant="outline" className="font-mono text-[10px]">
                {permission === '*' ? 'ALL' : permission}
              </Badge>
            ))}
            {rest > 0 && <Badge variant="outline" className="text-[10px]">+{rest}</Badge>}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const user = info.row.original;
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" asChild>
              <a href={`/users/${user.id}`}>View</a>
            </Button>
            {can.editUser && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/admin/users/${user.id}/edit`}>Edit</a>
              </Button>
            )}
            {can.deleteUser && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`Delete ${user.name}? This cannot be undone.`)) {
                    router.delete(`/users/${user.id}`, { preserveScroll: true });
                  }
                }}
              >
                Delete
              </Button>
            )}
          </div>
        );
      },
    }),
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
  });

  const pager = props.users;

  return (
    <div className="w-full">
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
                        onClick={header.column.getToggleSortingHandler()}
                        className={
                          header.column.getIsSorted()
                            ? 'flex items-center gap-1 text-foreground'
                            : header.column.getCanSort()
                              ? 'flex items-center gap-1 hover:text-foreground'
                              : ''
                        }
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

      {/* Server-driven pagination — works across the full dataset */}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {pager?.from ?? 0}–{pager?.to ?? 0} of {pager?.total ?? 0} users
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={(pager?.current_page ?? 1) <= 1}
            onClick={() => goPage((pager?.current_page ?? 1) - 1)}
          >
            ← Previous
          </Button>
          <span>Page {pager?.current_page ?? 1} of {pager?.last_page ?? 1}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={(pager?.current_page ?? 1) >= (pager?.last_page ?? 1)}
            onClick={() => goPage((pager?.current_page ?? 1) + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
