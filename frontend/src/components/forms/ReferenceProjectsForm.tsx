import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { PhotoIcon } from '@heroicons/react/16/solid'
import { CheckboxField, CheckboxGroup, Checkbox } from '@/components/ui/checkbox'
import { Description, Label } from '@/components/ui/fieldset'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { Spinner } from '@/components/common/Spinner'
import { isConfigured } from '@/services/api/client'
import { useAuthStore } from '@/stores/authStore'
import { useProjectsStore } from '@/stores/projectsStore'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

/**
 * Picks the reference projects printed at the end of the quotation.
 *
 * Selecting none is a normal choice, not an error: the document then omits the
 * "Some of our projects" section entirely.
 */
export function ReferenceProjectsForm() {
  const { control } = useFormContext<QuotationFormValues>()
  const token = useAuthStore((state) => state.token)
  const projects = useProjectsStore((state) => state.projects)
  const loading = useProjectsStore((state) => state.loading)
  const error = useProjectsStore((state) => state.error)
  const load = useProjectsStore((state) => state.load)

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  return (
    <section>
      <Subheading>Reference projects</Subheading>
      <Text className="mt-1 text-xs/5">
        Past installations to show at the end of the quotation, with their photographs. Leave
        every box clear to omit the section.
      </Text>

      {!isConfigured() && (
        <Text className="mt-4 text-xs/5">
          Backend not configured — set VITE_GAS_ENDPOINT in .env.local to manage projects.
        </Text>
      )}

      {loading && projects.length === 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Spinner />
          <Text className="text-xs/5">Loading projects…</Text>
        </div>
      )}

      {error && <FormError className="mt-3">{error}</FormError>}

      {!loading && projects.length === 0 && isConfigured() && !error && (
        <Text className="mt-4 text-xs/5">
          No projects yet.{' '}
          <Link to="/projects" className="text-blue-600 underline dark:text-blue-400">
            Add one
          </Link>{' '}
          to show past installations on your quotations.
        </Text>
      )}

      {projects.length > 0 && (
        <Controller
          control={control}
          name="referenceProjectIds"
          render={({ field }) => {
            const selected = field.value ?? []
            const toggle = (id: string, checked: boolean): void =>
              field.onChange(
                checked ? [...selected, id] : selected.filter((candidate) => candidate !== id)
              )

            return (
              <CheckboxGroup className="mt-4">
                {projects.map((project) => (
                  <CheckboxField key={project.id}>
                    <Checkbox
                      name={`project-${project.id}`}
                      checked={selected.includes(project.id)}
                      onChange={(checked) => toggle(project.id, checked)}
                    />
                    <Label>{project.name}</Label>
                    <Description>
                      <span className="inline-flex items-center gap-1">
                        {project.capacity && <span>{project.capacity}</span>}
                        {project.capacity && <span aria-hidden="true">·</span>}
                        <PhotoIcon className="size-3.5" />
                        {project.imageCount === 0
                          ? 'no photographs'
                          : `${project.imageCount} photograph${project.imageCount === 1 ? '' : 's'}`}
                      </span>
                      {project.description && <span className="block">{project.description}</span>}
                    </Description>
                  </CheckboxField>
                ))}
              </CheckboxGroup>
            )
          }}
        />
      )}
    </section>
  )
}
