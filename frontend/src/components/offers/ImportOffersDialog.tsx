'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileUp, Loader2, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';

interface ImportOffersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export default function ImportOffersDialog({
    open,
    onOpenChange,
    onSuccess
}: ImportOffersDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [result, setResult] = useState<any>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreview(null);
            setResult(null);

            setPreviewing(true);
            try {
                const previewData = await apiService.previewOfferImport(selectedFile);
                setPreview(previewData);
            } catch (error: any) {
                console.error('Preview failed:', error);
                const errMsg = error?.response?.data?.error || error?.response?.data?.details || 'Failed to parse Excel file';
                toast.error(errMsg);
            } finally {
                setPreviewing(false);
            }
        }
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setImporting(true);
        setResult(null);
        try {
            const response = await apiService.importOffers(file);
            setResult(response);
            toast.success('Import completed successfully');
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error(error.response?.data?.error || 'Failed to import offers');
        } finally {
            setImporting(false);
        }
    };

    const resetDialog = () => {
        setFile(null);
        setPreview(null);
        setPreviewing(false);
        setResult(null);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetDialog();
            onOpenChange(val);
        }}>
            <DialogContent className="p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden max-w-3xl w-full max-h-[85vh] flex flex-col">
                <div className="bg-gradient-to-r from-[#9E3B47] to-[#75242D] p-6 relative shrink-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-white text-xl">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <FileUp className="h-6 w-6 text-white" />
                            </div>
                            Import Offers from Excel
                        </DialogTitle>
                        <DialogDescription className="text-white/80 mt-2 text-base">
                            Upload your Excel file with zonewise open/closed offer funnel
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6 bg-white overflow-y-auto flex-1">
                    {!result ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="file" className="font-medium text-sm text-[#546A7A]">
                                    Select Excel File (.xlsx, .xls)
                                </Label>
                                <div
                                    className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                    ${file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-[#9E3B47] hover:bg-slate-50'}
                  `}
                                    onClick={() => document.getElementById('file-input')?.click()}
                                >
                                    <Input
                                        id="file-input"
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileChange}
                                        disabled={importing}
                                        className="hidden"
                                    />
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                            </div>
                                            <p className="text-sm font-semibold text-green-700">{file.name}</p>
                                            <p className="text-xs text-green-500">{(file.size / 1024).toFixed(1)} KB</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFile(null);
                                                }}
                                            >
                                                <X className="h-4 w-4 mr-1" /> Remove
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <FileUp className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-600">Click to upload or drag and drop</p>
                                            <p className="text-xs text-slate-400">Excel files (.xlsx, .xls) only</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> Import Guidelines:
                                </p>
                                <ul className="text-xs text-amber-700 list-disc list-inside space-y-1 ml-1">
                                    <li>Sheet names must match service person names in the system.</li>
                                    <li>Columns required: "SL", "Company", "Location", "Offer Ref", "Offer Value".</li>
                                    <li>Offer Reference Number is mandatory and used for uniqueness.</li>
                                    <li>Multi-line items with same Offer Ref will be combined.</li>
                                </ul>
                            </div>

                            {preview && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-[#546A7A]">File Preview</p>
                                        <Badge variant="outline" className="text-[10px] font-black uppercase text-[#9E3B47] border-[#9E3B47]/20">
                                            {preview.totalRows} Rows Found
                                        </Badge>
                                    </div>

                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {preview.sheets.map((sheet: any, idx: number) => (
                                            <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-700">{sheet.sheetName}</span>
                                                        {sheet.isMatchedUser ? (
                                                            <Badge className="text-[8px] h-4 py-0 leading-none bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                                                                ✓ {sheet.matchedUserName || 'Matched'}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[8px] h-4 py-0 leading-none text-amber-600 border-amber-300 bg-amber-50">
                                                                Will Skip — No User Match
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">{sheet.totalInSheet} offers</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {sheet.offers.map((offer: any, oIdx: number) => (
                                                        <div key={oIdx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700 truncate max-w-[150px]">{offer.company}</span>
                                                                <span className="text-slate-400 font-medium">{offer.offerRef}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-black text-[#546A7A]">₹{(Number(offer.value) || 0).toLocaleString()}</span>
                                                                {offer.isUpdate ? (
                                                                    <span className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">Update</span>
                                                                ) : (
                                                                    <span className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">New</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {sheet.totalInSheet > 10 && (
                                                        <p className="text-[10px] text-center text-slate-400 mt-1 italic">+{sheet.totalInSheet - 10} more in this sheet...</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {previewing && (
                                <div className="flex flex-col items-center justify-center p-8 space-y-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                    <Loader2 className="h-8 w-8 text-[#9E3B47] animate-spin" />
                                    <p className="text-sm font-bold text-[#546A7A]">Analyzing File...</p>
                                    <p className="text-xs text-slate-400">Comparing with existing records</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-green-800">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                                <div>
                                    <div className="font-bold">Import Finished</div>
                                    <div className="text-xs">Successfully processed {result.totalRead} rows.</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Read</p>
                                    <p className="text-2xl font-black text-slate-700">{result.totalRead}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex flex-col items-center text-center">
                                    <p className="text-[10px] text-green-500 uppercase font-black tracking-widest">Imported</p>
                                    <p className="text-2xl font-black text-green-700">{result.imported}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                                    <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest">Updated</p>
                                    <p className="text-2xl font-black text-blue-700">{result.updated}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex flex-col items-center text-center">
                                    <p className="text-[10px] text-red-500 uppercase font-black tracking-widest">Errors</p>
                                    <p className="text-2xl font-black text-red-700">{result.errors}</p>
                                </div>
                            </div>

                            {result.details && result.details.length > 0 && (
                                <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-[#546A7A] text-white">
                                            <tr>
                                                <th className="p-2.5 font-bold">Sheet/User</th>
                                                <th className="p-2.5 font-bold text-center">Read</th>
                                                <th className="p-2.5 font-bold text-center text-green-100">New</th>
                                                <th className="p-2.5 font-bold text-center text-blue-100">Upd</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {result.details.map((d: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-2.5 font-medium text-slate-700">{d.sheetName}</td>
                                                    <td className="p-2.5 text-center text-slate-500">{d.read}</td>
                                                    <td className="p-2.5 text-center font-bold text-green-600 bg-green-50/30">{d.imported}</td>
                                                    <td className="p-2.5 text-center font-bold text-blue-600 bg-blue-50/30">{d.updated}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-5 bg-slate-100/50 border-t gap-3 shrink-0">
                    {result ? (
                        <Button
                            className="w-full h-12 rounded-xl bg-[#546A7A] hover:bg-[#455764] shadow-md"
                            onClick={() => {
                                resetDialog();
                                onOpenChange(false);
                            }}
                        >
                            Done
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={importing}
                                className="flex-1 h-12 rounded-xl border-2 hover:bg-slate-100"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={importing || !file}
                                className={`
                  flex-1 h-12 rounded-xl shadow-lg transition-all duration-300
                  ${!file ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] hover:scale-[1.02] active:scale-[0.98]'}
                `}
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FileUp className="mr-2 h-4 w-4" />
                                        Start Import
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
