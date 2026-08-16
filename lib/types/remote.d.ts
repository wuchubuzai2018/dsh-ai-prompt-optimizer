import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { OptimizePromptRequest, OptimizePromptResult } from './types';
interface PromptOptimizerRemoteNamespace {
    optimize: (request: OptimizePromptRequest) => Promise<RemoteResult<OptimizePromptResult>>;
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteMap {
        'promptOptimizer/optimize': PromptOptimizerRemoteNamespace['optimize'];
    }
    interface TypertRemoteNamespaceMap {
        promptOptimizer: PromptOptimizerRemoteNamespace;
    }
}
/**
 * Explicit Remote contribution mounted by this package's browser half.
 * The Host side intentionally uses the Typert source-mode fallback: the
 * `@Remote` marker on PromptOptimizerService keeps this small plugin free of a
 * generated host-manifest build step.
 */
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
//# sourceMappingURL=remote.d.ts.map