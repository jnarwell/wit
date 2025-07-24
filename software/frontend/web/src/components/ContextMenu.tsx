// software/frontend/web/src/components/ContextMenu.tsx
import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

interface MenuItem {
    label: string;
    action: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div ref={menuRef} className="context-menu" style={{ top: y, left: x }}>
            <ul>
                {items.map((item, index) => (
                    <li key={index} onClick={item.action}>
                        {item.label}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContextMenu;