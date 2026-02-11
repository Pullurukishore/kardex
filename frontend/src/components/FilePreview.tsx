'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileIcon, FileText, FileImage, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api/axios';
import * as XLSX from 'xlsx';

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    id?: string;
    filename: string;
    mimeType: string;
    localFile?: File;
  } | null;
}

const FilePreview: React.FC<FilePreviewProps> = ({ isOpen, onClose, file }) => {
  const { accessToken } = useAuth();
  const [fileUrl, setFileUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  
  // Excel states
  const [excelData, setExcelData] = React.useState<any[][]>([]);
  const [sheets, setSheets] = React.useState<string[]>([]);
  const [activeSheet, setActiveSheet] = React.useState(0);
  const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
  
  const baseURL = process.env.NEXT_PUBLIC_API_URL || '';
  
  const isExcel = (file?.mimeType.includes('sheet') || file?.mimeType.includes('excel')) ?? false;

  React.useEffect(() => {
    let currentUrl = '';
    
    const loadFile = async () => {
      if (!file) {
        setFileUrl('');
        setExcelData([]);
        setSheets([]);
        setWorkbook(null);
        return;
      }

      if (file.localFile) {
        currentUrl = URL.createObjectURL(file.localFile);
        setFileUrl(currentUrl);

        if (isExcel) {
          try {
            setLoading(true);
            const data = await file.localFile.arrayBuffer();
            const wb = XLSX.read(data);
            setWorkbook(wb);
            setSheets(wb.SheetNames);
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
            setExcelData(jsonData);
          } catch (e) {
            setExcelData([]);
          } finally {
            setLoading(false);
          }
        }
      } else if (file.id) {
        try {
          setLoading(true);
          // Fetch the file content as a blob using the authenticated API client
          const response = await api.get(`/ar/bank-accounts/attachments/${file.id}/download`, {
            params: { inline: 'true' },
            responseType: isExcel ? 'arraybuffer' : 'blob'
          });
          
          if (isExcel) {
            const wb = XLSX.read(response.data);
            setWorkbook(wb);
            setSheets(wb.SheetNames);
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
            setExcelData(jsonData);
          } else {
            const blob = new Blob([response.data], { type: file.mimeType });
            currentUrl = URL.createObjectURL(blob);
            setFileUrl(currentUrl);
          }
        } catch (error) {
          setFileUrl('');
          setExcelData([]);
        } finally {
          setLoading(false);
        }
      }
    };

    if (isOpen) {
      loadFile();
    }

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [file, isOpen, isExcel]);

  const changeSheet = (index: number) => {
    if (!workbook) return;
    setActiveSheet(index);
    const sheetName = workbook.SheetNames[index];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    setExcelData(jsonData);
  };

  const isImage = file?.mimeType.startsWith('image/') ?? false;
  const isPDF = file?.mimeType.includes('pdf') ?? false;
  const isZip = (file?.mimeType.includes('zip') || file?.mimeType.includes('compressed')) ?? false;

  const handleDownload = () => {
    if (!file) return;
    if (file.localFile) {
      const url = URL.createObjectURL(file.localFile);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } else if (file.id) {
      window.open(`${baseURL}/ar/bank-accounts/attachments/${file.id}/download`, '_blank');
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] flex flex-col p-0 overflow-hidden border-0 bg-[#F8FAFB] rounded-[2rem] shadow-2xl">
        <DialogHeader className="bg-white border-b border-[#AEBFC3]/20 px-6 py-4 flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-4">
             <div className={`p-2.5 rounded-xl ${isPDF ? 'bg-red-50 text-red-500' : isImage ? 'bg-blue-50 text-blue-500' : isExcel ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {isImage && <FileImage className="w-5 h-5" />}
                {isPDF && <FileText className="w-5 h-5" />}
                {isExcel && <FileSpreadsheet className="w-5 h-5" />}
                {!isImage && !isPDF && !isExcel && <FileIcon className="w-5 h-5" />}
             </div>
             <div className="flex flex-col">
               <DialogTitle className="text-[#1A3352] font-bold truncate max-w-[35vw] text-lg leading-tight">
                 {file.filename}
               </DialogTitle>
               <p className="text-[#92A2A5] text-[10px] font-bold uppercase tracking-[0.1em]">
                 {file.mimeType.split('/')[1] || 'File'} Document
               </p>
             </div>
          </div>
          <div className="flex items-center gap-3 pr-12">
            {!file.localFile && (
              <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  className="hidden sm:flex border-[#AEBFC3]/50 text-[#546A7A] hover:bg-[#F8FAFB] h-10 px-4 rounded-xl font-bold gap-2 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {isExcel && sheets.length > 1 && (
          <div className="bg-white border-b border-[#AEBFC3]/10 px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {sheets.map((sheet, idx) => (
              <button
                key={idx}
                onClick={() => changeSheet(idx)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeSheet === idx 
                    ? 'bg-[#82A094] text-white shadow-md shadow-[#82A094]/20' 
                    : 'text-[#546A7A] hover:bg-[#F8FAFB]'
                }`}
              >
                {sheet}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#CE9F6B]/10 border-t-[#CE9F6B] rounded-full animate-spin" />
                <Loader2 className="w-6 h-6 text-[#CE9F6B] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-[#546A7A] font-bold tracking-widest text-xs uppercase">Fetching Preview...</p>
            </div>
          ) : (isExcel && excelData.length > 0) ? (
            <div className="w-full h-full bg-white rounded-xl border border-[#AEBFC3]/30 shadow-2xl overflow-auto relative">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-[#F8FAFB] z-10">
                  <tr>
                    <th className="w-10 border-b border-r border-[#AEBFC3]/20 bg-[#AEBFC3]/10" />
                    {excelData[0]?.map((_, idx) => (
                      <th key={idx} className="px-4 py-2 border-b border-r border-[#AEBFC3]/20 text-[#546A7A] font-bold text-xs">
                        {String.fromCharCode(65 + idx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelData.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-[#F8FAFB]">
                      <td className="sticky left-0 bg-[#F8FAFB] border-r border-b border-[#AEBFC3]/20 text-center text-[10px] font-bold text-[#92A2A5] w-10">
                        {rowIdx + 1}
                      </td>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2 border-b border-r border-[#AEBFC3]/10 text-[#1A3352] whitespace-nowrap min-w-[120px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelData.length === 0 && (
                <div className="flex items-center justify-center h-full text-[#92A2A5] italic">
                  This sheet appears to be empty
                </div>
              )}
            </div>
          ) : (!isZip && isImage && fileUrl) ? (
            <div className="w-full h-full flex items-center justify-center relative">
              <img 
                src={fileUrl} 
                alt={file.filename} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl ring-1 ring-black/5" 
              />
            </div>
          ) : (!isZip && fileUrl) ? (
            <div className="w-full h-full">
              <iframe 
                src={isPDF ? `${fileUrl}#view=FitH&toolbar=0` : fileUrl} 
                className="w-full h-full rounded-xl border border-[#AEBFC3]/30 shadow-2xl bg-white"
                title={file.filename}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 p-12 bg-white rounded-[2.5rem] shadow-xl border border-[#AEBFC3]/10 max-w-xl w-full mx-4">
              <div className="w-32 h-32 bg-[#F8FAFB] rounded-[2rem] flex items-center justify-center border-2 border-dashed border-[#AEBFC3]/30 relative">
                 {isExcel ? (
                    <FileSpreadsheet className="w-16 h-16 text-[#82A094]" />
                 ) : isZip ? (
                    <FileIcon className="w-16 h-16 text-[#E17F70]" />
                 ) : (
                    <FileIcon className="w-16 h-16 text-[#CE9F6B]" />
                 )}
                 <div className="absolute -bottom-1 -right-1 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-[#AEBFC3]/10">
                    <FileIcon className="w-6 h-6 text-[#92A2A5]" />
                 </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-[#1A3352] mb-3">{file.filename}</h3>
                <p className="text-[#546A7A] mb-10 font-medium leading-relaxed max-w-sm mx-auto opacity-80">
                  {isZip ? "ZIP archives are restricted. Please download the file to examine its contents." : 
                   !fileUrl && file.id ? "We couldn't load the preview. Please try again or download the file." : 
                   "This file type requires external software. Please download to view."}
                </p>
                {!file.localFile && (
                  <Button 
                    onClick={handleDownload} 
                    className="bg-[#CE9F6B] hover:bg-[#B88D5A] text-white px-12 h-16 rounded-[1.1rem] shadow-xl shadow-[#CE9F6B]/20 transition-all font-black text-lg"
                  >
                    <Download className="w-6 h-6 mr-3" />
                    Download to View
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
