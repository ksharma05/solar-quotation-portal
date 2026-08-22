import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'

/**
 * Catches render errors so one broken page cannot blank the whole app.
 *
 * Must be a class: React exposes no hook equivalent of componentDidCatch.
 *
 * This exists because of a real incident — Catalyst's <ErrorMessage> used outside a
 * <Field> threw during render and took the entire quotation page down with a white
 * screen and only a console trace.
 */
interface Props {
  children: ReactNode
  /** Remounts the boundary when this changes, so navigation clears a stuck error. */
  resetKey?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error:', error, info.componentStack)
  }

  componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl py-12">
        <Heading>Something broke on this page</Heading>
        <Text className="mt-3">
          The rest of the app is unaffected. Your costing sheet and any draft are saved
          locally and will still be there.
        </Text>

        <pre className="mt-6 overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs/5 text-red-700 dark:bg-zinc-800 dark:text-red-400">
          {error.message}
        </pre>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button outline href="/">
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }
}
