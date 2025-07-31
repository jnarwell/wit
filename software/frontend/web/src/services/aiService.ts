// AI Service for general queries using connected models
// Integrates with various AI providers (Claude, OpenAI, etc.)

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

interface AIQuery {
  query: string;
  context?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  tokens?: any; // Auth tokens from the app
}

interface AIResponse {
  response: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  error?: string;
}

class AIService {
  private providers: AIProvider[] = [];
  private defaultProvider: string = 'claude';

  constructor() {
    this.loadProviders();
  }

  private loadProviders() {
    // Load from localStorage
    const saved = localStorage.getItem('wit-ai-providers');
    if (saved) {
      this.providers = JSON.parse(saved);
    } else {
      // Default providers
      this.providers = [
        {
          id: 'claude',
          name: 'Claude (Anthropic)',
          enabled: true,
          model: 'claude-3-opus-20240229'
        },
        {
          id: 'openai',
          name: 'OpenAI GPT-4',
          enabled: false,
          model: 'gpt-4-turbo-preview'
        },
        {
          id: 'gemini',
          name: 'Google Gemini',
          enabled: false,
          model: 'gemini-pro'
        }
      ];
    }

    // Check for API keys in settings
    const aiConnections = localStorage.getItem('wit-ai-connections');
    if (aiConnections) {
      const connections = JSON.parse(aiConnections);
      this.providers.forEach(provider => {
        const connection = connections[provider.id];
        if (connection) {
          provider.apiKey = connection.apiKey;
          provider.endpoint = connection.endpoint;
        }
      });
    }
  }

  public async query(params: AIQuery): Promise<AIResponse> {
    const provider = this.getProvider(params.provider || this.defaultProvider);
    
    if (!provider || !provider.enabled) {
      return {
        response: 'No AI provider is currently enabled. Please configure an AI provider in settings.',
        provider: 'system',
        model: 'none',
        error: 'No provider enabled'
      };
    }

    try {
      switch (provider.id) {
        case 'claude':
          return await this.queryAnthropic(provider, params);
        case 'openai':
          return await this.queryOpenAI(provider, params);
        case 'gemini':
          return await this.queryGemini(provider, params);
        default:
          // Fallback to using the terminal's built-in AI
          return await this.queryBuiltIn(params);
      }
    } catch (error) {
      console.error(`[AIService] Error querying ${provider.name}:`, error);
      return {
        response: `Error querying ${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: provider.id,
        model: provider.model || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async queryAnthropic(provider: AIProvider, params: AIQuery): Promise<AIResponse> {
    // For now, use the terminal's backend which has Claude integration
    return this.queryBuiltIn(params);
  }

  private async queryOpenAI(provider: AIProvider, params: AIQuery): Promise<AIResponse> {
    if (!provider.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant integrated into the WIT (Workshop Interface Terminal) system.'
          },
          {
            role: 'user',
            content: params.query
          }
        ],
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      response: data.choices[0].message.content,
      provider: 'openai',
      model: data.model,
      tokensUsed: data.usage?.total_tokens
    };
  }

  private async queryGemini(provider: AIProvider, params: AIQuery): Promise<AIResponse> {
    if (!provider.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model || 'gemini-pro'}:generateContent?key=${provider.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: params.query
          }]
        }],
        generationConfig: {
          temperature: params.temperature || 0.7,
          maxOutputTokens: params.maxTokens || 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      response: data.candidates[0].content.parts[0].text,
      provider: 'gemini',
      model: provider.model || 'gemini-pro'
    };
  }

  private async queryBuiltIn(params: AIQuery): Promise<AIResponse> {
    // Use the terminal's existing AI backend
    const tokens = params.tokens || this.getAuthTokens();
    if (!tokens) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('http://localhost:8000/api/v1/terminal/ai-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.access_token}`
      },
      body: JSON.stringify({
        query: params.query,
        context: params.context,
        temperature: params.temperature,
        max_tokens: params.maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'AI query failed');
    }

    const data = await response.json();
    return {
      response: data.response,
      provider: data.provider || 'claude',
      model: data.model || 'claude-3-opus-20240229',
      tokensUsed: data.tokens_used
    };
  }

  private getProvider(id: string): AIProvider | undefined {
    return this.providers.find(p => p.id === id);
  }

  private getAuthTokens() {
    // Try multiple sources for auth tokens
    // 1. Check localStorage for wit-auth
    const authData = localStorage.getItem('wit-auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.tokens) {
          return parsed.tokens;
        }
      } catch (e) {
        console.error('[AIService] Error parsing auth data:', e);
      }
    }
    
    // 2. Check for wit-tokens directly
    const tokensData = localStorage.getItem('wit-tokens');
    if (tokensData) {
      try {
        return JSON.parse(tokensData);
      } catch (e) {
        console.error('[AIService] Error parsing tokens data:', e);
      }
    }
    
    // 3. Check sessionStorage as fallback
    const sessionAuth = sessionStorage.getItem('wit-auth');
    if (sessionAuth) {
      try {
        const parsed = JSON.parse(sessionAuth);
        if (parsed.tokens) {
          return parsed.tokens;
        }
      } catch (e) {
        console.error('[AIService] Error parsing session auth:', e);
      }
    }
    
    return null;
  }

  public getEnabledProviders(): AIProvider[] {
    return this.providers.filter(p => p.enabled);
  }

  public updateProvider(id: string, updates: Partial<AIProvider>) {
    const provider = this.providers.find(p => p.id === id);
    if (provider) {
      Object.assign(provider, updates);
      this.saveProviders();
    }
  }

  private saveProviders() {
    localStorage.setItem('wit-ai-providers', JSON.stringify(this.providers));
  }

  public isConfigured(): boolean {
    return this.providers.some(p => p.enabled);
  }
}

export default new AIService();