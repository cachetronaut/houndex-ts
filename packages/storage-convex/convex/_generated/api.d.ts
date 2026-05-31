import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as claims from '../claims.js';
import type * as curation from '../curation.js';
import type * as edges from '../edges.js';
import type * as kb from '../kb.js';
import type * as overrides from '../overrides.js';
import type * as runs from '../runs.js';
import type * as sources from '../sources.js';
import type * as tenants from '../tenants.js';

declare const fullApi: ApiFromModules<{
  claims: typeof claims;
  curation: typeof curation;
  edges: typeof edges;
  kb: typeof kb;
  overrides: typeof overrides;
  runs: typeof runs;
  sources: typeof sources;
  tenants: typeof tenants;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;
