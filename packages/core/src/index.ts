// ----------------------------------------------------------- chavaJs core
// Barrel export — re-exports every public API users commonly need.
//
// Usage (when installed as a dependency):
//   import { Route, Inertia, Config, DB } from '@chavajs/core';
//   import { Model } from '@chavajs/core/orm/Model';
//   import { Job } from '@chavajs/core/queue/Job';

// Facades (the primary import surface)
export {
  App,
  Config,
  Route,
  DB,
  Schema,
  Auth,
  Gate,
  Session,
  Event,
  Queue,
  Mail,
  Notification,
  Schedule,
  Inertia,
  Env,
} from './facades';

// Container / DI
export { Container } from './container/Container';
export type { ContextualBindingBuilder } from './container/Container';
export { facade } from './container/Facade';
export { ServiceProvider } from './container/ServiceProvider';

// HTTP
export { Controller } from './http/Controller';
export { HttpKernel } from './http/Kernel';
export { Request } from './http/Request';
export { Response } from './http/Response';
export { Route as RouteClass } from './http/Route';
export { Router } from './http/Router';

// ORM
export { Model } from './orm/Model';
export type { ModelClass, CastType } from './orm/Model';
export { Factory } from './orm/Factory';

// Database
export type { DatabaseManager } from './database/DatabaseManager';
export { Migrator } from './database/Migrator';
export { Seeder } from './database/Seeder';

// Validation
export { Validator } from './validation/Validator';
export { FormRequest } from './validation/FormRequest';

// Auth
export type { AuthManager } from './auth/AuthManager';
export { Hash } from './auth/Hash';
export type { Gate as GateService } from './auth/Gate';
export { Policy } from './auth/Policy';

// Session
export type { SessionManager } from './session/SessionManager';
export type { SessionStore } from './session/SessionStore';

// Events
export type { Dispatcher as EventDispatcher } from './events/Dispatcher';
export { ShouldQueue } from './events/queue';

// Queue
export { Job } from './queue/Job';
export { registerJob } from './queue/Job';
export type { QueueManager } from './queue/QueueManager';

// Mail
export { Mailable } from './mail/Mailable';
export type { MailManager } from './mail/MailManager';

// Notifications
export { Notifiable } from './notifications/Notifiable';
export type { NotificationManager } from './notifications/NotificationManager';
export type { Notification as NotificationType, DatabaseNotificationData, NotifiableModel } from './notifications/types';

// Scheduling
export type { Scheduler as SchedulerService } from './scheduling/Scheduler';

// Foundation
export type { Application } from './foundation/Application';
export { currentApp } from './foundation/registry';

// Exceptions
export {
  RuntimeException,
  BindingResolutionException,
  NotFoundException,
  MethodNotAllowedException,
  ValidationException,
  AuthorizationException,
} from './support/exceptions';

// Support
export { getPath, hasPath, deepMerge } from './support/dot';
export { isClass, paramNamesOf } from './support/reflect';

// Config
export type { Config as ConfigService } from './config/Config';

// Inertia
export type { Inertia as InertiaService } from './inertia/Inertia';
