import React, { useState, useEffect } from 'react';
import { FiSettings, FiUser, FiShield, FiLink, FiCheck, FiX, FiRefreshCw, FiChevronDown, FiChevronUp, FiCpu } from 'react-icons/fi';
import { FaGoogle, FaGithub, FaAws, FaMicrosoft, FaApple, FaJira, FaRobot, FaBrain } from 'react-icons/fa';
import { SiNotion, SiLinear, SiOpenai, SiGooglegemini } from 'react-icons/si';
import { useAuth } from '../contexts/AuthContext';
import accountService from '../services/accountService';
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
  category: 'project_management' | 'file_management' | 'development' | 'cloud' | 'ai';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'ai' | 'security' | 'preferences'>('accounts');
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['project_management', 'file_management', 'development', 'cloud']));

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
  }, []);

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

      case 'security':
        return (
          <div className="settings-section">
            <h2 className="section-title">Security Settings</h2>
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
    </div>
  );
};

export default SettingsPage;