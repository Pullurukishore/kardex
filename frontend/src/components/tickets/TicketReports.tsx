"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  Upload, 
  FileText, 
  Image, 
  Download, 
  Trash2, 
  Eye,
  File,
  X,
  FileImage,
  FileVideo,
  FileArchive,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';
import axios from 'axios';

interface TicketReport {
  id: string | number; // Backend returns number, but we accept both
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

interface TicketReportsProps {
  ticketId: string;
}

export function TicketReports({ ticketId }: TicketReportsProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<TicketReport[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
  };

  // Helper function for authenticated blob downloads
  const downloadBlob = async (url: string) => {
    const token = getAuthToken();
    const response = await axios.get(url, {
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003/api',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      responseType: 'blob',
      withCredentials: true,
    });
    return response;
  };

  const fetchReports = async () => {
    try {
      const response = await apiClient.get(`/tickets/${ticketId}/reports`);
      // apiClient.get() already returns response.data, so response itself is the array
      const reportsData = Array.isArray(response) ? response : [];
      setReports(reportsData);
      } catch (error) {
      }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed'
      ];

      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 10MB limit`,
          variant: 'destructive',
        });
        return false;
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not supported`,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    });

    setSelectedFiles(validFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await apiClient.post(`/tickets/${ticketId}/reports`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(progress);
        },
      });

      toast({
        title: 'Success',
        description: `${selectedFiles.length} file(s) uploaded successfully`,
      });

      setIsUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadProgress(0);
      fetchReports();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (reportId: string, fileName: string) => {
    try {
      const response = await downloadBlob(`/tickets/${ticketId}/reports/${reportId}/download`);
      
      // Check if we have valid blob data
      if (!response.data || response.data.size === 0) {
        toast({
          title: 'View failed',
          description: 'Report file is empty or not found',
          variant: 'destructive',
        });
        return;
      }
      
      // Create blob URL for viewing with proper MIME type from headers
      const contentTypeHeader = response.headers['content-type'];
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new tab for viewing
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        toast({
          title: 'Popup blocked',
          description: 'Please allow popups to view the report',
          variant: 'destructive',
        });
        window.URL.revokeObjectURL(url);
        return;
      }
      
      // Clean up the URL after a delay to allow the browser to load it
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000); // Increased timeout to ensure file loads
    } catch (error) {
      toast({
        title: 'View failed',
        description: 'Failed to view report',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (reportId: string, fileName: string) => {
    try {
      const response = await downloadBlob(`/tickets/${ticketId}/reports/${reportId}/download`);
      
      // Check if we have valid blob data
      if (!response.data || response.data.size === 0) {
        toast({
          title: 'Download failed',
          description: 'Report file is empty or not found',
          variant: 'destructive',
        });
        return;
      }
      
      // Create download link with proper content type
      const contentTypeHeader = response.headers['content-type'];
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Report downloaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download report',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await apiClient.delete(`/tickets/${ticketId}/reports/${reportId}`);
      toast({
        title: 'Success',
        description: 'Report deleted successfully',
      });
      fetchReports();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete report',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-8 w-8 text-[#6F8A9D]" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-8 w-8 text-[#E17F70]" />;
    } else if (fileType.includes('word')) {
      return <File className="h-8 w-8 text-[#546A7A]" />;
    } else if (fileType.includes('excel') || fileType.includes('sheet')) {
      return <File className="h-8 w-8 text-[#4F6A64]" />;
    } else if (fileType.includes('zip') || fileType.includes('rar')) {
      return <FileArchive className="h-8 w-8 text-[#CE9F6B]" />;
    } else {
      return <File className="h-8 w-8 text-[#AEBFC3]0" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchReports();
  }, [ticketId]); // Refetch when ticketId changes

  // Debug: Log current reports state
  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-[#92A2A5] rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-[#979796] mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Reports</h3>
            <p className="text-[#5D6E73] mb-4">
              Upload PDFs, images, documents, or other files related to this ticket
            </p>
            <p className="text-sm text-[#AEBFC3]0 mb-4">
              Supported formats: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, TXT, ZIP (Max 10MB each)
            </p>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Reports</DialogTitle>
                  <DialogDescription>
                    Select files to upload for this ticket
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                      className="cursor-pointer"
                    />
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Selected Files:</h4>
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.type)}
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-[#AEBFC3]0">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Uploading...</span>
                        <span className="text-sm">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="w-full" />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {reports.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Reports Yet</p>
            <p className="text-sm">Upload reports using the section above or add them when changing ticket status to CLOSED_PENDING</p>
          </CardContent>
        </Card>
      )}
      
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Uploaded Reports ({reports.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReports}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      {getFileIcon(report.fileType)}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(String(report.id), report.fileName)}
                          title="View report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(String(report.id), report.fileName)}
                          title="Download report"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(String(report.id))}
                          title="Delete report"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1 truncate" title={report.fileName}>
                      {report.fileName}
                    </h4>
                    
                    <div className="space-y-1 text-xs text-[#AEBFC3]0">
                      <p>{formatFileSize(report.fileSize)}</p>
                      <p>Uploaded by {report.uploadedBy}</p>
                      <p>{formatDate(report.uploadedAt)}</p>
                    </div>
                    
                    <div className="mt-3">
                      <Badge variant="outline" className="text-xs">
                        {report.fileType.split('/')[1]?.toUpperCase() || report.fileType}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
