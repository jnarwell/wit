// src/components/PageLayout.tsx
import React from 'react';
import SubpageNavigation, { SubpageConfig } from './SubpageNavigation';

interface PageLayoutProps {
  title?: string;
  subpages?: SubpageConfig[];
  activeSubpage?: string;
  onSubpageChange?: (pageId: string) => void;
  onSubpageRename?: (pageId: string, newName: string) => void;
  onSubpageClose?: (pageId: string) => void;
  onSubpageAction?: (action: string, pageId: string) => void;
  children: React.ReactNode;
  className?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subpages,
  activeSubpage,
  onSubpageChange,
  onSubpageRename,
  onSubpageClose,
  onSubpageAction,
  children,
  className = ''
}) => {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Page Header */}
      {title && (
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
        </div>
      )}

      {/* Subpage Navigation */}
      {subpages && activeSubpage && onSubpageChange && (
        <SubpageNavigation
          pages={subpages}
          activePage={activeSubpage}
          onPageChange={onSubpageChange}
          onPageRename={onSubpageRename}
          onPageClose={onSubpageClose}
          onPageAction={onSubpageAction}
        />
      )}

      {/* Page Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;