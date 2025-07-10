'use client';

import { useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Set up the worker on the client-side
  // This part will be removed or modified in the next step
  // useEffect(() => {
  //   pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  // }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="flex items-center justify-between w-full p-2 bg-gray-100 border-b">
        <Button onClick={previousPage} disabled={pageNumber <= 1} variant="ghost">
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>
        <span>
          Page {pageNumber} of {numPages}
        </span>
        <Button onClick={nextPage} disabled={numPages ? pageNumber >= numPages : true} variant="ghost">
          Next
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-grow overflow-auto w-full flex justify-center">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          error={<div className="text-red-500">Error loading PDF file.</div>}
        >
          <Page pageNumber={pageNumber} />
        </Document>
      </div>
    </div>
  );
}