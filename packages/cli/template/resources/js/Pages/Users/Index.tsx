import { Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Database, Mail, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';

interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  posts: UserRecord[] | null;
}

interface UsersPageProps {
  users: {
    data: UserRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  can?: {
    deleteUser: boolean;
  };
  [key: string]: unknown;
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function UsersIndex() {
  const { props } = usePage<UsersPageProps>();
  const { users, can } = props;

  function remove(user: UserRecord) {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    router.delete(`/users/${user.id}`, { preserveScroll: true });
  }

  return (
    <div className="space-y-8">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <Badge variant="secondary" className="gap-1.5">
          <Database className="h-3 w-3 text-primary" />
          Database · Phase 3 · Eloquent ORM
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Users <span className="text-primary">{users.total}</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Seeded through the Eloquent-equivalent ORM and eager-loaded with their posts:
          <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
            User.with(&apos;posts&apos;).orderBy(&apos;name&apos;).paginate(10)
          </code>
        </p>
      </motion.div>

      {/* user cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {users.data.map((user) => (
          <motion.div key={user.id} variants={staggerItem}>
            <Card className="h-full transition-shadow duration-300 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{user.name}</CardTitle>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                  {user.is_admin ? 'Admin' : 'Member'}
                </Badge>
                <span className="text-xs text-muted-foreground">{user.posts?.length ?? 0} posts</span>
                <div className="flex items-center gap-1.5">
                  {can?.deleteUser && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(user)}
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/users/${user.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm text-muted-foreground">
        <span>
          Showing {users.from ?? 0}–{users.to ?? 0} of {users.total}
        </span>
        <div className="flex items-center gap-2">
          {users.current_page > 1 ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/users?page=${users.current_page - 1}`}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
          )}
          <span className="font-mono text-xs">
            Page {users.current_page} of {users.last_page}
          </span>
          {users.current_page < users.last_page ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/users?page=${users.current_page + 1}`}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
