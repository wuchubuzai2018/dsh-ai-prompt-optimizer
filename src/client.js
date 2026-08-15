return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    let dialog = { open: false, message: '' }
    const listeners = []
    const publish = () => listeners.slice().forEach((listener) => listener())
    const showError = (message) => {
      dialog = { open: true, message: message || '提示词优化失败，请稍后重试。' }
      publish()
    }
    const closeError = () => {
      dialog = { open: false, message: '' }
      publish()
    }
    const subscribe = (listener) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      }
    }

    styles.insert(`
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
    `)

    function ErrorDialog() {
      const [, render] = React.useState(0)
      React.useEffect(() => subscribe(() => render((value) => value + 1)), [])
      if (!dialog.open) return null

      return React.createElement(
        'div',
        { className: 'ai-prompt-optimizer-dialog-backdrop', onClick: closeError },
        React.createElement(
          'div',
          {
            className: 'ai-prompt-optimizer-dialog',
            role: 'alertdialog',
            'aria-modal': true,
            'aria-labelledby': 'ai-prompt-optimizer-error-title',
            onClick: (event) => event.stopPropagation(),
          },
          React.createElement(
            'h2',
            {
              id: 'ai-prompt-optimizer-error-title',
              className: 'ai-prompt-optimizer-dialog__title',
            },
            '提示词优化失败',
          ),
          React.createElement(
            'p',
            { className: 'ai-prompt-optimizer-dialog__message' },
            dialog.message,
          ),
          React.createElement(
            'div',
            { className: 'ai-prompt-optimizer-dialog__actions' },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'ai-prompt-optimizer-dialog__close',
                onClick: closeError,
              },
              '知道了',
            ),
          ),
        ),
      )
    }

    function PromptOptimizer(props) {
      const [busy, setBusy] = React.useState(false)
      const input = props.input
      const actions = props.inputActions
      const unavailable =
        !actions || input.phase === 'adjudicating' || input.phase === 'submitting'

      const onOptimize = async () => {
        const draft = input.draft && input.draft.trim()
        if (!draft) {
          showError('请先输入需要优化的提示词。')
          return
        }
        if (unavailable || busy) return

        setBusy(true)
        try {
          const result = await host.call('optimize-prompt', { draft })
          if (result && result.ok && typeof result.prompt === 'string') {
            actions.setDraft(result.prompt)
          } else {
            showError(result && result.error ? result.error : '提示词优化失败，请重试。')
          }
        } catch (error) {
          showError(error && error.message ? error.message : '调用模型时发生错误。')
        } finally {
          setBusy(false)
        }
      }

      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'ai-prompt-optimizer-button',
          onClick: onOptimize,
          disabled: unavailable || busy,
          title: '使用当前选中的模型优化输入内容',
        },
        busy ? '✨ 优化中…' : '✨ AI 优化',
      )
    }

    slots.inject('conversation.input.right', () =>
      slots.register(
        {
          name: 'conversation.input.right',
          id: 'prompt-optimizer',
          order: 10,
          label: 'AI 优化提示词',
        },
        (props) => React.createElement(PromptOptimizer, props),
      ),
    )

    slots.inject('shell.overlay', () =>
      slots.register(
        {
          name: 'shell.overlay',
          id: 'prompt-optimizer-error-dialog',
          order: 100,
          label: '提示词优化错误弹窗',
        },
        () => React.createElement(ErrorDialog),
      ),
    )
  },
}
