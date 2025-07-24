// software/frontend/web/src/components/Resizer.tsx
import React from 'react';
import './Resizer.css';

interface ResizerProps {
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const Resizer: React.FC<ResizerProps> = ({ onMouseDown }) => {
    return (
        <div 
            className="resizer"
            onMouseDown={onMouseDown}
        />
    );
};

export default Resizer;
