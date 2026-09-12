import { create } from 'zustand'
import {
  deleteProject as apiDeleteProject,
  deleteProjectImage as apiDeleteProjectImage,
  fetchProjectImages,
  listProjects,
  saveProject as apiSaveProject,
  uploadProjectImage,
  type ProjectSummary,
} from '@/services/api/projectsApi'
import { measureImage, prepareImageForUpload } from '@/services/quotation/projectImages'
import type { ExportImage, ResolvedProject } from '@/services/export/documentModel'

/**
 * Reference projects, plus a session cache of their photograph bytes.
 *
 * The cache is the point: photographs are fetched once per session rather than once per
 * export, so generating a PDF and then a Word file does not pull several megabytes
 * through Apps Script twice. Deliberately NOT persisted — it would blow past
 * localStorage's quota immediately.
 */
interface ProjectsState {
  projects: ProjectSummary[]
  loading: boolean
  error: string | null
  /** Decoded photographs, keyed by project id. */
  imageCache: Record<string, ExportImage[]>

  load: (token: string, options?: { force?: boolean }) => Promise<void>
  save: (
    token: string,
    project: { id?: string; name: string; description: string; capacity: string }
  ) => Promise<boolean>
  remove: (token: string, id: string) => Promise<boolean>
  addImage: (token: string, id: string, file: File) => Promise<boolean>
  removeImage: (token: string, id: string, imageId: string) => Promise<boolean>
  /** Photographs for the exporters, fetched and decoded on demand. */
  resolve: (token: string, ids: string[]) => Promise<ResolvedProject[]>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  imageCache: {},

  load: async (token, options = {}) => {
    if (get().projects.length > 0 && !options.force) return

    set({ loading: true, error: null })
    const result = await listProjects(token)
    if (!result.ok) {
      set({ loading: false, error: result.message })
      return
    }
    set({ projects: result.data.projects, loading: false, error: null })
  },

  save: async (token, project) => {
    const result = await apiSaveProject(token, project)
    if (!result.ok) {
      set({ error: result.message })
      return false
    }
    await get().load(token, { force: true })
    return true
  },

  remove: async (token, id) => {
    const result = await apiDeleteProject(token, id)
    if (!result.ok) {
      set({ error: result.message })
      return false
    }
    // Drop the cache entry too, or a stale photograph survives the project.
    set((state) => {
      const imageCache = { ...state.imageCache }
      delete imageCache[id]
      return { imageCache }
    })
    await get().load(token, { force: true })
    return true
  },

  addImage: async (token, id, file) => {
    try {
      const prepared = await prepareImageForUpload(file)
      const result = await uploadProjectImage(token, id, {
        base64: prepared.base64,
        mimeType: prepared.mimeType,
        name: prepared.name,
      })
      if (!result.ok) {
        set({ error: result.message })
        return false
      }
      set((state) => {
        const imageCache = { ...state.imageCache }
        delete imageCache[id]
        return { imageCache }
      })
      await get().load(token, { force: true })
      return true
    } catch (error) {
      set({ error: (error as Error).message })
      return false
    }
  },

  removeImage: async (token, id, imageId) => {
    const result = await apiDeleteProjectImage(token, id, imageId)
    if (!result.ok) {
      set({ error: result.message })
      return false
    }
    set((state) => {
      const imageCache = { ...state.imageCache }
      delete imageCache[id]
      return { imageCache }
    })
    await get().load(token, { force: true })
    return true
  },

  resolve: async (token, ids) => {
    const { projects, imageCache } = get()
    const resolved: ResolvedProject[] = []
    const nextCache = { ...imageCache }

    // Selection order is the operator's; preserve it rather than the catalogue's.
    for (const id of ids) {
      const summary = projects.find((project) => project.id === id)
      if (!summary) continue

      let images = nextCache[id]

      // The catalogue listing already carries the photograph count, so a project known
      // to have none is answered locally. Asking Apps Script to confirm it costs a full
      // round trip — POST, 302, two spreadsheet opens — to be handed back an empty list.
      if (!images && summary.imageCount === 0) images = []

      if (!images) {
        const result = await fetchProjectImages(token, id)
        if (!result.ok) {
          // An unreachable folder must not cost the whole export, so the project
          // resolves with no photographs — which now omits it from the document.
          // ShareOptions compares what it selected against what survived and tells the
          // operator, so a silently shortened quotation cannot be sent unnoticed.
          console.warn(`Could not load photographs for "${summary.name}": ${result.message}`)
          images = []
        } else {
          const measured = await Promise.all(
            result.data.images.map(async (image) => {
              const size = await measureImage(image.base64, image.mimeType)
              // Undecodable bytes are skipped, never guessed at — the exporters need
              // real dimensions to preserve aspect ratio.
              return size ? { ...image, ...size } : null
            })
          )
          images = measured.filter((image): image is ExportImage => image !== null)
        }
        nextCache[id] = images
      }

      resolved.push({
        id: summary.id,
        name: summary.name,
        description: summary.description,
        capacity: summary.capacity,
        images,
      })
    }

    set({ imageCache: nextCache })
    return resolved
  },
}))
