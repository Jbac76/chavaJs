# Events

Events let you decouple parts of your app: your controllers dispatch an event
and the framework hands it to every registered listener — synchronously or on
a queue.

## Defining an event

```bash
js make:event UserRegistered
```

```ts
// app/Events/UserRegistered.ts
import { User } from '../../app/Models/User';

export class UserRegistered {
  public constructor(public readonly user: User) {}
}
```

## Defining a listener

```bash
js make:listener SendWelcomeEmail
```

```ts
// app/Listeners/SendWelcomeEmail.ts
import { UserRegistered } from '../Events/UserRegistered';

export class SendWelcomeEmail {
  public async handle(event: UserRegistered): Promise<void> {
    // Send the welcome email to event.user
  }
}
```

## Dispatching

```ts
import { Event } from '../src/facades';

await Event.dispatch(new UserRegistered(user));
```

## Registering listeners

Listeners in `app/Listeners` are auto-discovered: the framework maps each
listener to the type of its `handle()` parameter. You can also register
explicitly:

```ts
Event.listen(UserRegistered, SendWelcomeEmail);
```

To *not* auto-discover a listener, add `public static discovered = false;`.

## Queued listeners

Make a listener run on a queue by extending `ShouldQueue` — its `handle()` is
pushed as a job instead of run inline (see [Queues](16-queues)):

```ts
import { ShouldQueue } from '../../src/events/queue';

export class SendWelcomeEmail extends ShouldQueue {
  public static queue = 'default';
  public static delay = 0;
  public static tries = 3;

  public async handle(event: UserRegistered): Promise<void> {
    // Sent from a worker, never inside the request.
  }
}
```

The event is serialized with your listeners (models become class + key and are
re-retrieved when the job runs), so a slow or failing listener can never break
the request that dispatched the event.

## Next

- [Queues](16-queues) — background jobs
- [Eloquent ORM](11-eloquent) — model events and observers