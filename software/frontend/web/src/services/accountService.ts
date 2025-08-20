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

class AccountService {
  private getAuthHeaders() {
    // Try to get token from wit-auth-tokens first (new auth system)
    const storedTokens = localStorage.getItem('wit-auth-tokens') || sessionStorage.getItem('wit-auth-tokens');
    if (storedTokens) {
      try {
        const tokens = JSON.parse(storedTokens);
        if (tokens.access_token) {
          return { Authorization: `Bearer ${tokens.access_token}` };
        }
      } catch (error) {
        console.error('Failed to parse stored tokens:', error);
      }
    }
    
    // Fallback to direct access_token (old system)
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/accounts/linked`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch linked accounts:', error);
      // Return empty array instead of throwing to avoid breaking the UI
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

  async unlinkAccount(provider: string): Promise<void> {
    try {
      await axios.delete(`${API_BASE_URL}/accounts/unlink/${provider}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error(`Failed to unlink ${provider} account:`, error);
      throw error;
    }
  }

  async refreshToken(provider: string): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/providers/${provider}/refresh`,
        {},
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error(`Failed to refresh ${provider} token:`, error);
      throw error;
    }
  }

  // OAuth callback handler
  async handleOAuthCallback(provider: string, code: string, state: string): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/auth/${provider}/callback`,
        { code, state },
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error(`Failed to handle ${provider} OAuth callback:`, error);
      throw error;
    }
  }
}

export default new AccountService();