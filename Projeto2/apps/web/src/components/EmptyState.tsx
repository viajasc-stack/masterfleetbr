import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon"><Icon size={26} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  )
}