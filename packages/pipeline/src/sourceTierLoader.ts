/**
 * Convenience loader: build a `SourceTierClassifier` from a JSON rubric string
 * or an already-parsed object. File I/O stays out of the package — callers read
 * the file and pass the contents — so this module has no runtime dependencies
 * and is safe in any JavaScript runtime.
 */

import { SourceTierClassifier, type SourceTierRubric } from './sourceTier.js';

export function loadSourceTierClassifier(input: string | SourceTierRubric): SourceTierClassifier {
  const rubric: SourceTierRubric =
    typeof input === 'string' ? (JSON.parse(input) as SourceTierRubric) : input;
  return new SourceTierClassifier(rubric ?? {});
}
