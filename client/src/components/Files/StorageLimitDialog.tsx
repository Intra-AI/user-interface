import { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { HardDrive, ExternalLink } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogFooter,
  Button,
} from '@librechat/client';
import { useDeleteOldFilesMutation } from '~/data-provider';
import type { TDeleteOldFilesBody } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import store from '~/store';

interface StorageLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  used?: number;
  limit?: number;
}

type OlderThanOption = TDeleteOldFilesBody['olderThan'];

const deleteOptions: { value: OlderThanOption; labelKey: string }[] = [
  { value: 'day', labelKey: 'com_nav_time_1_day' },
  { value: 'week', labelKey: 'com_nav_time_1_week' },
  { value: '4weeks', labelKey: 'com_nav_time_4_weeks' },
  { value: 'all', labelKey: 'com_nav_time_all' },
];

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function StorageLimitDialog({
  open,
  onOpenChange,
  used = 0,
  limit = 0,
}: StorageLimitDialogProps) {
  const localize = useLocalize();
  const setShowFiles = useSetRecoilState(store.showFiles);
  const [selectedOption, setSelectedOption] = useState<OlderThanOption>('week');
  const deleteOldFilesMutation = useDeleteOldFilesMutation({
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const handleGoToMyFiles = () => {
    onOpenChange(false);
    setShowFiles(true);
  };

  const handleDeleteOldFiles = () => {
    deleteOldFilesMutation.mutate({ olderThan: selectedOption });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-[450px] bg-background text-text-primary shadow-2xl">
        <OGDialogHeader>
          <OGDialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-red-500" />
            {localize('com_nav_storage_limit_reached')}
          </OGDialogTitle>
        </OGDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Storage usage info */}
          <div className="rounded-lg bg-surface-secondary p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>{localize('com_nav_storage_used')}</span>
              <span className="font-medium text-red-500">
                {formatBytes(used)} / {formatBytes(limit)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-text-secondary">
            {localize('com_nav_storage_limit_message')}
          </p>

          {/* Delete options dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {localize('com_nav_delete_files_older_than')}
            </label>
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value as OlderThanOption)}
              className="rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {deleteOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {localize(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <OGDialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGoToMyFiles}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            {localize('com_nav_go_to_my_files')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteOldFiles}
            disabled={deleteOldFilesMutation.isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteOldFilesMutation.isLoading
              ? localize('com_ui_deleting')
              : localize('com_nav_delete_old_files')}
          </Button>
        </OGDialogFooter>
      </OGDialogContent>
    </OGDialog>
  );
}
