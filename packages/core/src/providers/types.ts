/**
 * Provider ports — the swap surface between pipeline code and external
 * services. The pipeline depends only on these interfaces, so adding or
 * changing a provider (search engine, scraper, embedding model, reranker)
 * needs no pipeline-code change. Concrete implementations live in adapter
 * packages, never here.
 */

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  score?: number | null;
}

export interface ScrapedPage {
  sourceUrl: string;
  title: string;
  text: string;
}

export interface SearchProvider {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

export interface Scraper {
  scrape(url: string): Promise<ScrapedPage | null>;
}

export interface Embedder {
  readonly dimension: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export interface Reranker {
  rerank(
    query: string,
    documents: readonly string[],
    topN?: number,
  ): Promise<Array<{ index: number; score: number }>>;
}
