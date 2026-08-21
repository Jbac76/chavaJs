import { AnimatePresence, motion } from 'motion/react';

/**
 * A form field's error message — fed from Inertia's `useForm().errors`
 * (which mirror the backend Form Request validation errors). Animates in
 * with a small slide when a field error appears and out when it clears.
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {message ? (
        <motion.p
          key={message}
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="text-xs font-medium text-destructive"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
