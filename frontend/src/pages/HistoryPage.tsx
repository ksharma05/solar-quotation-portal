import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { Button } from '@/components/ui/button'
import { Divider } from '@/components/ui/divider'
import { Heading } from '@/components/ui/heading'
import { Input, InputGroup } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { isConfigured } from '@/services/api/client'
import { listQuotations, type SavedQuotation } from '@/services/api/quotationApi'
import { useAuthStore } from '@/stores/authStore'
import { formatDocumentDate } from '@/utils/dates'
import { formatINR } from '@/utils/formatters'

const PAGE_SIZE = 20

export function HistoryPage() {
  const token = useAuthStore((state) => state.token)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<SavedQuotation[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // A filtered request scans the whole sheet, so avoid firing one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!isConfigured() || !token) return

    // Paging and typing can overlap; a slower earlier response must not overwrite a
    // newer one, so every run checks whether it has been superseded before writing.
    let superseded = false

    const run = async (): Promise<void> => {
      setStatus('loading')
      const result = await listQuotations(token, {
        page,
        pageSize: PAGE_SIZE,
        search: debounced,
      })
      if (superseded) return

      if (!result.ok) {
        setStatus('error')
        setMessage(result.message)
        return
      }
      setRows(result.data.rows)
      setTotal(result.data.total)
      setStatus('idle')
    }

    void run()
    return () => {
      superseded = true
    }
  }, [token, page, debounced])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  if (!isConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        <Heading>History</Heading>
        <Divider className="my-6" />
        <Text>
          History reads from Google Sheets. Set <code>VITE_GAS_ENDPOINT</code> in{' '}
          <code>.env.local</code> and deploy the Apps Script backend to see saved quotations.
        </Text>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Heading>History</Heading>
      <Text className="mt-2">
        Saved quotations, newest first. Search covers quotation number, client, project, phone
        and email.
      </Text>

      <div className="mt-6 max-w-md">
        <InputGroup>
          <MagnifyingGlassIcon />
          <Input
            placeholder="Search quotations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>

      <Divider className="my-6" />

      {status === 'error' && <FormError className="mb-4">{message}</FormError>}

      {status === 'loading' && rows.length === 0 ? (
        <Text>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text>{debounced ? `No quotations match “${debounced}”.` : 'No quotations yet.'}</Text>
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Quotation</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Project</TableHeader>
              <TableHeader className="text-right">Capacity</TableHeader>
              <TableHeader className="text-right">Payable</TableHeader>
              <TableHeader>PDF</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.quotationNumber}</TableCell>
                <TableCell>{formatDocumentDate(String(row.quotationDate))}</TableCell>
                <TableCell>{row.leadName}</TableCell>
                <TableCell className="max-w-48 truncate">{row.projectName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {(Number(row.capacityWp) / 1000).toFixed(2)} kW
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(Number(row.finalPayable))}
                </TableCell>
                <TableCell>
                  {row.pdfUrl ? (
                    <a
                      href={row.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline dark:text-blue-400"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {total > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <Text className="text-xs/5">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </Text>
          <div className="flex gap-2">
            <Button
              outline
              disabled={page <= 1 || status === 'loading'}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              outline
              disabled={page >= pageCount || status === 'loading'}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
