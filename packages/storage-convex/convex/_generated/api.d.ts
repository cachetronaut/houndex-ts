/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as claims from "../claims.js";
import type * as curation from "../curation.js";
import type * as edges from "../edges.js";
import type * as kb from "../kb.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_withTenant from "../lib/withTenant.js";
import type * as overrides from "../overrides.js";
import type * as runs from "../runs.js";
import type * as sources from "../sources.js";
import type * as tenants from "../tenants.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  claims: typeof claims;
  curation: typeof curation;
  edges: typeof edges;
  kb: typeof kb;
  "lib/validators": typeof lib_validators;
  "lib/withTenant": typeof lib_withTenant;
  overrides: typeof overrides;
  runs: typeof runs;
  sources: typeof sources;
  tenants: typeof tenants;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
