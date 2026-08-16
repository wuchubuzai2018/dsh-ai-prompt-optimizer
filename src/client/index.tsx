import React from 'react'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import TYPERT_REMOTE from '../remote'

const STYLE_ID = 'dsh-ai-prompt-optimizer/client.css'

const CSS = `
.ai-prompt-optimizer-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dsh-color-border, rgba(127, 127, 127, .35));
  border-radius: 8px;
  background: var(--dsh-color-surface, transparent);
  color: var(--dsh-color-text, inherit);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.ai-prompt-optimizer-button:hover:not(:disabled) {
  border-color: var(--dsh-color-primary, #4f7cff);
  color: var(--dsh-color-primary, #4f7cff);
}
.ai-prompt-optimizer-button:focus-visible,
.ai-prompt-optimizer-dialog__close:focus-visible {
  outline: 2px solid var(--dsh-color-primary, #4f7cff);
  outline-offset: 2px;
}
.ai-prompt-optimizer-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.ai-prompt-optimizer-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, .42);
  pointer-events: auto;
}
.ai-prompt-optimizer-dialog {
  width: min(440px, 100%);
  border: 1px solid var(--dsh-color-border, rgba(127, 127, 127, .35));
  border-radius: 12px;
  background: var(--dsh-color-surface, #fff);
  color: var(--dsh-color-text, #1b1b1b);
  box-shadow: 0 18px 55px rgba(0, 0, 0, .28);
  padding: 20px;
}
.ai-prompt-optimizer-dialog__title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 650;
}
.ai-prompt-optimizer-dialog__message {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.55;
}
.ai-prompt-optimizer-dialog__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}
.ai-prompt-optimizer-dialog__close {
  border: 0;
  border-radius: 7px;
  padding: 8px 14px;
  background: var(--dsh-color-primary, #4f7cff);
  color: #fff;
  font: inherit;
  cursor: pointer;
}
`

interface InputStateLike {
  readonly draft: string
  readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
}

interface InputActionsLike {
  setDraft(text: string): void
}

interface PromptOptimizerButtonProps {
  readonly input: InputStateLike
  readonly inputActions: InputActionsLike
}

type PromptOptimizerRemote = ClientContext['remote']['promptOptimizer']

let promptOptimizerRemote: PromptOptimizerRemote | undefined

interface ErrorDialogState {
  readonly open: boolean
  readonly message: string
}

let errorDialogState: ErrorDialogState = { open: false, message: '' }
const errorDialogListeners = new Set<() => void>()

function publishErrorDialog(): void {
  for (const listener of [...errorDialogListeners]) listener()
}

function showError(message: string): void {
  errorDialogState = {
    open: true,
    message: message || '提示词优化失败，请稍后重试。',
  }
  publishErrorDialog()
}

function closeError(): void {
  errorDialogState = { open: false, message: '' }
  publishErrorDialog()
}

function subscribeErrorDialog(listener: () => void): () => void {
  errorDialogListeners.add(listener)
  return () => {
    errorDialogListeners.delete(listener)
  }
}

function getErrorDialogState(): ErrorDialogState {
  return errorDialogState
}

function installStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin-css', STYLE_ID)
  tag.textContent = CSS
  document.head.append(tag)
}

function ErrorDialog(): React.ReactNode {
  const dialog = React.useSyncExternalStore(subscribeErrorDialog, getErrorDialogState)
  if (!dialog.open) return null

  return (
    <div className="ai-prompt-optimizer-dialog-backdrop" onClick={closeError}>
      <div
        className="ai-prompt-optimizer-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-prompt-optimizer-error-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="ai-prompt-optimizer-error-title"
          className="ai-prompt-optimizer-dialog__title"
        >
          提示词优化失败
        </h2>
        <p className="ai-prompt-optimizer-dialog__message">{dialog.message}</p>
        <div className="ai-prompt-optimizer-dialog__actions">
          <button
            type="button"
            className="ai-prompt-optimizer-dialog__close"
            onClick={closeError}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}

function PromptOptimizerButton(props: PromptOptimizerButtonProps): React.ReactNode {
  const [busy, setBusy] = React.useState(false)
  const unavailable =
    props.input.phase === 'adjudicating' || props.input.phase === 'submitting'

  const onOptimize = async (): Promise<void> => {
    const draft = props.input.draft.trim()
    if (!draft) {
      showError('请先输入需要优化的提示词。')
      return
    }
    if (unavailable || busy) return

    const remote = promptOptimizerRemote
    if (remote === undefined) {
      showError('提示词优化服务尚未就绪，请稍后重试。')
      return
    }

    setBusy(true)
    try {
      const carrier = await remote.optimize({ draft })
      if (!carrier.ok) {
        showError(carrier.error.message || '提示词优化失败，请重试。')
        return
      }
      if (carrier.value.ok) {
        props.inputActions.setDraft(carrier.value.prompt)
      } else {
        showError(carrier.value.error)
      }
    } catch (error) {
      showError(error instanceof Error && error.message ? error.message : '调用模型时发生错误。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="ai-prompt-optimizer-button"
      onClick={onOptimize}
      disabled={unavailable || busy}
      title="使用当前选中的模型优化输入内容"
    >
      {busy ? '✨ 优化中…' : '✨ AI 优化'}
    </button>
  )
}

/** Browser services required before this plugin activates. */
export const inject = ['slots', 'remote']

/**
 * Browser half: mount this package's Remote namespace, then contribute the
 * composer button and its frame-wide error dialog.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  installStyles()
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  const disposers: Array<() => void> = []

  try {
    promptOptimizerRemote = ctx.remote.promptOptimizer
    disposers.push(
      ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.right',
            id: 'prompt-optimizer',
            order: 10,
            label: 'AI 优化提示词',
          },
          PromptOptimizerButton,
        ),
      ),
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'prompt-optimizer-error-dialog',
            order: 100,
            label: '提示词优化错误弹窗',
          },
          ErrorDialog,
        ),
      ),
    )
  } catch (error) {
    promptOptimizerRemote = undefined
    for (const dispose of disposers.reverse()) dispose()
    await disposeRemote()
    throw error
  }

  return async () => {
    promptOptimizerRemote = undefined
    for (const dispose of disposers.reverse()) dispose()
    await disposeRemote()
  }
}
