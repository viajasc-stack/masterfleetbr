import { BadgeCheck, Crown } from 'lucide-react'

interface StatusBadgeProps {
  real?: boolean
  premium?: boolean
}

export function StatusBadge({ real = false, premium = false }: StatusBadgeProps) {
  return (
    <span className="status-badges" aria-label="Status do perfil">
      {real && <BadgeCheck size={15} className="status-badge status-badge--real" aria-label="Perfil REAL" />}
      {premium && <Crown size={15} className="status-badge status-badge--premium" aria-label="Perfil Premium" />}
    </span>
  )
}