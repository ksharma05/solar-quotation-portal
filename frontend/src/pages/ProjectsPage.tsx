import { useEffect, useRef, useState } from 'react'
import { PhotoIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Field, Label } from '@/components/ui/fieldset'
import { Heading, Subheading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { Spinner } from '@/components/common/Spinner'
import { isConfigured } from '@/services/api/client'
import { MAX_IMAGE_EDGE } from '@/services/quotation/projectImages'
import { useAuthStore } from '@/stores/authStore'
import { useProjectsStore } from '@/stores/projectsStore'
import type { ProjectSummary } from '@/services/api/projectsApi'

interface Draft {
  id?: string
  name: string
  description: string
  capacity: string
}

const EMPTY: Draft = { name: '', description: '', capacity: '' }

/**
 * Manages the reference projects shown on quotations.
 *
 * Photographs live in Drive, one subfolder per project. They are downscaled in the
 * browser before upload — see projectImages.ts for why that matters.
 */
export function ProjectsPage() {
  const token = useAuthStore((state) => state.token)
  const { projects, loading, error, load, save, remove, addImage } = useProjectsStore()

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  if (!isConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <Heading>Reference projects</Heading>
        <Text className="mt-2">
          Backend not configured — set VITE_GAS_ENDPOINT in .env.local, then reload.
        </Text>
      </div>
    )
  }

  const onSave = async (): Promise<void> => {
    if (!token) return
    setBusy('save')
    setNotice(null)
    const ok = await save(token, {
      id: draft.id,
      name: draft.name.trim(),
      description: draft.description.trim(),
      capacity: draft.capacity.trim(),
    })
    setBusy(null)
    if (ok) {
      setNotice(draft.id ? 'Project updated.' : 'Project added.')
      setDraft(EMPTY)
    }
  }

  const onDelete = async (project: ProjectSummary): Promise<void> => {
    if (!token) return
    // Photographs go to Drive's bin with the project, so this is recoverable — but it
    // still silently changes every quotation that referenced it.
    const confirmed = window.confirm(
      `Delete "${project.name}" and its ${project.imageCount} photograph(s)?\n\n` +
        'Quotations already saved keep their reference, but the project will no longer print.'
    )
    if (!confirmed) return

    setBusy(project.id)
    await remove(token, project.id)
    setBusy(null)
    if (draft.id === project.id) setDraft(EMPTY)
  }

  const onFiles = async (files: FileList | null): Promise<void> => {
    if (!token || !uploadFor || !files?.length) return

    setBusy(uploadFor)
    setNotice(null)
    let added = 0
    // One at a time: Apps Script serialises these anyway, and a failure part-way
    // should leave the successful uploads in place rather than rolling everything back.
    for (const file of Array.from(files)) {
      if (await addImage(token, uploadFor, file)) added++
    }
    setBusy(null)
    setUploadFor(null)
    if (fileInput.current) fileInput.current.value = ''
    if (added > 0) setNotice(`Added ${added} photograph${added === 1 ? '' : 's'}.`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Heading>Reference projects</Heading>
      <Text className="mt-2">
        Past installations offered on every quotation. Photographs are resized to{' '}
        {MAX_IMAGE_EDGE}px before upload, which keeps exports and emails within Google&rsquo;s
        limits.
      </Text>

      <Divider className="my-6" />

      <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800/50">
        <Subheading>{draft.id ? 'Edit project' : 'Add a project'}</Subheading>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field>
            <Label>Project name</Label>
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="EPC - Mayo College Girls School, Ajmer"
            />
          </Field>
          <Field>
            <Label>Capacity</Label>
            <Input
              value={draft.capacity}
              onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
              placeholder="300 KW"
            />
          </Field>
        </div>
        <Field className="mt-4">
          <Label>Short description</Label>
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Rooftop grid-tied installation across three academic blocks."
          />
        </Field>

        <div className="mt-4 flex gap-2">
          <Button onClick={onSave} disabled={busy !== null || draft.name.trim().length < 3}>
            <PlusIcon />
            {busy === 'save' ? 'Saving…' : draft.id ? 'Save changes' : 'Add project'}
          </Button>
          {draft.id && (
            <Button outline onClick={() => setDraft(EMPTY)} disabled={busy !== null}>
              Cancel
            </Button>
          )}
        </div>

        {error && <FormError className="mt-3">{error}</FormError>}
        {notice && (
          <Text className="mt-3 text-xs/5 !text-green-700 dark:!text-green-400">{notice}</Text>
        )}
      </div>

      <Divider className="my-6" />

      {loading && projects.length === 0 ? (
        <div className="flex items-center gap-2">
          <Spinner />
          <Text className="text-xs/5">Loading projects…</Text>
        </div>
      ) : projects.length === 0 ? (
        <Text>No projects yet. Add one above.</Text>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-950/10 p-4 dark:border-white/10"
            >
              <div className="min-w-0">
                <div className="font-medium">{project.name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs/5 text-zinc-500 dark:text-zinc-400">
                  {project.capacity && <span>{project.capacity}</span>}
                  {project.capacity && <span aria-hidden="true">·</span>}
                  <PhotoIcon className="size-3.5" />
                  <span>
                    {project.imageCount === 0
                      ? 'no photographs'
                      : `${project.imageCount} photograph${project.imageCount === 1 ? '' : 's'}`}
                  </span>
                </div>
                {project.description && (
                  <Text className="mt-1 text-xs/5">{project.description}</Text>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  outline
                  disabled={busy !== null}
                  onClick={() => {
                    setUploadFor(project.id)
                    fileInput.current?.click()
                  }}
                >
                  <PhotoIcon />
                  {busy === project.id ? 'Working…' : 'Add photos'}
                </Button>
                <Button
                  outline
                  disabled={busy !== null}
                  onClick={() =>
                    setDraft({
                      id: project.id,
                      name: project.name,
                      description: project.description,
                      capacity: project.capacity,
                    })
                  }
                >
                  Edit
                </Button>
                <Button outline disabled={busy !== null} onClick={() => void onDelete(project)}>
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void onFiles(event.target.files)}
      />
    </div>
  )
}
