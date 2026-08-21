import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import type { Transition } from 'motion/react';

export interface InertiaTransitionOptions {
  /** Duration of the page transition in seconds. */
  duration?: number;
  /** Delay before the transition starts in seconds. */
  delay?: number;
}

/**
 * Returns Motion props keyed to the current Inertia page component, so the
 * layout re-animates (fade + rise) whenever the user navigates.
 *
 *   <motion.div {...useInertiaTransition()}>{children}</motion.div>
 */
export function useInertiaTransition(options: InertiaTransitionOptions = {}) {
  const { component } = usePage();
  const { duration = 0.3, delay = 0 } = options;

  const transition: Transition = { duration, delay, ease: 'easeOut' };

  return useMemo(
    () => ({
      key: component,
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition,
    }),
    // transition object is recreated per render; keying on its primitives keeps memo stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [component, duration, delay],
  );
}
