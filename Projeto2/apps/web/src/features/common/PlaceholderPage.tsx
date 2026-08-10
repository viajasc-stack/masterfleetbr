import { ArrowRight, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

interface PlaceholderPageProps {
  eyebrow: string
  title: string
  description: string
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <div className="page page--placeholder">
      <section className="placeholder-card">
        <span className="placeholder-card__icon"><Construction size={28} /></span>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link to="/" className="button button--primary">
          Voltar ao início <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  )
}