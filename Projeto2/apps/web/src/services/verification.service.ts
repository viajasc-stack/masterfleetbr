import { supabase } from '../lib/supabase'
import type { VerificationRequest, VerificationType } from '../types'

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024
const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
}

export const listMyVerificationRequests = async () => {
  const { data, error } = await supabase.rpc('my_verification_requests', { p_limit: 20 })
  if (error) throw error
  return data as VerificationRequest[]
}

export const uploadVerificationEvidence = async (userId: string, file: File, options?: { maxMb?: number; allowVideo?: boolean }) => {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) throw new Error('Envie JPG, PNG, WEBP ou MP4.')
  if (file.type === 'video/mp4' && options?.allowVideo === false) throw new Error('Vídeo não está habilitado para verificação neste momento.')
  const maxSize = (options?.maxMb ?? 10) * 1024 * 1024
  if (file.size > Math.min(maxSize, MAX_EVIDENCE_SIZE)) throw new Error(`A evidência deve ter no máximo ${Math.min(options?.maxMb ?? 10, 10)}MB.`)

  const extension = extensionByMime[file.type] ?? 'bin'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('verification-evidence').upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

export const createVerificationRequest = async (type: VerificationType, evidencePath: string, evidenceMimeType: string) => {
  const { data, error } = await supabase.rpc('create_verification_request', {
    p_type: type,
    p_evidence_path: evidencePath,
    p_evidence_mime_type: evidenceMimeType,
  })
  if (error) throw error
  return data as VerificationRequest
}