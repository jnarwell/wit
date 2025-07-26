// software/frontend/web/src/components/ThreeDViewer.tsx
import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { 
    OrbitControls, 
    Stage, 
    Grid, 
    Environment,
    Center,
    Html,
    useProgress
} from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader';
import * as THREE from 'three';

const API_BASE_URL = 'http://localhost:8000';

interface ThreeDViewerProps {
    path: string;
    baseDir: string;
    projectId?: string;
    fileName: string;
    token: string;
}

// Loader component to show progress
function Loader() {
    const { active, progress, errors, item, loaded, total } = useProgress();
    return (
        <Html center>
            <div style={{
                background: '#2a2a2a',
                padding: '20px',
                borderRadius: '8px',
                color: '#f0f0f0',
                textAlign: 'center'
            }}>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                    Loading 3D Model...
                </div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    {Math.round(progress)}%
                </div>
            </div>
        </Html>
    );
}

// Simple error boundary component
class ModelErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('3D Model loading error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Html center>
                    <div style={{
                        background: '#2a2a2a',
                        padding: '20px',
                        borderRadius: '8px',
                        color: '#ff6b6b',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                            Error Loading Model
                        </div>
                        <div style={{ fontSize: '14px', color: '#888' }}>
                            Failed to load 3D model
                        </div>
                    </div>
                </Html>
            );
        }

        return this.props.children;
    }
}

// Model component that loads and displays the 3D file
function Model({ url, fileExtension, autoRotate }: { url: string; fileExtension: string; autoRotate: boolean }) {
    const meshRef = useRef<THREE.Mesh | THREE.Group>(null);
    
    // Auto-rotate the model
    useFrame((state, delta) => {
        if (meshRef.current && autoRotate) {
            meshRef.current.rotation.y += delta * 0.2;
        }
    });

    // Load model based on file extension
    if (fileExtension === 'stl') {
        const geometry = useLoader(STLLoader, url);
        // Compute normals if they don't exist
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }
        return (
            <mesh ref={meshRef} geometry={geometry}>
                <meshStandardMaterial 
                    color="#8888ff" 
                    metalness={0.4}
                    roughness={0.3}
                />
            </mesh>
        );
    } else if (fileExtension === 'glb' || fileExtension === 'gltf') {
        const gltf = useLoader(GLTFLoader, url);
        return <primitive ref={meshRef} object={gltf.scene} />;
    } else if (fileExtension === 'obj') {
        const obj = useLoader(OBJLoader, url);
        return <primitive ref={meshRef} object={obj} />;
    } else if (fileExtension === 'fbx') {
        const fbx = useLoader(FBXLoader, url);
        return <primitive ref={meshRef} object={fbx} />;
    } else if (fileExtension === 'ply') {
        const geometry = useLoader(PLYLoader, url);
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }
        return (
            <mesh ref={meshRef} geometry={geometry}>
                <meshStandardMaterial 
                    color="#8888ff" 
                    metalness={0.4}
                    roughness={0.3}
                />
            </mesh>
        );
    } else if (fileExtension === '3mf') {
        const object3mf = useLoader(ThreeMFLoader, url);
        return <primitive ref={meshRef} object={object3mf} />;
    }

    // Unsupported format
    return (
        <Html center>
            <div style={{
                background: '#2a2a2a',
                padding: '20px',
                borderRadius: '8px',
                color: '#ff6b6b',
                textAlign: 'center',
                maxWidth: '400px'
            }}>
                <div style={{ fontSize: '18px', marginBottom: '10px' }}>
                    Unsupported 3D Format
                </div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    The file format ".{fileExtension}" is not yet supported for preview.
                    Supported formats: STL, GLB, GLTF, OBJ, FBX, PLY, 3MF
                </div>
            </div>
        </Html>
    );
}

const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ path, baseDir, projectId, fileName, token }) => {
    const [modelUrl, setModelUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [autoRotate, setAutoRotate] = useState(true);
    const [wireframe, setWireframe] = useState(false);
    
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    useEffect(() => {
        const loadModel = async () => {
            try {
                const url = `${API_BASE_URL}/api/v1/files/download?path=${encodeURIComponent(path)}&base_dir=${baseDir}${projectId ? `&project_id=${projectId}` : ''}`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load 3D model: ${response.statusText}`);
                }

                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                setModelUrl(objectUrl);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load 3D model');
                setLoading(false);
            }
        };

        loadModel();

        // Cleanup
        return () => {
            if (modelUrl) {
                URL.revokeObjectURL(modelUrl);
            }
        };
    }, [path, baseDir, projectId, token]);

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
                Loading 3D model...
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
                <div>Failed to load 3D model</div>
                <div style={{ fontSize: '14px', color: '#888' }}>{error}</div>
            </div>
        );
    }

    return (
        <div className="three-d-viewer" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#1a1a1a'
        }}>
            {/* Controls bar */}
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
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                            type="checkbox"
                            checked={showGrid}
                            onChange={(e) => setShowGrid(e.target.checked)}
                        />
                        Grid
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                            type="checkbox"
                            checked={autoRotate}
                            onChange={(e) => setAutoRotate(e.target.checked)}
                        />
                        Auto-rotate
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                            type="checkbox"
                            checked={wireframe}
                            onChange={(e) => setWireframe(e.target.checked)}
                        />
                        Wireframe
                    </label>
                </div>
            </div>
            
            {/* 3D canvas */}
            <div style={{ flex: 1 }}>
                <Canvas
                    camera={{ position: [0, 0, 5], fov: 50 }}
                    style={{ background: '#0a0a0a' }}
                >
                    <Suspense fallback={<Loader />}>
                        <Stage
                            contactShadow={{ opacity: 0.2, blur: 3 }}
                            environment="city"
                            preset="rembrandt"
                            intensity={0.5}
                        >
                            <Center>
                                {modelUrl && (
                                    <ModelErrorBoundary>
                                        <Model url={modelUrl} fileExtension={fileExtension} autoRotate={autoRotate} />
                                    </ModelErrorBoundary>
                                )}
                            </Center>
                        </Stage>
                        
                        {showGrid && (
                            <Grid
                                args={[10, 10]}
                                cellSize={0.5}
                                cellThickness={0.5}
                                cellColor={'#3a3a3a'}
                                sectionSize={3}
                                sectionThickness={1}
                                sectionColor={'#555'}
                                fadeDistance={30}
                                fadeStrength={1}
                                followCamera={false}
                                infiniteGrid={true}
                            />
                        )}
                        
                        <OrbitControls 
                            autoRotate={autoRotate}
                            autoRotateSpeed={1}
                            enablePan={true}
                            enableZoom={true}
                            enableRotate={true}
                        />
                        
                        <Environment preset="city" />
                        
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[10, 10, 5]} intensity={1} />
                    </Suspense>
                </Canvas>
            </div>
            
            {/* Info bar */}
            <div style={{
                padding: '10px',
                backgroundColor: '#2a2a2a',
                borderTop: '1px solid #3a3a3a',
                color: '#888',
                fontSize: '12px',
                textAlign: 'center'
            }}>
                Mouse: Rotate | Scroll: Zoom | Right-click: Pan
            </div>
        </div>
    );
};

export default ThreeDViewer;