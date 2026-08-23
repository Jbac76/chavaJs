import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Card, CardContent } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';
import AdminLayout from '@/Layouts/AdminLayout';

/**
 * Live-searching users table - TanStack Table v8.
 *
 * Two search layers:
 *   1. globalFilter  -> instant client-side filter over the loaded page
 *   2. server `?q=`   -> debounced query for large datasets (Laravel-style)
 *
 * Row actions are hidden using the server-computed per-row `can` props
 * (RBAC x UserPolicy), so a user without users.delete never sees the button.
 */

interface UserRow {
  id: number;
  name: string;
  email: string;
  roles: string[];
  created_at?: string;
}

interface PageProps {
  users: { data: UserRow[]; current_page: number; last_page: number; total?: number };
  q: string;
  can: { create: boolean; update: boolean; delete: boolean };
  status?: string;
}

const columnHelper = createColumnHelper<UserRow>();

export default function UsersIndex() {
  const page = usePage().props as unknown as PageProps;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [serverQuery, setServerQuery] = useState(page.q ?? '');
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const columns = [
    columnHelper.accessor('id', { header: 'ID' }),
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.display({
      id: 'roles',
      header: 'Roles',
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {(info.row.original.roles ?? []).map((role) => (
            <Badge key={role} variant="secondary">{role}</Badge>
          ))}
        </div>
      ),
      enableSorting: false,
    }),
    ...((page.can.update || page.can.delete) ? [columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex gap-1">
          {page.can.update && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/admin/users/${info.row.original.id}/edit`}>Edit</a>
            </Button>
          )}
          {page.can.delete && (
            <Button size="sm" variant="destructive" onClick={() => setDeleting(info.row.original)}>
              Delete
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
    })] : []),
  ];

  const table = useReactTable({
    data: page.users?.data ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const goServer = (params: Record<string, unknown>) =>
    router.get('/admin/users', params as never, { preserveState: true });

  const confirmDelete = () => {
    if (!deleting) return;
    router.delete(`/admin/users/${deleting.id}`, { onFinish: () => setDeleting(null) });
  };

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            goServer({ q: serverQuery });
          }}
        >
          <Input
            value={serverQuery}
            onChange={(event) => {
              setServerQuery(event.target.value);
              goServer({ q: event.target.value });
            }}
            placeholder="Search name or email (server)..."
            className="w-72"
          />
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {page.can.create && (
          <Button asChild><a href="/admin/users/create">New user</a></Button>
        )}
      </div>

      {page.status && (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          {page.status}
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Live filter current rows..."
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
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
                    No users match your filters.
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
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {page.users?.current_page ?? 1} of {page.users?.last_page ?? 1}
          {page.users?.total !== undefined ? ` (${page.users.total} total)` : ''}
        </span>
        <div className="flex gap-2">
          {page.users && page.users.current_page > 1 && (
            <Button size="sm" variant="outline" onClick={() => goServer({ page: page.users.current_page - 1, q: serverQuery })}>
              Previous
            </Button>
          )}
          {page.users && page.users.current_page < page.users.last_page && (
            <Button size="sm" variant="outline" onClick={() => goServer({ page: page.users.current_page + 1, q: serverQuery })}>
              Next
            </Button>
          )}
        </div>
      </div>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Delete user?</h2>
              <p className="text-sm text-muted-foreground">
                Permanently delete <strong>{deleting.name}</strong> ({deleting.email})? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete user</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
