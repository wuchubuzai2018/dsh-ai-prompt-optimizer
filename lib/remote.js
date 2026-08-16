import { z } from 'zod';
const PACKAGE_NAME = 'dsh-ai-prompt-optimizer';
const optimizePromptRequestSchema = z.object({
    draft: z.string(),
}).readonly();
const optimizePromptResultSchema = z.union([
    z.object({
        ok: z.literal(true),
        prompt: z.string(),
    }).readonly(),
    z.object({
        ok: z.literal(false),
        error: z.string(),
    }).readonly(),
]).readonly();
/**
 * Explicit Remote contribution mounted by this package's browser half.
 * The Host side intentionally uses the Typert source-mode fallback: the
 * `@Remote` marker on PromptOptimizerService keeps this small plugin free of a
 * generated host-manifest build step.
 */
export const TYPERT_REMOTE = {
    package: PACKAGE_NAME,
    descriptors: [
        {
            id: `${PACKAGE_NAME}#promptOptimizer/optimize`,
            service: 'promptOptimizer',
            namespace: 'promptOptimizer',
            method: 'optimize',
            invocation: { kind: 'direct' },
            parameters: [
                {
                    name: 'request',
                    wire: 'request',
                    source: 'json',
                    codec: {
                        mode: 'strict',
                        typeSymbol: `${PACKAGE_NAME}/types#OptimizePromptRequest`,
                        schema: optimizePromptRequestSchema,
                    },
                },
            ],
            result: {
                mode: 'strict',
                typeSymbol: `${PACKAGE_NAME}/types#OptimizePromptResult`,
                schema: optimizePromptResultSchema,
            },
        },
    ],
};
export default TYPERT_REMOTE;
