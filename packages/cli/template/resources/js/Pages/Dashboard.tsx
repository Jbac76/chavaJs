import { Link } from '@inertiajs/react';
import { ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';

interface DashboardProps {
  user: {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    created_at: string;
  };
  stats: {
    totalUsers: number;
    recentUsers: Array<{ id: number; name: string; email: string; is_admin: boolean }>;
  };
}

export default function Dashboard({ user, stats }: DashboardProps) {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">
        <Badge variant="secondary" className="gap-1.5">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Authentication · Phase 4 · Sessions &amp; Policies
        </Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Hi, <span className="text-primary">{user.name}</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          You are signed in through the session guard — this page is protected by the{' '}
          <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">auth</code> middleware.
          {user.is_admin ? ' You are an administrator.' : ''}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </span>
            <div>
              <CardTitle className="text-base">Users</CardTitle>
              <p className="text-xs text-muted-foreground">{stats.totalUsers} registered</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                <span className="font-medium">{u.name}</span>
                <Badge variant={u.is_admin ? 'default' : 'secondary'}>{u.is_admin ? 'Admin' : 'Member'}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/users">
                Browse all users
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
