'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Upload, 
  FileCheck, 
  RefreshCw, 
  Download, 
  Table 
} from 'lucide-react'

interface SparePartsImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadTemplate: () => Promise<void>;
  onPreview: (file: File) => Promise<any>;
  onExecute: (file: File) => Promise<any>;
}

export default function SparePartsImportModal({
  open,
  onOpenChange,
  onDownloadTemplate,
  onPreview,
  onExecute
}: SparePartsImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreviewData(null)
      setResult(null)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setPreviewing(true)
    try {
      const data = await onPreview(file)
      setPreviewData(data)
    } finally {
      setPreviewing(false)
    }
  }

  const handleExecute = async () => {
    if (!file) return
    setImporting(true)
    try {
      const res = await onExecute(file)
      setResult(res)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white rounded-3xl overflow-hidden p-0 border-0 shadow-2xl">
        <DialogHeader className="bg-slate-50 p-8 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <Upload className="w-6 h-6 text-[#6F8A9D]" />
            Bulk Import Parts
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Import multiple spare parts from an Excel or CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          {!result ? (
            <>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Table className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-blue-800">Need the template?</p>
                      <p className="text-xs text-blue-600">Download the formatted Excel file.</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={onDownloadTemplate} className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100 h-10 px-4 rounded-xl font-bold">
                    <Download className="w-4 h-4 mr-2" /> Template
                  </Button>
                </div>

                <div className={`relative border-2 border-dashed rounded-3xl p-10 transition-all ${file ? 'bg-green-50/30 border-green-200' : 'bg-slate-50 border-slate-200 hover:border-[#6F8A9D]/50'}`}>
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    accept=".xlsx,.xls,.csv"
                  />
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className={`p-4 rounded-2xl mb-4 ${file ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                      {file ? <FileCheck className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${file ? 'text-green-800' : 'text-slate-700'}`}>
                        {file ? file.name : 'Click or Drag to Upload'}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">Excel or CSV files only</p>
                    </div>
                  </div>
                </div>
              </div>

              {previewData && (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Table className="w-4 h-4" /> Import Preview
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Total Rows</p>
                      <p className="text-xl font-black text-slate-700">{previewData.totalRows || 0}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Valid Rows</p>
                      <p className="text-xl font-black text-green-600">{previewData.validRows || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 space-y-4">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FileCheck className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">Import Successful!</h3>
              <p className="text-slate-500">Successfully imported {result.importedCount} spare parts.</p>
              <Button onClick={() => onOpenChange(false)} className="bg-slate-800 h-12 px-10 rounded-xl mt-6">Close</Button>
            </div>
          )}
        </div>

        {!result && (
          <DialogFooter className="bg-slate-50 p-8 pt-0 gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-12 flex-1">Cancel</Button>
            {previewData ? (
              <Button onClick={handleExecute} disabled={importing} className="rounded-xl h-12 flex-1 bg-green-600 hover:bg-green-700 shadow-lg text-white font-bold">
                {importing ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Execute Import'}
              </Button>
            ) : (
              <Button onClick={handlePreview} disabled={!file || previewing} className="rounded-xl h-12 flex-1 bg-[#6F8A9D] hover:bg-[#546A7A] shadow-lg text-white font-bold">
                {previewing ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Analyze File'}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
