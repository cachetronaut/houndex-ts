/**
 * Generic per-role model routing.
 *
 * The framework does not bundle a model catalog or bind to any provider — that
 * belongs in application or adapter code. What it provides is the *shape* of a
 * routing table: a mapping from a named role (e.g. "extractor", "verifier") to
 * a model reference and its default generation parameters. Applications declare
 * their own roles and models against these types, so swapping a model for a
 * role is a one-line data edit rather than a code change.
 */

/** An opaque, provider-agnostic model identifier (e.g. "openai/gpt-4o-mini"). */
export type ModelRef = string;

export interface ModelConfig {
  model: ModelRef;
  /** Default sampling temperature for this role; callers may override. */
  temperature?: number;
}

/** A routing table keyed by an application-defined role name. */
export type ModelRouting<Role extends string = string> = Record<Role, ModelConfig>;

export interface EmbeddingConfig {
  model: ModelRef;
  /** Output vector dimension; must match the configured vector store. */
  dimension: number;
}
