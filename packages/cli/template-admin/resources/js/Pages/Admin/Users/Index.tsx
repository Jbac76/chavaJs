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
import { Card, CardContent } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/Components/ui/table';
import AdminLayout from '@/Layouts/AdminLayout';

/**
 * Users data table — Laravel-style resource list with:
 *   live search (client filter) + server-side ?q= for large datasets
 *   column sorting (TanStack), role/status dropdown filters
 *   server-side pagination, RBAC-gated row actions.
 */

interface UserRow {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  verified: boolean;
  created_at?: string;
}

interface PageProps {
  users: { data: UserRow[]; current_page: number; last_page: number; total?: number };
  q: string;
  can: { create: boolean; update: boolean; delete: boolean };
  roles: string[];
  status?: string;
}

const columnHelper = createColumnHelper<UserRow>();
const PER_PAGE = 25;

export default function UsersIndex() {
  const props = usePage().props as unknown as PageProps;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serverQuery, setServerQuery] = useState(props.q ?? '');
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  // Client-side dropdown filters (role + status) applied to the loaded page.
  const filteredData = useMemo(() => {
    return (props.users?.data ?? []).filter((row) => {
      if (roleFilter !== 'all' && !(row.roles ?? []).includes(roleFilter)) return false;
      if (statusFilter === 'verified' && !row.verified) return false;
      if (statusFilter === 'pending' && row.verified) return false;
      return true;
    });
  }, [props.users, roleFilter, statusFilter]);

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.display({
      id: 'roles',
      header: 'Role',
      enableSorting: false,
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {(info.row.original.roles ?? []).length === 0
            ? <span className="text-xs text-muted-foreground">—</span>
            : info.row.original.roles.map((role) => (
                <Badge key={role} variant="secondary">{role}</Badge>
              ))}
        </div>
      ),
      filterFn: (row, _id, value: string) =>
        value === 'all' || (row.original.roles ?? []).includes(value),
    }),
    columnHelper.display({
      id: 'permissions',
      header: 'Permissions',
      enableSorting: false,
      cell: (info) => {
        const permissions = info.row.original.permissions ?? [];
        const shown = permissions.slice(0, 2);
        const rest = permissions.length - shown.length;
        return (
          <div className="flex flex-wrap items-center gap-1" title={permissions.join(', ')}>
            {permissions.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {shown.map((permission) => (
              <Badge key={permission} variant="outline" className="font-mono text-[10px]">{permission}</Badge>
            ))}
            {rest > 0 && <Badge variant="outline" className="text-[10px]">+{rest}</Badge>}
            {permissions.includes('*') && <Badge className="text-[10px]">ALL</Badge>}
          </div>
        );
      },
    }),
    columnHelper.accessor(
      (row) => (row.verified ? 'verified' : 'pending'),
      {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const verified = info.getValue() === 'verified';
          return (
            <Badge variant={verified ? 'default' : 'secondary'}
              className={verified ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-amber-500/90 hover:bg-amber-500/90 text-white'}>
              {verified ? 'Verified' : 'Pending'}
            </Badge>
          );
        },
        filterFn: (row, _id, value: string) =>
          value === 'all' ||
          (value === 'verified' ? row.original.verified : !row.original.verified),
      },
    ),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const user = info.row.original;
        return (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" asChild>
              <a href={`/admin/users/${user.id}`}>View</a>
            </Button>
            {props.can.update && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/admin/users/${user.id}/edit`}>Edit</a>
              </Button>
            )}
            {props.can.delete && (
              <Button size="sm" variant="destructive" onClick={() => setDeleting(user)}>
                Delete
              </Button>
            )}
          </div>
        );
      },
    }),
  ];

  // Column-level filters (role/status) feed through TanStack's filter pipeline
  // alongside the global text search.
  const columnFilters = useMemo(() => {
    const filters: Array<{ id: string; value: string }> = [];
    if (roleFilter !== 'all') filters.push({ id: 'roles', value: roleFilter });
    if (statusFilter !== 'all') filters.push({ id: 'status', value: statusFilter });
    return filters;
  }, [roleFilter, statusFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PER_PAGE } },
  });

  const goServer = (params: Record<string, unknown>) =>
    router.get('/admin/users', params, { preserveState: true });

  const confirmDelete = () => {
    if (!deleting) return;
    router.delete(`/admin/users/${deleting.id}`, { onFinish: () => setDeleting(null) });
  };

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
        {props.can.create && (
          <Button asChild>
            <a href="/admin/users/create">＋ New user</a>
          </Button>
        )}
      </div>

      {props.status && (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          {props.status}
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-0">
          {/* toolbar: live search + role filter + status filter */}
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Live search..."
              className="max-w-xs"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              {(props.roles ?? []).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by status"
            >
              <option value="all">Any status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                goServer({ q: serverQuery });
              }}
              className="ml-auto flex gap-2"
            >
              <Input
                value={serverQuery}
                onChange={(event) => setServerQuery(event.target.value)}
                placeholder="Deep search (server)..."
                className="w-56"
              />
              <Button type="submit" variant="outline">Search all</Button>
            </form>
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

      {/* client pagination over filtered rows */}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {table.getPrePaginationRowModel().rows.length} user(s)
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
          <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>

      {/* server pagination (large datasets) */}
      {(props.users?.last_page ?? 1) > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>Database pages: {page.users.current_page}/{page.users.last_page}</span>
          {page.users.current_page > 1 && (
            <Button size="sm" variant="ghost" onClick={() => goServer({ page: page.users.current_page - 1, q: serverQuery })}>
              ‹ Older
            </Button>
          )}
          {page.users.current_page < page.users.last_page && (
            <Button size="sm" variant="ghost" onClick={() => goServer({ page: page.users.current_page + 1, q: serverQuery })}>
              Newer ›
            </Button>
          )}
        </div>
      )}

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
