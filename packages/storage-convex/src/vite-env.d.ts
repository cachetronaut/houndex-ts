// `import.meta.glob` is provided by Vite/Vitest at transform time; declare the
// minimal signature convex-test needs so `tsc` is satisfied without depending
// on `vite/client` types being resolvable as a bare specifier.
interface ImportMeta {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}
