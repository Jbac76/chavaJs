import { Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowUpRight, Bell, BellOff, Check, CheckCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';

interface NotificationRecord {
  id: string;
  type: string;
  data: { title?: string; body?: string; url?: string };
  read_at: string | null;
  created_at: string | null;
}

interface InboxPageProps {
  notifications: NotificationRecord[];
  unreadCount: number;
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

export default function NotificationsIndex() {
  const { props } = usePage<InboxPageProps>();
  const { notifications, unreadCount } = props;
  const markAll = useForm({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => notifications.filter((item) => !dismissed.has(item.id)), [notifications, dismissed]);

  /** Mark one notification read — the item animates out while the request flies. */
  function markRead(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    router.post(`/notifications/${id}/read`, {}, {
      preserveScroll: true,
      onSuccess: () => restoreAfter(id, 350),
      onError: () => restoreAfter(id, 0),
    });
  }

  /** Mark every notification read (wired through useForm so server errors surface). */
  function markAllRead(event: React.FormEvent) {
    event.preventDefault();
    if (unreadCount === 0) return;
    setDismissed(new Set(notifications.filter((item) => !item.read_at).map((item) => item.id)));
    markAll.post('/notifications/read-all', {
      preserveScroll: true,
      onSuccess: () => window.setTimeout(() => setDismissed(new Set()), 400),
      onError: () => setDismissed(new Set()),
    });
  }

  /** Let the exit animation finish before the server re-render brings the item back. */
  function restoreAfter(id: string, delayMs: number) {
    window.setTimeout(() => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, delayMs);
  }

  return (
    <div className="space-y-8">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <Badge variant="secondary" className="gap-1.5">
          <Bell className="h-3 w-3 text-primary" />
          Notifications · Phase 5 · Database channel
        </Badge>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Inbox{' '}
              {unreadCount > 0 && (
                <motion.span
                  key={unreadCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 align-middle font-mono text-sm text-primary-foreground"
                >
                  {unreadCount}
                </motion.span>
              )}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Your database-channel notifications, powered by the Notifiable API:
              <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                user.unreadNotifications()
              </code>
            </p>
          </div>

          <form onSubmit={markAllRead}>
            <motion.div whileTap={unreadCount > 0 ? { scale: 0.97 } : undefined}>
              <Button type="submit" variant="outline" disabled={markAll.processing || unreadCount === 0}>
                <CheckCheck className="h-4 w-4" />
                {markAll.processing ? 'Marking…' : 'Mark all as read'}
              </Button>
            </motion.div>
          </form>
        </div>

        {/* useForm errors — wired to the mark-all action, like any shadcn form field. */}
        <AnimatePresence>
          {Object.keys(markAll.errors).length > 0 && (
            <motion.div
              key="mark-all-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {Object.values(markAll.errors)
                .flat()
                .join(' ')}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* list */}
      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center"
        >
          <BellOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="font-display text-lg font-semibold">You&apos;re all caught up</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            New notifications appear here when anything reaches you through the database channel.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((notification) => {
              const unread = !notification.read_at;
              return (
                <motion.div key={notification.id} variants={staggerItem} layout exit={{ opacity: 0, x: 32 }}>
                  <Card
                    className={
                      unread
                        ? 'border-l-4 border-l-primary bg-primary/[0.02] transition-shadow duration-300 hover:shadow-md'
                        : 'opacity-80 transition-opacity duration-300 hover:opacity-100'
                    }
                  >
                    <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`font-semibold ${unread ? '' : 'text-muted-foreground'}`}>
                            {notification.data.title ?? notification.type}
                          </h3>
                          {unread ? (
                            <Badge className="h-5 px-1.5 text-[10px]">New</Badge>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3 w-3" /> Read
                            </span>
                          )}
                        </div>
                        {notification.data.body && (
                          <p className="whitespace-pre-line text-sm text-muted-foreground">{notification.data.body}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{timeAgo(notification.created_at)}</span>
                          {notification.data.url && (
                            <Link
                              href={notification.data.url}
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              View <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {unread && (
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => markRead(notification.id)}
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                            <span className="hidden sm:inline">Mark read</span>
                          </Button>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function timeAgo(value: string | null): string {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
