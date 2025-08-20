import React, { useState, useEffect } from 'react';
import { FiSettings, FiUser, FiShield, FiLink, FiCheck, FiX, FiRefreshCw, FiChevronDown, FiChevronUp, FiCpu, FiServer, FiCopy, FiEye, FiEyeOff, FiKey } from 'react-icons/fi';
import { FaGoogle, FaGithub, FaAws, FaMicrosoft, FaApple, FaJira, FaRobot, FaBrain, FaWrench, FaMicrochip, FaCube, FaCog, FaIndustry } from 'react-icons/fa';
import { SiNotion, SiLinear, SiOpenai, SiGooglegemini } from 'react-icons/si';
import { useAuth } from '../contexts/AuthContext';
import accountService from '../services/accountService';
import MCPSettingsComponent from '../components/MCPSettings';
import './SettingsPage.css';

interface LinkedAccount {
  provider: string;
  provider_user_id: string;
  email?: string;
  name?: string;
  connected_at: string;
  last_sync?: string;
  scopes: string[];
  status: 'connected' | 'error' | 'refreshing';
}

interface ProviderConfig {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  description: string;
  scopes: string[];
  category: 'project_management' | 'file_management' | 'development' | 'cloud' | 'ai' | 'procurement';
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google',
    icon: FaGoogle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    description: 'Access Google Drive, Gmail, and Calendar',
    scopes: ['drive', 'gmail', 'calendar'],
    category: 'file_management'
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: FaGithub,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    description: 'Access repositories, issues, and pull requests',
    scopes: ['repo', 'user', 'gist'],
    category: 'development'
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: SiNotion,
    color: 'text-black',
    bgColor: 'bg-gray-50',
    description: 'Access and sync Notion workspaces',
    scopes: ['read_content', 'write_content'],
    category: 'project_management'
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    icon: FaMicrosoft,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Access Outlook, OneDrive, and Teams',
    scopes: ['mail', 'files', 'calendar'],
    category: 'file_management'
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: FaApple,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    description: 'Access iCloud services',
    scopes: ['icloud_drive', 'mail'],
    category: 'file_management'
  },
  {
    id: 'aws',
    name: 'AWS',
    icon: FaAws,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    description: 'Manage AWS resources and services',
    scopes: ['ec2', 's3', 'lambda'],
    category: 'cloud'
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: FaJira,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Access Jira projects and issues',
    scopes: ['read_jira', 'write_jira'],
    category: 'project_management'
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: SiLinear,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Sync Linear issues and projects',
    scopes: ['read', 'write', 'admin'],
    category: 'project_management'
  },
  {
    id: 'mcmaster',
    name: 'McMaster-Carr',
    icon: FaWrench,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: 'Access your McMaster-Carr account for automated parts ordering',
    scopes: ['account', 'cart', 'orders', 'pricing'],
    category: 'procurement'
  },
  {
    id: 'digikey',
    name: 'DigiKey',
    icon: FaMicrochip,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    description: 'Electronic components ordering and inventory management',
    scopes: ['account', 'cart', 'orders', 'pricing', 'inventory'],
    category: 'procurement'
  },
  {
    id: 'mouser',
    name: 'Mouser Electronics',
    icon: FaMicrochip,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Electronic components and semiconductors procurement',
    scopes: ['account', 'cart', 'orders', 'pricing', 'inventory'],
    category: 'procurement'
  },
  {
    id: 'oshcut',
    name: 'OSHCut',
    icon: FaCog,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Custom PCB manufacturing and assembly services',
    scopes: ['account', 'projects', 'quotes', 'orders', 'files'],
    category: 'procurement'
  },
  {
    id: 'jlcpcb',
    name: 'JLCPCB',
    icon: FaCube,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    description: 'PCB manufacturing, SMT assembly, and 3D printing services',
    scopes: ['account', 'projects', 'quotes', 'orders', 'files'],
    category: 'procurement'
  },
  {
    id: 'pcbway',
    name: 'PCBWay',
    icon: FaCube,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    description: 'PCB fabrication, assembly, and CNC machining services',
    scopes: ['account', 'projects', 'quotes', 'orders', 'files'],
    category: 'procurement'
  },
  {
    id: 'xometry',
    name: 'Xometry',
    icon: FaIndustry,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'On-demand manufacturing: CNC machining, 3D printing, sheet metal',
    scopes: ['account', 'projects', 'quotes', 'orders', 'files'],
    category: 'procurement'
  },
  {
    id: 'protolabs',
    name: 'Protolabs',
    icon: FaIndustry,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: 'Digital manufacturing: injection molding, CNC, 3D printing',
    scopes: ['account', 'projects', 'quotes', 'orders', 'files'],
    category: 'procurement'
  }
];

