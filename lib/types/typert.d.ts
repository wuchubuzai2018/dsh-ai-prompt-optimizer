/**
 * Host-face Typert manifest discovered by @deepseek-ai/dsh-typert-loader.
 *
 * The Client already calls `/api/promptOptimizer/optimize`. Exporting this
 * artifact makes the Host register that exact endpoint through the shared
 * Typert Gateway instead of relying on source-mode decorator reflection.
 */
export declare const TYPERT: {
    readonly package: "dsh-ai-prompt-optimizer";
    readonly face: "host";
    readonly schemas: readonly [];
    readonly invocations: readonly import("@deepseek-ai/dsh-typert-protocol").InvocationDescriptor[];
    readonly model: {
        readonly services: readonly [{
            readonly description: "Optimize one composer draft with the current default DSH model.";
            readonly summary: "AI prompt optimizer Host service.";
            readonly tags: readonly [];
            readonly jsDoc: "/** Host Remote service behind the composer button. */";
            readonly key: "promptOptimizer";
            readonly exportName: "PromptOptimizerService";
            readonly members: readonly [{
                readonly kind: "method";
                readonly name: "optimize";
                readonly signature: "@Remote('optimize') async optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult>";
                readonly summary: "Optimize one composer draft with the current default DSH model.";
                readonly jsDoc: "/** Optimize one composer draft with the current default DSH model. */";
            }];
            readonly types: readonly [{
                readonly name: "OptimizePromptRequest";
                readonly declaration: "export interface OptimizePromptRequest { readonly draft: string }";
            }, {
                readonly name: "OptimizePromptResult";
                readonly declaration: "export type OptimizePromptResult = { readonly ok: true; readonly prompt: string } | { readonly ok: false; readonly error: string }";
            }];
        }];
        readonly events: readonly [];
        readonly objects: readonly [];
    };
};
export default TYPERT;
//# sourceMappingURL=typert.d.ts.map