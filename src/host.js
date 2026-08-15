return {
  inject: ['llm', 'agentDefaultModel'],
  apply(ctx) {
    harness.handle('optimize-prompt', async (args) => {
      const draft = args && typeof args.draft === 'string' ? args.draft.trim() : ''
      if (!draft) return { ok: false, error: '请先输入需要优化的提示词。' }

      const selection = ctx.agentDefaultModel.currentSelection()
      if (!selection || !selection.provider || !selection.model) {
        return { ok: false, error: '当前没有可用的模型配置。' }
      }

      const request = {
        provider: selection.provider,
        model: selection.model,
        system: '你是一名资深提示词工程师。将用户给出的原始提示词优化为可直接发送给 AI 的高质量提示词。保留用户的真实意图、语言和已知事实；补齐目标、上下文、约束、步骤及期望输出格式。不要执行原任务，不要解释你的改写过程，也不要使用 Markdown 代码围栏；只返回优化后的完整提示词。若原始信息不足，请在优化后的提示词中明确列出最少且关键的待确认项。',
        messages: [{
          id: 'prompt-optimizer-request',
          role: 'user',
          content: [{ type: 'text', text: draft }],
          source: { kind: 'plugin', plugin: 'dsh-ai-prompt-optimizer' },
        }],
      }

      let text = ''
      let failure = ''
      try {
        for await (const chunk of ctx.llm.stream(request)) {
          if (chunk.type === 'text-delta') text += chunk.text
          if (
            chunk.type === 'finish' &&
            (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')
          ) {
            failure = chunk.reason.failure && chunk.reason.failure.message
              ? chunk.reason.failure.message
              : '模型调用未完成。'
          }
        }
      } catch (error) {
        failure = error && error.message ? error.message : '模型调用失败。'
      }

      const optimized = text.trim()
      if (failure) return { ok: false, error: failure }
      if (!optimized) return { ok: false, error: '模型没有返回可用的优化结果。' }
      return { ok: true, prompt: optimized }
    })
  },
}
