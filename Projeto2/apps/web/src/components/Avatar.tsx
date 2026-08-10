import { UserRound } from 'lucide-react'
import { initials } from '../lib/format'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  ring?: boolean
}

export function Avatar({ name, src, size = 'md', ring = false }: AvatarProps) {
  return (
    <span className={`avatar avatar--${size} ${ring ? 'avatar--ring' : ''}`} aria-label={`Avatar de ${name}`}>
      {src ? <img src={src} alt="" /> : <span className="avatar__fallback">{name ? initials(name) : <UserRound size={16} />}</span>}
    </span>
  )
}