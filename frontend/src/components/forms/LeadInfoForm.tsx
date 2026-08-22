import { useFormContext } from 'react-hook-form'
import { ErrorMessage, Field, FieldGroup, Label } from '@/components/ui/fieldset'
import { Input } from '@/components/ui/input'
import { Subheading } from '@/components/ui/heading'
import type { QuotationFormValues } from '@/services/validation/quotationSchema'

export function LeadInfoForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<QuotationFormValues>()

  return (
    <section>
      <Subheading>Client</Subheading>
      <FieldGroup className="mt-4 grid gap-6 sm:grid-cols-2">
        <Field>
          <Label>Client name</Label>
          <Input {...register('leadName')} placeholder="Anil Bhaiya Ji" />
          {errors.leadName && <ErrorMessage>{errors.leadName.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Project / location</Label>
          <Input {...register('projectName')} placeholder="Ajmer, Rajasthan" />
          {errors.projectName && <ErrorMessage>{errors.projectName.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Email</Label>
          <Input type="email" {...register('email')} placeholder="Optional" />
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Phone</Label>
          <Input {...register('phone')} placeholder="Optional — 10 digits" />
          {errors.phone && <ErrorMessage>{errors.phone.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Quotation number</Label>
          <Input {...register('quotationNumber')} placeholder="SGT/2026/04/B21" />
          {errors.quotationNumber && <ErrorMessage>{errors.quotationNumber.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Quotation date</Label>
          <Input type="date" {...register('quotationDate')} />
          {errors.quotationDate && <ErrorMessage>{errors.quotationDate.message}</ErrorMessage>}
        </Field>

        <Field>
          <Label>Valid for (days)</Label>
          <Input type="number" {...register('validityDays', { valueAsNumber: true })} />
          {errors.validityDays && <ErrorMessage>{errors.validityDays.message}</ErrorMessage>}
        </Field>
      </FieldGroup>
    </section>
  )
}
