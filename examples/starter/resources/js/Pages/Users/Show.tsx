import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';

interface PostRecord {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  posts: PostRecord[] | null;
}

interface ShowPageProps {
  user: UserRecord;
  [key: string]: unknown;
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function UsersShow() {
  const { props } = usePage<ShowPageProps>();
  const { user } = props;
  const postCount = user.posts?.length ?? 0;

  return (
    <div className="space-y-10">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
            Back to users
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-xl font-bold text-primary">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">{user.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
          </div>
          <Badge className="ml-auto" variant={user.is_admin ? 'default' : 'secondary'}>
            {user.is_admin ? 'Admin' : 'Member'}
          </Badge>
        </div>
      </motion.div>

      {/* posts */}
      <section className="space-y-4">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="font-display text-xl font-bold tracking-tight"
        >
          Posts <span className="text-primary">{postCount}</span>
        </motion.h2>

        {postCount > 0 ? (
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4">
            {user.posts?.map((post) => (
              <motion.div key={post.id} variants={staggerItem}>
                <Card className="transition-shadow duration-300 hover:shadow-md">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{post.title}</h3>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{post.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            No posts yet.
          </motion.p>
        )}
      </section>
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