const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: FaRobot,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: 'Connect to Claude AI for intelligent assistance',
    scopes: ['chat', 'completions'],
    category: 'ai'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: SiOpenai,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Access GPT models and DALL-E for AI capabilities',
    scopes: ['chat', 'completions', 'images'],
    category: 'ai'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: SiGooglegemini,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Use Google\'s Gemini AI models',
    scopes: ['chat', 'completions'],
    category: 'ai'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: FaRobot,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Connect to DeepSeek AI models',
    scopes: ['chat', 'completions'],
    category: 'ai'
  }
];

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'ai' | 'mcp' | 'security' | 'preferences'>('accounts');
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['project_management', 'file_management', 'development', 'cloud']));
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const linkedProvider = urlParams.get('linked');
    const status = urlParams.get('status');
    const errorMessage = urlParams.get('message');

    if (linkedProvider) {
      if (status === 'success') {
        console.log(`Successfully linked ${linkedProvider} account`);
        // Show success message or notification
      } else if (status === 'error') {
        console.error(`Failed to link ${linkedProvider}:`, errorMessage);
        alert(`Failed to link ${linkedProvider} account: ${errorMessage || 'Unknown error'}`);
      }
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchLinkedAccounts();
    
    // Get auth token from localStorage when security tab is active
    if (activeTab === 'security') {
      const storedTokens = localStorage.getItem('wit-auth-tokens') || sessionStorage.getItem('wit-auth-tokens');
      if (storedTokens) {
        try {
          const tokens = JSON.parse(storedTokens);
          setAuthToken(tokens.access_token);
        } catch (error) {
          console.error('Failed to parse stored tokens:', error);
          setAuthToken(null);
        }
      } else {
        setAuthToken(null);
      }
    }
  }, [activeTab]);

  const fetchLinkedAccounts = async () => {
    setIsLoading(true);
    try {
      const accounts = await accountService.getLinkedAccounts();
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error('Failed to fetch linked accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnectingProvider(providerId);
    try {
      const response = await accountService.linkAccount(providerId);
      // Redirect to OAuth provider
      window.location.href = response.auth_url;
    } catch (error) {
      console.error(`Failed to connect ${providerId}:`, error);
      // For development, show a message instead of failing silently
      alert(`OAuth integration for ${providerId} is not yet implemented on the backend.`);
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm(`Are you sure you want to disconnect your ${providerId} account?`)) {
      return;
    }

    try {
      await accountService.unlinkAccount(providerId);
      setLinkedAccounts(prev => prev.filter(acc => acc.provider !== providerId));
    } catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error);
      alert(`Failed to disconnect ${providerId} account. Please try again.`);
    }
  };

  const isProviderConnected = (providerId: string) => {
    return linkedAccounts.some(acc => acc.provider === providerId && acc.status === 'connected');
  };

  const getLinkedAccount = (providerId: string) => {
    return linkedAccounts.find(acc => acc.provider === providerId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const copyAuthToken = async () => {
    if (!authToken) return;
    
    try {
      await navigator.clipboard.writeText(authToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = authToken;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const getCategoryName = (category: string): string => {
    switch (category) {
      case 'project_management':
        return 'Project Management';
      case 'file_management':
        return 'File Management';
      case 'development':
        return 'Development Tools';
      case 'cloud':
        return 'Cloud Services';
      case 'procurement':
        return 'Procurement & Ordering';
      default:
        return category;
    }
  };

  const renderCategorySection = (category: string, providers: ProviderConfig[]) => {
    const isExpanded = expandedCategories.has(category);
    const categoryProviders = providers.filter(p => p.category === category);

    if (categoryProviders.length === 0) return null;

    return (
      <div key={category} className="category-section">
        <button
          className="category-header"
          onClick={() => toggleCategory(category)}
        >
          <h3 className="category-title">{getCategoryName(category)}</h3>
          {isExpanded ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
        </button>
        {isExpanded && (
          <div className="category-content">
            {categoryProviders.map(provider => renderAccountCard(provider))}
          </div>
        )}
      </div>
    );
  };

  const renderAccountCard = (provider: ProviderConfig) => {
    const Icon = provider.icon;
    const isConnected = isProviderConnected(provider.id);
    const account = getLinkedAccount(provider.id);
    const isConnecting = connectingProvider === provider.id;

    return (
      <div key={provider.id} className="account-card">
        <div className="account-card-header">
          <div className={`account-icon ${provider.bgColor} ${provider.color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="account-info">
            <h3 className="account-name">{provider.name}</h3>
            <p className="account-description">{provider.description}</p>
          </div>
        </div>

        <div className="account-card-body">
          {isConnected && account ? (
            <>
              <div className="connection-status connected">
                <FiCheck className="w-4 h-4" />
                <span>Connected</span>
              </div>
              <div className="connection-details">
                {account.email && (
                  <p className="text-sm text-gray-600">{account.email}</p>
                )}
                {account.last_sync && (
                  <p className="text-xs text-gray-500">
                    Last synced: {formatDate(account.last_sync)}
                  </p>
                )}
              </div>
              <div className="account-scopes">
                {account.scopes.map(scope => (
                  <span key={scope} className="scope-badge">{scope}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="connection-status disconnected">
              <FiX className="w-4 h-4" />
              <span>Not connected</span>
            </div>
          )}
        </div>

        <div className="account-card-footer">
          {isConnected ? (
            <button
              onClick={() => handleDisconnect(provider.id)}
              className="btn-disconnect"
              disabled={isConnecting}
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => handleConnect(provider.id)}
              className="btn-connect"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="settings-section">
            <h2 className="section-title">Profile Information</h2>
            <div className="profile-info">
              <div className="info-group">
                <label>Username</label>
                <p>{user?.username || 'N/A'}</p>
              </div>
              <div className="info-group">
                <label>Email</label>
                <p>{user?.email || 'N/A'}</p>
              </div>
              <div className="info-group">
                <label>Role</label>
                <p>{user?.is_admin ? 'Administrator' : 'Operator'}</p>
              </div>
              <div className="info-group">
                <label>Member Since</label>
                <p>{user?.created_at ? formatDate(user.created_at) : 'N/A'}</p>
              </div>
            </div>
          </div>
        );

      case 'accounts':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">Connected Accounts</h2>
              <p className="section-description">
                Connect your accounts to access files, emails, and integrate with your favorite tools
              </p>
            </div>
            
            {isLoading ? (
              <div className="loading-state">
                <FiRefreshCw className="w-6 h-6 animate-spin" />
                <p>Loading connected accounts...</p>
              </div>
            ) : (
              <div className="categories-container">
                {renderCategorySection('project_management', PROVIDERS)}
                {renderCategorySection('file_management', PROVIDERS)}
                {renderCategorySection('development', PROVIDERS)}
                {renderCategorySection('cloud', PROVIDERS)}
                {renderCategorySection('procurement', PROVIDERS)}
              </div>
            )}
          </div>
        );

      case 'ai':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">AI Connections</h2>
              <p className="section-description">
                Connect to AI providers for intelligent assistance and automation
              </p>
            </div>
            
            {isLoading ? (
              <div className="loading-state">
                <FiRefreshCw className="w-6 h-6 animate-spin" />
                <p>Loading AI connections...</p>
              </div>
            ) : (
              <div className="accounts-grid">
                {AI_PROVIDERS.map(provider => renderAccountCard(provider))}
              </div>
            )}
          </div>
        );

      case 'mcp':
        return (
          <div className="settings-section">
            <div className="section-header">
              <h2 className="section-title">MCP Settings</h2>
              <p className="section-description">
                Configure Model Context Protocol for two-way AI model communication
              </p>
            </div>
            
            <button
              onClick={() => setShowMCPSettings(true)}
              className="btn-connect"
              style={{ width: 'auto', padding: '12px 24px' }}
            >
              <FiServer className="w-4 h-4 mr-2" />
              Open MCP Configuration
            </button>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-700 mb-2">What is MCP?</h3>
              <p className="text-sm text-gray-600 mb-2">
                The Model Context Protocol (MCP) enables secure, bidirectional communication between WIT and external AI models.
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Share specific data types (machines, projects, sensors) with AI models</li>
                <li>Control read/write permissions for external models</li>
                <li>Enable AI models to interact with your WIT workspace</li>
                <li>Maintain data privacy with granular access controls</li>
              </ul>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="settings-section">
            <h2 className="section-title">Security Settings</h2>
            
            {/* Auth Token Section */}
            <div className="auth-token-section">
              <div className="auth-token-header">
                <h3 className="auth-token-title">
                  <FiKey className="w-5 h-5" />
                  API Authentication Token
                </h3>
                <p className="auth-token-description">
                  Use this token to authenticate with W.I.T. desktop applications and integrations
                </p>
              </div>
              
              <div className="auth-token-container">
                <div className="auth-token-input-wrapper">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={authToken || 'No token found'}
                    readOnly
                    className="auth-token-input"
                    disabled={!authToken}
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="auth-token-toggle"
                    disabled={!authToken}
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={copyAuthToken}
                    className={`auth-token-copy ${tokenCopied ? 'copied' : ''}`}
                    disabled={!authToken}
                    title={tokenCopied ? 'Copied!' : 'Copy token'}
                  >
                    {tokenCopied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                  </button>
                </div>
                
                {!authToken && (
                  <p className="auth-token-error">
                    No authentication token found. Please log in again to generate a token.
                  </p>
                )}
                
                <div className="auth-token-info">
                  <p className="text-sm text-gray-600">
                    <strong>Important:</strong> Keep this token secure. Anyone with access to this token can make API requests on your behalf.
                  </p>
                  <ul className="auth-token-usage">
                    <li>Use this token in the W.I.T. Universal Desktop Controller</li>
                    <li>Include it in API requests as a Bearer token</li>
                    <li>Store it securely in desktop applications</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Other Security Options */}
            <div className="security-options">
              <button className="security-btn">
                Change Password
              </button>
              <button className="security-btn">
                Enable Two-Factor Authentication
              </button>
              <button className="security-btn">
                View Active Sessions
              </button>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="settings-section">
            <h2 className="section-title">Preferences</h2>
            <div className="preferences-options">
              <div className="preference-group">
                <label>Theme</label>
                <select className="preference-select">
                  <option>Dark</option>
                  <option>Light</option>
                  <option>System</option>
                </select>
              </div>
              <div className="preference-group">
                <label>Notifications</label>
                <div className="preference-toggles">
                  <label className="toggle-label">
                    <input type="checkbox" defaultChecked />
                    Email notifications
                  </label>
                  <label className="toggle-label">
                    <input type="checkbox" defaultChecked />
                    Push notifications
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <FiSettings className="w-8 h-8 text-blue-600" />
          <h1 className="settings-title">Account Settings</h1>
        </div>

        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <FiUser className="w-4 h-4" />
            Profile
          </button>
          <button
            className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <FiLink className="w-4 h-4" />
            Connected Accounts
          </button>
          <button
            className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <FaBrain className="w-4 h-4" />
            AI Connections
          </button>
          <button
            className={`tab-btn ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            <FiServer className="w-4 h-4" />
            MCP
          </button>
          <button
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <FiShield className="w-4 h-4" />
            Security
          </button>
          <button
            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <FiSettings className="w-4 h-4" />
            Preferences
          </button>
        </div>

        <div className="settings-content">
          {renderContent()}
        </div>
      </div>

      {showMCPSettings && (
        <MCPSettingsComponent onClose={() => setShowMCPSettings(false)} />
      )}
    </div>
  );
};

export default SettingsPage;