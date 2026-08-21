# Frontend

The front end is React + Inertia + Tailwind CSS + shadcn/ui + Motion, served
by Vite. Server components render on the server for full page loads and
navigate with JSON payloads after that — no page reloads, no API layer for
page data.

## Rendering pages

From any controller or route closure, render an Inertia page with the
`Inertia` facade. The component name resolves to a file in
`resources/js/Pages`:

```ts
import { Inertia } from '../src/facades';

// resources/js/Pages/Users/Index.tsx
return Inertia.render('Users/Index', { users });

// navigation-only (no props)
return Inertia.render('About');
```

For `X-Inertia` requests the response is the JSON page payload
`{ component, props, url, version }`; for full page loads the server renders
the HTML shell around the component.

## Pages receive props

```tsx
// resources/js/Pages/Users/Index.tsx
import { usePage } from '@inertiajs/react';

export default function UsersIndex() {
  const { users } = usePage().props;
  return (
    <ul>
      {users.map((user) => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

## Linking & navigation

`Link` and the `router` helper from `@inertiajs/react` drive Inertia
navigation:

```tsx
import { Link } from '@inertiajs/react';

<Link href="/users" className="text-indigo-600">Users</Link>
```

```tsx
import { router } from '@inertiajs/react';

const submit = (e) => {
  e.preventDefault();
  router.post('/login', { email, password });
};
```

## Sharing data

Share data with every response (`Inertia.share()` in a service provider or
middleware — the starter shares the authenticated user):

```ts
import { Inertia } from '../src/facades';

Inertia.share('app', { name: Config.get('app.name') });
Inertia.share({ user: await request.user() });
```

Shared props are merged under each response's props automatically.

## Versions & asset reloads

`config/frontend.ts` holds the asset `version`. When it changes (after
`vite build`), Inertia detects the mismatch and responds `409` with
`X-Inertia-Location`, triggering a full page load — no stale markup.

## Vite

- Development: the chavaJs server runs Vite alongside itself; assets are
  served from `VITE_URL` (`http://localhost:5173`).
- Production: `npm run build` typechecks then builds into `public/build/`,
  which the server serves statically.

## Component library

`resources/js/Components/ui` ships shadcn-style primitives (button, card,
input, label, badge) built on Radix + class-variance-authority, and
`Layouts/AppLayout.tsx` is the shell with the navigation bar and theme toggle.
`Motion` powers the page transitions (`hooks/use-inertia-transition.ts`).

## Next

- [Controllers](05-controllers) — where pages are rendered
- [Deployment](22-deployment) — building for production