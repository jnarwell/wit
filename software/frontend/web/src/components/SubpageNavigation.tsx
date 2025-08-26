// src/components/SubpageNavigation.tsx
import React, { useState } from 'react';
import { FiX, FiEdit2, FiCheck, FiPlus } from 'react-icons/fi';

export interface SubpageConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
  editable?: boolean;
  closeable?: boolean;
  action?: 'navigate' | 'create';
}

interface SubpageNavigationProps {
  pages: SubpageConfig[];
  activePage: string;
  onPageChange: (pageId: string) => void;
  onPageRename?: (pageId: string, newName: string) => void;
  onPageClose?: (pageId: string) => void;
  onPageAction?: (action: string, pageId: string) => void;
}

const SubpageNavigation: React.FC<SubpageNavigationProps> = ({
  pages,
  activePage,
  onPageChange,
  onPageRename,
  onPageClose,
  onPageAction
}) => {
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (page: SubpageConfig) => {
    if (page.editable && onPageRename) {
      setEditingPage(page.id);
      setEditValue(page.label);
    }
  };

  const handleSaveEdit = () => {
    if (editingPage && onPageRename && editValue.trim()) {
      onPageRename(editingPage, editValue.trim());
      setEditingPage(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPage(null);
    setEditValue('');
  };

  const handleTabClick = (page: SubpageConfig) => {
    if (page.action === 'create' && onPageAction) {
      onPageAction('create', page.id);
    } else if (page.action !== 'create') {
      onPageChange(page.id);
    }
  };

  return (
    <div className="bg-gray-900 border-b border-gray-700">
      <div className="flex items-center space-x-1 px-4 py-2 overflow-x-auto">
        {pages.map(page => (
          <div
            key={page.id}
            className={`
              relative flex items-center px-4 py-2 rounded-t cursor-pointer transition-all
              ${activePage === page.id 
                ? 'bg-gray-800 text-white border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }
              ${page.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${page.action === 'create' ? 'ml-2' : ''}
            `}
            onClick={() => !page.disabled && !editingPage && handleTabClick(page)}
          >
            <span className="flex items-center space-x-2 whitespace-nowrap">
              {page.icon}
              {editingPage === page.id ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gray-700 px-2 py-1 rounded text-sm outline-none"
                  autoFocus
                />
              ) : (
                <span
                  onDoubleClick={() => handleStartEdit(page)}
                  className={page.editable ? 'cursor-text' : ''}
                >
                  {page.label}
                </span>
              )}
              {page.badge && (
                <span className={`
                  ml-2 text-xs px-2 py-0.5 rounded
                  ${typeof page.badge === 'number' 
                    ? 'bg-blue-600 text-white' 
                    : page.badge === '•' 
                      ? 'text-green-400' 
                      : 'bg-gray-700 text-gray-300'
                  }
                `}>
                  {page.badge}
                </span>
              )}
            </span>

            {/* Edit/Save/Cancel buttons */}
            {page.editable && !editingPage && activePage === page.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(page);
                }}
                className="ml-2 text-gray-500 hover:text-white"
              >
                <FiEdit2 className="w-3 h-3" />
              </button>
            )}

            {editingPage === page.id && (
              <div className="flex items-center ml-2 space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                  className="text-green-500 hover:text-green-400"
                >
                  <FiCheck className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="text-red-500 hover:text-red-400"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Close button */}
            {page.closeable && onPageClose && !editingPage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPageClose(page.id);
                }}
                className="ml-2 text-gray-500 hover:text-red-400"
              >
                <FiX className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubpageNavigation;