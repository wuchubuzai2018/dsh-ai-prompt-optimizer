import { TYPERT_REMOTE } from './remote.js';
const PACKAGE_NAME = 'dsh-ai-prompt-optimizer';
/**
 * Host-face Typert manifest discovered by @deepseek-ai/dsh-typert-loader.
 *
 * The Client already calls `/api/promptOptimizer/optimize`. Exporting this
 * artifact makes the Host register that exact endpoint through the shared
 * Typert Gateway instead of relying on source-mode decorator reflection.
 */
export const TYPERT = {
    package: PACKAGE_NAME,
    face: 'host',
    schemas: [],
    invocations: TYPERT_REMOTE.descriptors,
    model: {
        services: [
            {
                description: 'Optimize one composer draft with the current default DSH model.',
                summary: 'AI prompt optimizer Host service.',
                tags: [],
                jsDoc: '/** Host Remote service behind the composer button. */',
                key: 'promptOptimizer',
                exportName: 'PromptOptimizerService',
                members: [
                    {
                        kind: 'method',
                        name: 'optimize',
                        signature: "@Remote('optimize') async optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult>",
                        summary: 'Optimize one composer draft with the current default DSH model.',
                        jsDoc: '/** Optimize one composer draft with the current default DSH model. */',
                    },
                ],
                types: [
                    {
                        name: 'OptimizePromptRequest',
                        declaration: 'export interface OptimizePromptRequest { readonly draft: string }',
                    },
                    {
                        name: 'OptimizePromptResult',
                        declaration: 'export type OptimizePromptResult = { readonly ok: true; readonly prompt: string } | { readonly ok: false; readonly error: string }',
                    },
                ],
            },
        ],
        events: [],
        objects: [],
    },
};
export default TYPERT;
