import { useState } from 'react';
import { FileSources, FileContext } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import { 
  OGDialog, 
  OGDialogContent, 
  OGDialogHeader, 
  OGDialogTitle,
  Button,
  Spinner,
} from '@librechat/client';
import { useGetFiles } from '~/data-provider';
import { DataTable, columns } from './Table';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ExistingFilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: TFile[]) => void;
  isProcessing?: boolean;
}

export default function ExistingFilePickerDialog({ 
  open, 
  onOpenChange,
  onFilesSelected,
  isProcessing = false,
}: ExistingFilePickerDialogProps) {
  const localize = useLocalize();
  const [selectedFiles, setSelectedFiles] = useState<TFile[]>([]);

  const { data: files = [], isLoading } = useGetFiles<TFile[]>({
    select: (files) =>
      files.map((file) => {
        file.context = file.context ?? FileContext.unknown;
        file.filterSource = file.source === FileSources.firebase ? FileSources.local : file.source;
        return file;
      }),
  });

  const handleConfirm = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    onOpenChange(false);
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        title={localize('com_ui_select_files') || 'Select Files from My Files'}
        className="w-11/12 max-w-5xl bg-background text-text-primary shadow-2xl"
      >
        <OGDialogHeader>
          <OGDialogTitle>
            {localize('com_ui_select_files') || 'Select Files from My Files'}
          </OGDialogTitle>
        </OGDialogHeader>
        
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-text-secondary">
              {localize('com_ui_no_files') || 'No files available. Upload some files first.'}
            </div>
          ) : (
            <>
              <DataTable 
                columns={columns} 
                data={files}
                onSelectionChange={setSelectedFiles}
              />
              
              <div className="flex items-center justify-between border-t border-border-light pt-4">
                <div className="text-sm text-text-secondary">
                  {selectedFiles.length > 0 
                    ? `${selectedFiles.length} file(s) selected`
                    : localize('com_ui_select_files_hint') || 'Select files to attach to conversation'
                  }
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isProcessing}
                  >
                    {localize('com_ui_cancel') || 'Cancel'}
                  </Button>
                  
                  <Button
                    onClick={handleConfirm}
                    disabled={selectedFiles.length === 0 || isProcessing}
                    className={cn(
                      'min-w-[100px]',
                      selectedFiles.length > 0 && 'bg-green-600 hover:bg-green-700'
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Spinner className="mr-2 size-4" />
                        {localize('com_ui_attaching') || 'Attaching...'}
                      </>
                    ) : (
                      `${localize('com_ui_attach')} ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
