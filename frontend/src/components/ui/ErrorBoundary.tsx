import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert } from './Alert'
import { Button } from './Button'

interface Props {
  title: string
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Alert
        tone="error"
        title={this.props.title}
        actions={
          <Button variant="ghost" onClick={this.props.onAction}>
            {this.props.actionLabel}
          </Button>
        }
      >
        <code>{this.state.error.message}</code>
      </Alert>
    )
  }
}
