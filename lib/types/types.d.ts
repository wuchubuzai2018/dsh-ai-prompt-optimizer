/** Request sent from the browser composer to the prompt optimizer Host service. */
export interface OptimizePromptRequest {
    /** Current composer draft. The Host trims it before calling the model. */
    readonly draft: string;
}
/** Successful business result returned by the prompt optimizer. */
export interface OptimizePromptSuccess {
    readonly ok: true;
    /** Optimized prompt ready to replace the composer draft. */
    readonly prompt: string;
}
/** Expected business failure returned without throwing across the RPC boundary. */
export interface OptimizePromptFailure {
    readonly ok: false;
    /** User-readable failure summary. */
    readonly error: string;
}
/** Business result vocabulary shared by the Host service and generated Remote client. */
export type OptimizePromptResult = OptimizePromptSuccess | OptimizePromptFailure;
//# sourceMappingURL=types.d.ts.map