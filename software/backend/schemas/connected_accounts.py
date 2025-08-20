"""
Schemas for Connected Accounts functionality
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Literal
from datetime import datetime
from enum import Enum

class AuthType(str, Enum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    CREDENTIALS = "credentials"

class ProviderCategory(str, Enum):
    PROJECT_MANAGEMENT = "project_management"
    FILE_MANAGEMENT = "file_management"
    DEVELOPMENT = "development"
    CLOUD = "cloud"
    AI = "ai"
    PROCUREMENT = "procurement"

class ProviderConfig(BaseModel):
    """Configuration for an integration provider"""
    id: str
    name: str
    description: str
    category: ProviderCategory
    auth_type: AuthType
    oauth_config: Optional[Dict[str, str]] = None
    required_fields: List[str] = []
    supported_features: List[str] = []
    icon: str
    color: str

class ConnectedAccountCreate(BaseModel):
    """Schema for creating a connected account"""
    provider_id: str
    auth_data: Dict[str, Any]
    settings: Optional[Dict[str, Any]] = {}

class ConnectedAccountUpdate(BaseModel):
    """Schema for updating a connected account"""
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ConnectedAccountResponse(BaseModel):
    """Response schema for connected account"""
    id: str
    user_id: str
    provider_id: str
    provider_name: str
    created_at: datetime
    updated_at: datetime
    last_synced: Optional[datetime] = None
    is_active: bool = True
    settings: Dict[str, Any] = {}
    
    class Config:
        orm_mode = True

class OAuthCallback(BaseModel):
    """OAuth callback data"""
    code: str
    state: str
    error: Optional[str] = None
    error_description: Optional[str] = None

class DataSyncRequest(BaseModel):
    """Request to sync data from connected account"""
    data_types: List[str] = Field(
        default=["all"],
        description="Types of data to sync (e.g., 'projects', 'files', 'issues')"
    )
    options: Dict[str, Any] = Field(
        default_factory=dict,
        description="Provider-specific sync options"
    )
    since: Optional[datetime] = Field(
        None,
        description="Sync data modified after this timestamp"
    )

class DataSyncResponse(BaseModel):
    """Response from data sync operation"""
    account_id: str
    provider: str
    synced_at: datetime
    items_synced: int
    status: Literal["success", "partial", "failed"]
    errors: List[str] = []

# Provider-specific schemas

class GitHubRepo(BaseModel):
    """GitHub repository"""
    id: int
    name: str
    full_name: str
    description: Optional[str]
    url: str
    clone_url: str
    private: bool
    created_at: datetime
    updated_at: datetime
    language: Optional[str]
    default_branch: str
    open_issues_count: int

class GoogleDriveFile(BaseModel):
    """Google Drive file"""
    id: str
    name: str
    mime_type: str
    size: Optional[int]
    created_time: datetime
    modified_time: datetime
    web_view_link: str
    download_link: Optional[str]
    parent_id: Optional[str]

class LinearIssue(BaseModel):
    """Linear issue"""
    id: str
    title: str
    description: Optional[str]
    state: str
    priority: int
    created_at: datetime
    updated_at: datetime
    assignee: Optional[Dict[str, str]]
    project_id: Optional[str]
    labels: List[str] = []

class McMasterPart(BaseModel):
    """McMaster-Carr part"""
    part_number: str
    name: str
    description: str
    price: float
    unit: str
    availability: str
    specifications: Dict[str, Any]
    image_url: Optional[str]
    cad_url: Optional[str]

class DigiKeyPart(BaseModel):
    """DigiKey electronic component"""
    part_number: str
    manufacturer_part_number: str
    manufacturer: str
    description: str
    price_breaks: List[Dict[str, float]]
    stock_quantity: int
    datasheet_url: Optional[str]
    category: str
    parameters: Dict[str, str]

class JLCPCBQuote(BaseModel):
    """JLCPCB manufacturing quote"""
    board_quantity: int
    board_dimensions: Dict[str, float]  # width, height in mm
    layers: int
    surface_finish: str
    price_breakdown: Dict[str, float]
    total_price: float
    lead_time_days: int
    shipping_options: List[Dict[str, Any]]