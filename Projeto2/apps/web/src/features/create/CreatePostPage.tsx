import { ArrowLeft, Check, ImagePlus, MapPin, UploadCloud, Video } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { getRuntimeSettings } from '../../services/settings.service'
import { uploadPostAndCreate } from '../../services/social.service'
import type { ContentPrivacy, RuntimeSettings } from '../../types'

export function CreatePostPage() {
  const { user, profile } = useOutletContext<LovixAppContext>()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [locationName, setLocationName] = useState('')
  const [privacy, setPrivacy] = useState<ContentPrivacy>('public')
  const [settings, setSettings] = useState<RuntimeSettings>({})
  const [loading, setLoading] = useState(false)
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file])

  useEffect(() => {
    let active = true
    getRuntimeSettings(['content'])
      .then(nextSettings => { if (active) setSettings(nextSettings) })
      .catch(error => console.error('Falha ao carregar settings de conteúdo:', error))
    return () => { active = false }
  }, [])

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (!selected.type.startsWith('image/') && !selected.type.startsWith('video/')) {
      toast.error('Escolha uma imagem ou vídeo.')
      return
    }
    if (selected.size > 25 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 25 MB.')
      return
    }
    setFile(selected)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      toast.error('Escolha uma mídia para publicar.')
      return
    }
    if (settings.content?.requireRealToPost === true && !profile.is_real) {
      toast.error('A plataforma exige selo REAL para publicar no momento. Solicite verificação manual.')
      return
    }
    setLoading(true)
    try {
      await uploadPostAndCreate({ authorId: user.id, file, caption, locationName, privacy })
      toast.success('Publicação compartilhada com sucesso.')
      navigate('/', { replace: true })
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível publicar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--compose">
      <header className="page-header page-header--compact">
        <Link to="/" className="icon-button" aria-label="Voltar"><ArrowLeft size={20} /></Link>
        <div><span className="eyebrow">NOVA PUBLICAÇÃO</span><h1>Compartilhe um momento</h1></div>
      </header>
      <form className="composer" onSubmit={handleSubmit}>
        <section className="composer__media" onClick={() => !file && inputRef.current?.click()}>
          {file ? (
            <>
              {file.type.startsWith('video/') ? <video src={previewUrl} controls /> : <img src={previewUrl} alt="Prévia da publicação" />}
              <button type="button" className="button button--secondary composer__change-media" onClick={() => inputRef.current?.click()}>Trocar mídia</button>
            </>
          ) : (
            <div className="media-dropzone">
              <span className="media-dropzone__icon"><UploadCloud size={30} /></span>
              <h2>Adicione uma foto ou vídeo</h2>
              <p>Escolha uma mídia que represente você. Até 25 MB.</p>
              <span className="button button--secondary">Selecionar arquivo</span>
              <small><ImagePlus size={14} /> imagens · <Video size={14} /> vídeos</small>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" hidden onChange={selectFile} />
        </section>
        <section className="composer__details">
          <div className="composer__author"><Avatar name={profile.display_name || profile.username} src={profile.avatar_url} /><span><strong>{profile.display_name || profile.username}</strong><small>@{profile.username}</small></span></div>
          <label className="field"><span>Legenda</span><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={2200} rows={6} placeholder="O que você gostaria de compartilhar?" /><small>{caption.length}/2200</small></label>
          <label className="field"><span>Localização <em>opcional</em></span><div className="field__control"><MapPin size={18} /><input value={locationName} onChange={event => setLocationName(event.target.value)} maxLength={100} placeholder="Ex.: São Paulo, SP" /></div></label>
          <label className="field"><span>Quem pode ver?</span><select value={privacy} onChange={event => setPrivacy(event.target.value as ContentPrivacy)}><option value="public">Toda a comunidade</option><option value="followers">Pessoas que me seguem</option><option value="following">Apenas quem eu sigo</option><option value="private">Apenas eu</option></select></label>
          {settings.content?.requireRealToPost === true && !profile.is_real && <div className="composer__notice"><Check size={17} /><span>Publicações estão restritas a perfis com selo REAL. Vá em Configurações &gt; Verificação manual.</span></div>}
          <div className="composer__notice"><Check size={17} /><span>Ao publicar, você confirma que possui os direitos sobre a mídia e respeita a Política de Consentimento.</span></div>
          <button className="button button--primary button--full" disabled={loading}>{loading ? 'Publicando...' : 'Publicar agora'}</button>
        </section>
      </form>
    </div>
  )
}