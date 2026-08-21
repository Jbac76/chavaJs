import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import type { ComponentType, ReactNode } from 'react';
import { ThemeProvider } from '@/Components/theme-provider';
import AppLayout from '@/Layouts/AppLayout';

interface PageModule {
  default: ComponentType & {
    layout?: (page: ReactNode) => ReactNode;
  };
}

// Eagerly import every page under resources/js/Pages so Inertia can resolve
// them by name (component: 'Home' → ./Pages/Home.tsx).
const pages = import.meta.glob<PageModule>('./Pages/**/*.tsx', { eager: true });

createInertiaApp({
  id: 'app',
  title: (title) => (title ? `${title} · chavaJs` : 'chavaJs'),
  resolve: (name) => {
    const page = pages[`./Pages/${name}.tsx`];
    if (!page) {
      throw new Error(`Inertia page [${name}] not found — expected ./Pages/${name}.tsx`);
    }
    // Like Laravel Breeze: the page layout must be a *wrapper* that returns
    // the layout element (Inertia invokes `Component.layout(page)` as a plain
    // function, so the component itself must not be assigned directly).
    page.default.layout = page.default.layout ?? ((pageElement: ReactNode) => <AppLayout>{pageElement}</AppLayout>);
    return page;
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <ThemeProvider>
        <App {...props} />
      </ThemeProvider>,
    );
  },
  progress: {
    color: '#FF2D20',
    showSpinner: false,
  },
});
