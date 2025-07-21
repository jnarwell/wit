"""
W.I.T. Complete Database Schema Migration

File: software/backend/alembic/versions/001_complete_schema.py

Create all tables for the W.I.T. project management system
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '001_complete_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create all tables"""
    
    # Create UUID extension for PostgreSQL
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";")
    
    # Users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_admin', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('voice_settings', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('workspace_config', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_username', 'users', ['username'])
    
    # Equipment table
    op.create_table('equipment',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('equipment_id', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('manufacturer', sa.String(100), nullable=True),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('status', sa.String(50), default='offline'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('equipment_id')
    )
    op.create_index('ix_equipment_equipment_id', 'equipment', ['equipment_id'])
    op.create_index('idx_equipment_type_status', 'equipment', ['type', 'status'])
    
    # Projects table
    op.create_table('projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('project_id', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id')
    )
    op.create_index('ix_projects_project_id', 'projects', ['project_id'])
    
    # Tags table
    op.create_table('tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Tasks table
    op.create_table('tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('task_id', sa.String(50), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), default='todo'),
        sa.Column('priority', sa.String(20), default='medium'),
        sa.Column('position', sa.Integer(), default=0),
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('estimated_hours', sa.Float(), nullable=True),
        sa.Column('actual_hours', sa.Float(), default=0),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), default=[]),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['tasks.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id')
    )
    op.create_index('ix_tasks_task_id', 'tasks', ['task_id'])
    op.create_index('idx_task_status_position', 'tasks', ['status', 'position'])
    op.create_index('idx_task_project_status', 'tasks', ['project_id', 'status'])
    op.create_index('idx_task_assignee_status', 'tasks', ['assignee_id', 'status'])
    
    # Teams table
    op.create_table('teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('team_id', sa.String(50), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(50), default='general'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id')
    )
    op.create_index('ix_teams_team_id', 'teams', ['team_id'])
    
    # Materials table
    op.create_table('materials',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('material_id', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('color', sa.String(50), nullable=True),
        sa.Column('properties', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('supplier', sa.String(100), nullable=True),
        sa.Column('cost_per_unit', sa.Float(), nullable=True),
        sa.Column('min_stock_level', sa.Float(), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('material_id')
    )
    op.create_index('ix_materials_material_id', 'materials', ['material_id'])
    op.create_index('idx_material_type_supplier', 'materials', ['type', 'supplier'])
    
    # Jobs table
    op.create_table('jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('job_id', sa.String(50), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('priority', sa.Integer(), default=0),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('progress', sa.Float(), default=0.0),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('parameters', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id')
    )
    op.create_index('ix_jobs_job_id', 'jobs', ['job_id'])
    op.create_index('idx_job_status_priority', 'jobs', ['status', 'priority'])
    op.create_index('idx_job_equipment_status', 'jobs', ['equipment_id', 'status'])
    
    # Team members table
    op.create_table('team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), default='member'),
        sa.Column('permissions', postgresql.JSONB(astext_type=sa.Text()), default=[]),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'user_id')
    )
    op.create_index('idx_team_member_user', 'team_members', ['user_id', 'team_id'])
    
    # Project materials table
    op.create_table('project_materials',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('material_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('required_quantity', sa.Float(), nullable=False),
        sa.Column('allocated_quantity', sa.Float(), default=0),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'material_id')
    )
    op.create_index('idx_project_material', 'project_materials', ['project_id', 'material_id'])
    
    # Project files table
    op.create_table('project_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('file_id', sa.String(50), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('folder', sa.String(500), default='/'),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('size', sa.Integer(), nullable=True),
        sa.Column('storage_path', sa.String(1000), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), default=[]),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id')
    )
    op.create_index('ix_project_files_file_id', 'project_files', ['file_id'])
    op.create_index('idx_project_file_folder', 'project_files', ['project_id', 'folder'])
    op.create_index('idx_project_file_type', 'project_files', ['project_id', 'file_type'])
    
    # Material usage table
    op.create_table('material_usage',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('project_material_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('purpose', sa.String(200), nullable=True),
        sa.Column('used_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.ForeignKeyConstraint(['project_material_id'], ['project_materials.id'], ),
        sa.ForeignKeyConstraint(['used_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # File versions table
    op.create_table('file_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('size', sa.Integer(), nullable=True),
        sa.Column('storage_path', sa.String(1000), nullable=True),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('changes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['project_files.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id', 'version_number')
    )
    op.create_index('idx_file_version', 'file_versions', ['file_id', 'version_number'])
    
    # Comments table
    op.create_table('comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('commentable_type', sa.String(50), nullable=True),
        sa.Column('commentable_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['comments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comment_commentable', 'comments', ['commentable_type', 'commentable_id'])
    
    # Association tables
    op.create_table('project_tags',
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ),
        sa.UniqueConstraint('project_id', 'tag_id')
    )
    
    op.create_table('task_dependencies',
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('depends_on_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['depends_on_id'], ['tasks.id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ),
        sa.UniqueConstraint('task_id', 'depends_on_id')
    )


def downgrade():
    """Drop all tables"""
    op.drop_table('task_dependencies')
    op.drop_table('project_tags')
    op.drop_table('comments')
    op.drop_table('file_versions')
    op.drop_table('material_usage')
    op.drop_table('project_files')
    op.drop_table('project_materials')
    op.drop_table('team_members')
    op.drop_table('jobs')
    op.drop_table('materials')
    op.drop_table('teams')
    op.drop_table('tasks')
    op.drop_table('tags')
    op.drop_table('projects')
    op.drop_table('equipment')
    op.drop_table('users')