import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Heading>Page not found</Heading>
      <Text className="mt-3">That page does not exist.</Text>
      <Button href="/" className="mt-6">
        Back to dashboard
      </Button>
    </div>
  )
}
