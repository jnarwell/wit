// software/frontend/web/src/components/ImageViewer.tsx
import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000';

interface ImageViewerProps {
    path: string;
    baseDir: string;
    projectId?: string;
    fileName: string;
    token: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ path, baseDir, projectId, fileName, token }) => {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const loadImage = async () => {
            try {
                const url = `${API_BASE_URL}/api/v1/files/download?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load image: ${response.statusText}`);
                }

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                setImageSrc(objectUrl);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load image');
                setLoading(false);
            }
        };

        loadImage();

        // Cleanup function to revoke the object URL
        return () => {
            if (imageSrc) {
                URL.revokeObjectURL(imageSrc);
            }
        };
    }, [path, baseDir, projectId, token]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                backgroundColor: '#1a1a1a',
                color: '#888'
            }}>
                Loading image...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                backgroundColor: '#1a1a1a',
                color: '#ff6b6b',
                fontSize: '18px',
                gap: '10px'
            }}>
                <div>Failed to load image</div>
                <div style={{ fontSize: '14px', color: '#888' }}>{error}</div>
            </div>
        );
    }

    return (
        <div className="image-viewer" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#1a1a1a'
        }}>
            {/* Image info bar */}
            <div style={{
                padding: '10px',
                backgroundColor: '#2a2a2a',
                borderBottom: '1px solid #3a3a3a',
                color: '#ccc',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>{fileName}</span>
                {imageSize && (
                    <span style={{ color: '#888' }}>
                        {imageSize.width} × {imageSize.height} pixels
                    </span>
                )}
            </div>
            
            {/* Image container */}
            <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                padding: '20px'
            }}>
                <img
                    src={imageSrc}
                    alt={fileName}
                    onLoad={handleImageLoad}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}
                />
            </div>
        </div>
    );
};

export default ImageViewer;