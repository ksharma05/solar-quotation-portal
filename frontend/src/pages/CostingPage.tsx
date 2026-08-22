import { CostingSheet } from '@/components/costing/CostingSheet'
import { Divider } from '@/components/ui/divider'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'

export function CostingPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Heading>Costing Sheet</Heading>
      <Text className="mt-2">
        Internal only. Enter the actual rupee cost of each line; the rate per watt is derived.
        Nothing on this page appears on a customer quotation.
      </Text>
      <Divider className="my-6" />
      <CostingSheet />
    </div>
  )
}
