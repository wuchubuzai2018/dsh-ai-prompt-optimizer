var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
const PACKAGE_NAME = 'dsh-ai-prompt-optimizer';
const SYSTEM_PROMPT = '你是一名资深提示词工程师。将用户给出的原始提示词优化为可直接发送给 AI 的高质量提示词。保留用户的真实意图、语言和已知事实；补齐目标、上下文、约束、步骤及期望输出格式。不要执行原任务，不要解释你的改写过程，也不要使用 Markdown 代码围栏；只返回优化后的完整提示词。若原始信息不足，请在优化后的提示词中明确列出最少且关键的待确认项。';
function messageOf(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
}
/**
 * Host Remote service behind the composer button. It reuses the deployment's
 * currently selected provider/model and deliberately sends only the broadly
 * supported GenerateOptions fields.
 */
let PromptOptimizerService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _optimize_decorators;
    return class PromptOptimizerService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _optimize_decorators = [Remote('optimize')];
            __esDecorate(this, null, _optimize_decorators, { kind: "method", name: "optimize", static: false, private: false, access: { has: obj => "optimize" in obj, get: obj => obj.optimize }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['llm', 'agentDefaultModel'];
        constructor(ctx) {
            super(ctx, 'promptOptimizer');
            __runInitializers(this, _instanceExtraInitializers);
        }
        /** Optimize one composer draft with the current default DSH model. */
        async optimize(request) {
            const draft = typeof request.draft === 'string' ? request.draft.trim() : '';
            if (!draft)
                return { ok: false, error: '请先输入需要优化的提示词。' };
            const selection = this.ctx.agentDefaultModel.currentSelection();
            if (!selection.provider || !selection.model) {
                return { ok: false, error: '当前没有可用的模型配置。' };
            }
            const options = {
                provider: selection.provider,
                model: selection.model,
                system: SYSTEM_PROMPT,
                messages: [
                    createUserMessage({
                        content: [{ type: 'text', text: draft }],
                        source: { kind: 'plugin', plugin: PACKAGE_NAME },
                    }),
                ],
            };
            let text = '';
            let failure = '';
            try {
                for await (const chunk of this.ctx.llm.stream(options)) {
                    if (chunk.type === 'text-delta')
                        text += chunk.text;
                    if (chunk.type === 'finish' &&
                        (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                        failure = chunk.reason.failure.message || '模型调用未完成。';
                    }
                }
            }
            catch (error) {
                failure = messageOf(error, '模型调用失败。');
            }
            const optimized = text.trim();
            if (failure)
                return { ok: false, error: failure };
            if (!optimized)
                return { ok: false, error: '模型没有返回可用的优化结果。' };
            return { ok: true, prompt: optimized };
        }
    };
})();
export { PromptOptimizerService };
export default PromptOptimizerService;
