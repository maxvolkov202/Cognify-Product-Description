"use client";

import { AnimatePresence, motion } from "motion/react";

/** Generic motion-height accordion primitive. Renders nothing collapsed,
 *  expands inline with a smooth height animation. Wrap content that should
 *  open/close together. */
export function Disclosure({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="disclosure"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          style={{ overflow: "hidden" }}
        >
          <div>{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
