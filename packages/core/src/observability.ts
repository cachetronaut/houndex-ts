/**
 * Minimal, dependency-free observability seam.
 *
 * Core emits structured events through a `TraceSink` rather than importing a
 * tracing vendor. The default sink is a no-op, so the framework adds zero
 * overhead and zero dependencies until an application plugs in its own sink
 * (OpenTelemetry, a logger, a test spy, …).
 */

export interface TraceEvent {
  /** Dotted event name, e.g. "ingest.chunk" or "claim.upsert". */
  name: string;
  /** Arbitrary structured attributes; keep values JSON-serializable. */
  attributes?: Record<string, unknown>;
}

export interface TraceSink {
  emit(event: TraceEvent): void;
}

export const noopTraceSink: TraceSink = {
  emit(): void {
    // intentionally empty
  },
};

let activeSink: TraceSink = noopTraceSink;

/** Install the process-wide trace sink. Returns the previously active sink. */
export function setTraceSink(sink: TraceSink): TraceSink {
  const previous = activeSink;
  activeSink = sink;
  return previous;
}

export function emitTrace(event: TraceEvent): void {
  activeSink.emit(event);
}
