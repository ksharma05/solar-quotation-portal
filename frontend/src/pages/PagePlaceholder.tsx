import { Divider } from '@/components/ui/divider'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'

/**
 * Scaffold stub. Each page is replaced on the day noted in PROJECT_PLAN.md §9.
 */
export function PagePlaceholder({
  title,
  description,
  day,
}: {
  title: string
  description: string
  day: string
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <Heading>{title}</Heading>
      <Divider className="my-6" />
      <Text>{description}</Text>
      <div className="mt-6 rounded-lg border border-dashed border-zinc-950/15 p-6 dark:border-white/15">
        <Text className="text-sm/6">Scheduled for {day}.</Text>
      </div>
    </div>
  )
}
