import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
    url: string;
    authToken?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, authToken }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [scale, setScale] = useState(1.5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const renderTaskRef = useRef<any>(null);

    const renderPage = async (pageNum: number) => {
        if (!pdfDoc || !canvasRef.current) return;

        // Cancel any existing render task
        if (renderTaskRef.current) {
            try {
                await renderTaskRef.current.cancel();
            } catch (err) {
                // Ignore cancellation errors
            }
            renderTaskRef.current = null;
        }

        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            renderTaskRef.current = page.render(renderContext);
            await renderTaskRef.current.promise;
            renderTaskRef.current = null;
        } catch (err) {
            if (err instanceof Error && err.message.includes('cancelled')) {
                // Ignore cancellation errors
                return;
            }
            setError('Error rendering page');
            console.error('Error rendering page:', err);
        }
    };

    useEffect(() => {
        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const options: any = {
                    url: url,
                };
                
                if (authToken) {
                    options.httpHeaders = {
                        'Authorization': `Bearer ${authToken}`
                    };
                }
                
                const loadingTask = pdfjsLib.getDocument(options);
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                setTotalPages(pdf.numPages);
                setCurrentPage(1);
            } catch (err) {
                setError('Failed to load PDF');
                console.error('Error loading PDF:', err);
            } finally {
                setLoading(false);
            }
        };

        loadPdf();
    }, [url, authToken]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(currentPage);
        }
    }, [pdfDoc, currentPage, scale]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cancel any pending render task
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel().catch(() => {
                    // Ignore cancellation errors
                });
            }
        };
    }, []);

    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const zoomIn = () => {
        setScale(scale + 0.25);
    };

    const zoomOut = () => {
        if (scale > 0.5) {
            setScale(scale - 0.25);
        }
    };

    if (loading) {
        return <div className="pdf-loading">Loading PDF...</div>;
    }

    if (error) {
        return <div className="pdf-error">{error}</div>;
    }

    return (
        <div className="pdf-viewer-container">
            <div className="pdf-controls">
                <button onClick={goToPrevPage} disabled={currentPage <= 1}>
                    Previous
                </button>
                <span className="page-info">
                    Page {currentPage} of {totalPages}
                </span>
                <button onClick={goToNextPage} disabled={currentPage >= totalPages}>
                    Next
                </button>
                <div className="zoom-controls">
                    <button onClick={zoomOut}>Zoom Out</button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn}>Zoom In</button>
                </div>
            </div>
            <div className="pdf-canvas-container">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default PdfViewer;