import { supabase } from '../lib/supabase'
import type { AdminAuditLog, AdminDashboardMetrics, AdminDetailPayload, AdminPost, AdminProfile, AdminReport, AdminRole, AdminSaasMetrics, AdminSetting, AdminVerificationRequest, VerificationStatus } from '../types'

const rpc = async <T>(name: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}

export const getAdminDashboardMetrics = () => rpc<AdminDashboardMetrics>('admin_dashboard_metrics')
export const getAdminSaasMetrics = () => rpc<AdminSaasMetrics>('admin_saas_metrics')
export const listAdminProfiles = (query = '') => rpc<AdminProfile[]>('admin_list_profiles', { p_query: query, p_limit: 80 })
export const setAdminUserStatus = (targetUserId: string, nextStatus: string, reason = '') => rpc<AdminProfile>('admin_set_user_status', { target_user_id: targetUserId, next_status: nextStatus, reason_text: reason })
export const setAdminProfileFlags = (targetUserId: string, isReal?: boolean, isVerified?: boolean) => rpc<AdminProfile>('admin_set_profile_flags', { target_user_id: targetUserId, p_is_real: isReal, p_is_verified: isVerified })
export const grantAdminPremium = (targetUserId: string, days: 30 | 60 | 90, reason = '') => rpc<AdminProfile>('admin_grant_premium', { target_user_id: targetUserId, days_count: days, reason_text: reason })
export const revokeAdminPremium = (targetUserId: string, reason = '') => rpc<AdminProfile>('admin_revoke_premium', { target_user_id: targetUserId, reason_text: reason })
export const listAdminReports = (status?: string) => rpc<AdminReport[]>('admin_list_reports', { p_status: status || null, p_limit: 80 })
export const resolveAdminReport = (reportId: string, nextStatus: string, reason = '') => rpc<AdminReport>('admin_resolve_report', { report_uuid: reportId, next_status: nextStatus, reason_text: reason })
export const listAdminPosts = (status?: string, privacy?: string) => rpc<AdminPost[]>('admin_list_posts', { p_status: status || null, p_privacy: privacy || null, p_limit: 80 })
export const setAdminPostModeration = (postId: string, nextStatus: string, reason = '') => rpc<AdminPost>('admin_set_post_moderation', { post_uuid: postId, next_status: nextStatus, reason_text: reason })
export const listAdminAuditLogs = () => rpc<AdminAuditLog[]>('admin_list_audit_logs', { p_limit: 120 })
export const listAdminVerificationRequests = (status?: VerificationStatus | '') => rpc<AdminVerificationRequest[]>('admin_list_verification_requests', { p_status: status || null, p_limit: 100 })
export const reviewAdminVerification = (requestId: string, nextStatus: VerificationStatus, reason = '', privateNotes = '') => rpc<AdminVerificationRequest>('admin_review_verification', { request_uuid: requestId, next_status: nextStatus, reason_text: reason, private_notes: privateNotes })
export const deleteAdminVerificationEvidence = (requestId: string, reason = '') => rpc<AdminVerificationRequest>('admin_delete_verification_evidence', { request_uuid: requestId, reason_text: reason })
export const listAdminSettings = () => rpc<AdminSetting[]>('admin_list_settings')
export const updateAdminSetting = (key: string, value: Record<string, unknown>, reason = '') => rpc<AdminSetting>('admin_update_setting', { setting_key: key, setting_value: value, reason_text: reason })
export const listAdminRoles = () => rpc<AdminRole[]>('admin_list_roles')
export const setAdminRole = (targetUserId: string, role: AdminRole['role'], permissions: Record<string, unknown> = {}, reason = '') => rpc<AdminRole>('admin_set_role', { target_user_id: targetUserId, next_role: role, permissions_value: permissions, reason_text: reason })
export const cleanupExpiredVerificationEvidence = (reason = '') => rpc<number>('admin_cleanup_expired_verification_evidence', { reason_text: reason || 'Limpeza manual de evidências expiradas' })
export const getAdminUserDetail = (targetUserId: string) => rpc<AdminDetailPayload>('admin_get_user_detail', { target_user_id: targetUserId })
export const getAdminPostDetail = (postId: string) => rpc<AdminDetailPayload>('admin_get_post_detail', { post_uuid: postId })
export const getAdminVerificationDetail = (requestId: string) => rpc<AdminDetailPayload>('admin_get_verification_detail', { request_uuid: requestId })
export const openAdminVerificationEvidence = async (requestId: string) => {
  const access = await rpc<Array<{ evidence_path: string; expires_in_seconds: number }>>('admin_get_verification_evidence_access', { request_uuid: requestId })
  const first = access[0]
  if (!first?.evidence_path) throw new Error('Evidência indisponível.')
  const { data, error } = await supabase.storage.from('verification-evidence').createSignedUrl(first.evidence_path, first.expires_in_seconds)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}