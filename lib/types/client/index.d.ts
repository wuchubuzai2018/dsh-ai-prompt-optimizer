import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Browser services required before this plugin activates. */
export declare const inject: string[];
/**
 * Browser half: mount this package's Remote namespace, then contribute the
 * composer button and its frame-wide error dialog.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map