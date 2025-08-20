import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface LinkedAccount {
  id: string;
  provider: string;
  provider_user_id: string;
  email?: string;
  name?: string;
  connected_at: string;
  last_sync?: string;
  scopes: string[];
  status: 'connected' | 'error' | 'refreshing';
}

export interface LinkAccountResponse {
  auth_url: string;
  state: string;
}

export interface DataFetchRequest {
  data_type: string;
  filters?: Record<string, any>;
  limit?: number;
}

export interface DataFetchResponse {
  provider: string;
  data_type: string;
  items: any[];
  total_count: number;
  fetched_at: string;
}

export interface ProcurementCredentials {
  username?: string;
  password?: string;
  api_key?: string;
  api_secret?: string;
  email?: string;
}

export interface McMasterSearchResult {
  part_number: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  in_stock: boolean;
  image_url?: string;
}

export interface DigiKeySearchResult {
  part_number: string;
  manufacturer_part: string;
  description: string;
  manufacturer: string;
  unit_price: number;
  stock: number;
  datasheet_url?: string;
}

export interface PCBQuote {
  board_cost: number;
  quantity: number;
  setup_fee: number;
  total: number;
  lead_time_days: number;
  shipping_options: Array<{
    method: string;
    cost: number;
    days: number;
  }>;
}

class EnhancedAccountService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Get all available providers
  async getAvailableProviders() {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounts/providers`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      return { oauth_providers: [], procurement_providers: {}, ai_providers: {} };
    }
  }

  // Existing account management
  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounts/linked`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch linked accounts:', error);
      return [];
    }
  }

  async linkAccount(provider: string): Promise<LinkAccountResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/link/${provider}`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to link ${provider} account:`, error);
      throw error;
    }
  }

  async unlinkAccount(accountId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/accounts/${accountId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error('Failed to unlink account:', error);
      throw error;
    }
  }

  // Data fetching from connected accounts
  async fetchAccountData(accountId: string, request: DataFetchRequest): Promise<DataFetchResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/${accountId}/fetch-data`,
        request,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch account data:', error);
      throw error;
    }
  }

  // Procurement account connections
  async connectProcurementAccount(provider: string, credentials: ProcurementCredentials) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/connect-procurement/${provider}`,
        credentials,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to connect ${provider}:`, error);
      throw error;
    }
  }

  // McMaster-Carr specific
  async searchMcMasterParts(accountId: string, query: string, category?: string): Promise<McMasterSearchResult[]> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/${accountId}/mcmaster/search`,
        { query, category },
        { headers: this.getAuthHeaders() }
      );
      return response.data.results;
    } catch (error) {
      console.error('McMaster search failed:', error);
      return [];
    }
  }

  // DigiKey specific
  async searchDigiKeyParts(accountId: string, keyword: string, filters?: any): Promise<DigiKeySearchResult[]> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/${accountId}/digikey/search`,
        { keyword, filters },
        { headers: this.getAuthHeaders() }
      );
      return response.data.results;
    } catch (error) {
      console.error('DigiKey search failed:', error);
      return [];
    }
  }

  // JLCPCB specific
  async getJLCPCBQuote(accountId: string, pcbSpecs: any): Promise<PCBQuote> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/${accountId}/jlcpcb/quote`,
        { pcb_specs: pcbSpecs },
        { headers: this.getAuthHeaders() }
      );
      return response.data.quote;
    } catch (error) {
      console.error('JLCPCB quote failed:', error);
      throw error;
    }
  }

  // AI provider connections
  async connectAIProvider(provider: string, apiKey: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/accounts/connect-ai/${provider}`,
        { api_key: apiKey },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to connect ${provider}:`, error);
      throw error;
    }
  }

  // GitHub specific helpers
  async getGitHubRepos(accountId: string): Promise<any[]> {
    return this.fetchAccountData(accountId, { data_type: 'repos' })
      .then(response => response.items);
  }

  async getGitHubIssues(accountId: string, state: string = 'open'): Promise<any[]> {
    return this.fetchAccountData(accountId, { 
      data_type: 'issues',
      filters: { state }
    }).then(response => response.items);
  }

  // Google Drive specific helpers
  async getGoogleDriveFiles(accountId: string, limit: number = 100): Promise<any[]> {
    return this.fetchAccountData(accountId, { 
      data_type: 'drive_files',
      limit
    }).then(response => response.items);
  }

  // Linear specific helpers
  async getLinearIssues(accountId: string): Promise<any[]> {
    return this.fetchAccountData(accountId, { data_type: 'issues' })
      .then(response => response.items);
  }

  // Notion specific helpers
  async getNotionDatabases(accountId: string): Promise<any[]> {
    return this.fetchAccountData(accountId, { data_type: 'databases' })
      .then(response => response.items);
  }

  async getNotionPages(accountId: string): Promise<any[]> {
    return this.fetchAccountData(accountId, { data_type: 'pages' })
      .then(response => response.items);
  }
}

export default new EnhancedAccountService();