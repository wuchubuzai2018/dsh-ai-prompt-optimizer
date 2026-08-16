import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { OptimizePromptRequest, OptimizePromptResult } from './types';
/**
 * Host Remote service behind the composer button. It reuses the deployment's
 * currently selected provider/model and deliberately sends only the broadly
 * supported GenerateOptions fields.
 */
export declare class PromptOptimizerService extends TypertRemoteService {
    static inject: string[];
    constructor(ctx: Context);
    /** Optimize one composer draft with the current default DSH model. */
    optimize(request: OptimizePromptRequest): Promise<OptimizePromptResult>;
}
export default PromptOptimizerService;
export type { OptimizePromptRequest, OptimizePromptResult } from './types';
//# sourceMappingURL=index.d.ts.map