import { post, type ApiResult } from '@/services/api/client'

/** Project metadata. Deliberately carries no image bytes — see fetchProjectImages. */
export interface ProjectSummary {
  id: string
  name: string
  description: string
  capacity: string
  imageCount: number
}

export interface ProjectImagePayload {
  id: string
  mimeType: string
  /** Raw base64, no data: prefix. */
  base64: string
}

export function listProjects(token: string): Promise<ApiResult<{ projects: ProjectSummary[] }>> {
  return post('listProjects', { token })
}

export function saveProject(
  token: string,
  project: { id?: string; name: string; description: string; capacity: string }
): Promise<ApiResult<{ project: ProjectSummary }>> {
  return post('saveProject', { token, project })
}

export function deleteProject(token: string, id: string): Promise<ApiResult<unknown>> {
  return post('deleteProject', { token, id })
}

/**
 * Uploads one already-downscaled photograph.
 *
 * The generous timeout is deliberate: even at ~400KB a base64 upload through Apps
 * Script is slow, and a spurious timeout would leave a file in Drive with no row
 * pointing at it.
 */
export function uploadProjectImage(
  token: string,
  id: string,
  image: { base64: string; mimeType: string; name: string }
): Promise<ApiResult<{ imageId: string; imageIds: string[] }>> {
  return post('uploadProjectImage', { token, id, ...image }, { timeoutMs: 120_000 })
}

export function deleteProjectImage(
  token: string,
  id: string,
  imageId: string
): Promise<ApiResult<{ imageIds: string[] }>> {
  return post('deleteProjectImage', { token, id, imageId })
}

/**
 * Image bytes for the exporters.
 *
 * `skipped` lists ids the server could not read — a photograph deleted from Drive
 * behind the app's back. The export continues without them rather than failing.
 */
export function fetchProjectImages(
  token: string,
  id: string
): Promise<ApiResult<{ id: string; images: ProjectImagePayload[]; skipped: string[] }>> {
  return post('getProjectImages', { token, id }, { timeoutMs: 120_000 })
}
