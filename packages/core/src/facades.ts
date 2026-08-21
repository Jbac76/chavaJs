import { Config as ConfigService } from './config/Config';
import { Env } from './config/Env';
import { facade } from './container/Facade';
import type { DatabaseManager } from './database/DatabaseManager';
import type { Schema as SchemaService } from './database/schema/Schema';
import type { Application } from './foundation/Application';
import type { Router } from './http/Router';
import type { AuthManager } from './auth/AuthManager';
import type { Gate as GateService } from './auth/Gate';
import type { SessionManager } from './session/SessionManager';
import type { Dispatcher as EventDispatcher } from './events/Dispatcher';
import type { QueueManager } from './queue/QueueManager';
import type { MailManager } from './mail/MailManager';
import type { NotificationManager } from './notifications/NotificationManager';
import type { Scheduler as SchedulerService } from './scheduling/Scheduler';
import type { Inertia as InertiaService } from './inertia/Inertia';

/**
 * Facades — Laravel's static accessors, ported as Proxy-based singletons:
 *
 *   import { Route, Inertia, Config } from '../src/facades';
 *   Route.get('/', [HomeController, 'index']);
 *   Inertia.render('Pages/Home', { ... });
 *   Config.get('app.name');
 */
export const App = facade<Application>('app');
export const Config = facade<ConfigService>('config');
export const Route = facade<Router>('router');
export const DB = facade<DatabaseManager>('db');
export const Schema = facade<SchemaService>('schema');
export const Auth = facade<AuthManager>('auth');
export const Gate = facade<GateService>('gate');
export const Session = facade<SessionManager>('session');
export const Event = facade<EventDispatcher>('events');
export const Queue = facade<QueueManager>('queue');
export const Mail = facade<MailManager>('mail');
export const Notification = facade<NotificationManager>('notifications');
export const Schedule = facade<SchedulerService>('schedule');
export const Inertia = facade<InertiaService>('inertia');
export { Env };
