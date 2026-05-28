import { kbsClaims, kbsSources } from "../../kbs-runtime/src/data.ts";
import { keywordSearch, type KbsSearchResult } from "../../kbs-runtime/src/search/index.ts";
import type { KbsClaim, KbsSource } from "../../kbs-runtime/src/types.ts";

export interface KbsTransport {
  request<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T>;
}

export interface KbsSdkClient {
  search(query: string): Promise<KbsSearchResult[]>;
  claims(): Promise<KbsClaim[]>;
  sources(): Promise<KbsSource[]>;
}

export const kbsOpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "KBS Knowledge Base System API",
    version: "0.1.0-governed-preview"
  },
  paths: {
    "/api/kbs/search": { get: { summary: "Search local KBS claims and sources." } },
    "/api/kbs/claims": { get: { summary: "List governed knowledge claims." } },
    "/api/kbs/sources": { get: { summary: "List governed sources." } }
  }
} as const;

export function createKbsClient(transport?: KbsTransport): KbsSdkClient {
  if (transport) {
    return {
      search: (query) => transport.request(`/api/kbs/search?q=${encodeURIComponent(query)}`),
      claims: () => transport.request("/api/kbs/claims"),
      sources: () => transport.request("/api/kbs/sources")
    };
  }

  return {
    async search(query) {
      return keywordSearch(query, kbsClaims, kbsSources);
    },
    async claims() {
      return kbsClaims;
    },
    async sources() {
      return kbsSources;
    }
  };
}
