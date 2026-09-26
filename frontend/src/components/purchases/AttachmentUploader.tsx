'use client';

import React, { useState, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Paperclip, Upload, Download, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface AttachmentUploaderProps {
  purchaseId: string;
  hasAttachment: boolean;
  canUpload?: boolean;
  onUploadSuccess: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  purchaseId,
  hasAttachment,
  canUpload = false,
  onUploadSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploadSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate File Size (<= 5 MB)
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 5 MB limit (${formatFileSize(file.size)}).`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate MIME Type / Extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtValid = ALLOWED_EXTENSIONS.includes(fileExt);

    if (!isMimeValid && !isExtValid) {
      setError('Invalid file type. Only JPEG, PNG, and PDF files are allowed.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      await api.uploadPurchaseAttachment(purchaseId, selectedFile);
      setIsUploading(false);
      setUploadSuccess(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadSuccess();
    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Failed to upload attachment.');
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);

    try {
      await api.downloadPurchaseAttachment(purchaseId);
      setIsDownloading(false);
    } catch (err: any) {
      setIsDownloading(false);
      setError(err.message || 'Failed to download attachment.');
    }
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-forest-700" />
          <h4 className="text-sm font-semibold text-slate-800">Invoice Attachment</h4>
        </div>
        {hasAttachment && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            isLoading={isDownloading}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Download Invoice
          </Button>
        )}
      </div>

      {hasAttachment && !selectedFile && (
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Invoice proof is securely attached and verified in private storage.</span>
          </div>
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="hidden"
              id={`invoice-file-${purchaseId}`}
              disabled={isUploading}
            />
            <label
              htmlFor={`invoice-file-${purchaseId}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-forest-700/50 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-white cursor-pointer transition-all shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-forest-700" />
              <span>{hasAttachment ? 'Replace Invoice File' : 'Select Invoice File'}</span>
            </label>
            <span className="text-[11px] text-slate-500">
              Allowed: JPG, PNG, PDF (Max 5 MB)
            </span>
          </div>

          {selectedFile && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-4 h-4 text-forest-700 shrink-0" />
                <span className="font-medium text-slate-800 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-slate-500 font-mono text-[11px] shrink-0">
                  ({formatFileSize(selectedFile.size)})
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleUpload}
                isLoading={isUploading}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                Upload File
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Invoice uploaded successfully.</span>
        </div>
      )}
    </div>
  );
};
