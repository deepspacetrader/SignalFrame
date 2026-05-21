
export interface RagDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
}

export interface RagSearchResponse {
  query: string;
  results: RagDocument[];
  count: number;
}

class RagService {
  private baseUrl = `http://localhost:${import.meta.env.VITE_RAG_PORT || '3333'}`;

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  async storeSignal(text: string, metadata: Record<string, any> = {}): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, metadata })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.id;
    } catch (e) {
      console.error('RagService storeSignal error:', e);
      return null;
    }
  }

  async vectorSearch(query: string, limit: number = 5, threshold: number = 0.35): Promise<RagDocument[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vector-search?q=${encodeURIComponent(query)}&limit=${limit}&threshold=${threshold}`);
      if (!response.ok) return [];
      const data: RagSearchResponse = await response.json();
      return data.results;
    } catch (e) {
      console.error('RagService vectorSearch error:', e);
      return [];
    }
  }

  async smartSearch(query: string, limit: number = 5): Promise<RagDocument[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results;
    } catch (e) {
      console.error('RagService smartSearch error:', e);
      return [];
    }
  }
}

export const ragService = new RagService();
