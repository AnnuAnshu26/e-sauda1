import { motion } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * Curtain-style reveal used across every page for scroll-triggered entrances.
 *
 * Deliberately NOT an opacity fade-up. Content sits behind an
 * overflow-hidden mask and slides up into place from behind that edge, so it
 * arrives already in full focus, "uncovered" by the motion rather than
 * materializing out of nothing. This is the same wipe pattern the reference
 * video uses for its headline and image reveals.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div className={`h-full overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: '100%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
        className="h-full"
      >
        {children}
      </motion.div>
    </div>
  )
}
