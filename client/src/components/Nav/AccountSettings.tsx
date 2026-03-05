import React, { useState, useMemo, useCallback, memo } from 'react';
import { useRecoilState } from 'recoil';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as Select from '@ariakit/react/select';
import { FileText, LogOut, HardDrive, HelpCircle, KeyRound, LogIn } from 'lucide-react';
import {
  Constants,
  QueryKeys,
  MutationKeys,
  PermissionTypes,
  Permissions,
  dataService,
} from 'librechat-data-provider';
import type { TUpdateUserPlugins } from 'librechat-data-provider';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar, useToastContext } from '@librechat/client';
import {
  useGetStartupConfig,
  useGetUserBalance,
  useGetUserStorageUsage,
} from '~/data-provider';
import StorageLimitDialog from '~/components/Files/StorageLimitDialog';
import FilesView from '~/components/Chat/Input/Files/FilesView';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize, useHasAccess } from '~/hooks';
import Settings from './Settings';
import SupportModal from './SupportModal';
import store from '~/store';

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

function AccountSettings() {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const storageQuery = useGetUserStorageUsage({
    enabled: !!isAuthenticated,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useRecoilState(store.showFiles);
  const [showSupport, setShowSupport] = useRecoilState(store.showSupport);
  const [storageLimitDialog, setStorageLimitDialog] = useRecoilState(store.showStorageLimitDialog);
  const [showFileroLogin, setShowFileroLogin] = useRecoilState(store.showFileroLogin);
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();

  // Fetch FILERO auth status directly from the backend — NO dependency on MCP tools loading.
  // The backend discovers FILERO servers itself and returns { authenticated, servers: { name: bool } }.
  // enabled: only need isAuthenticated; no waiting for MCP tools.
  const { data: fileroAuthStatus } = useQuery(
    [QueryKeys.fileroAuthStatus],
    () => dataService.getFileroAuthStatus(),
    {
      enabled: !!isAuthenticated,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      staleTime: 30 * 1000,
    },
  );

  // Derive FILERO server names and auth state from the status response
  const allFileroServers = useMemo(
    () => Object.keys(fileroAuthStatus?.servers ?? {}),
    [fileroAuthStatus],
  );
  const hasFileroServers = allFileroServers.length > 0;
  const fileroAuthenticated = fileroAuthStatus?.authenticated ?? false;

  const updatePluginsMutation = useMutation(
    (payload: TUpdateUserPlugins) => dataService.updateUserPlugins(payload),
    { mutationKey: [MutationKeys.updatePreset] },
  );

  const handleFileroLogout = useCallback(async () => {
    try {
      // Delete credentials for ALL FILERO servers
      const deletePromises = allFileroServers.map((serverName) =>
        updatePluginsMutation.mutateAsync({
          pluginKey: `${Constants.mcp_prefix}${serverName}`,
          action: 'uninstall',
          auth: {},
        }),
      );
      await Promise.all(deletePromises);

      // Invalidate caches — useQuery will auto-refetch
      queryClient.invalidateQueries([QueryKeys.fileroAuthStatus]);
      queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
      queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);

      showToast({ message: 'FILERO-Abmeldung erfolgreich.', status: 'success' });
    } catch (err) {
      showToast({ message: 'Fehler bei der FILERO-Abmeldung.', status: 'error' });
    }
  }, [allFileroServers, updatePluginsMutation, queryClient, showToast]);

  const hasHelpFaqAccess = useHasAccess({
    permissionType: PermissionTypes.HELP_FAQ,
    permission: Permissions.USE,
  });

  const hasFileManagerAccess = useHasAccess({
    permissionType: PermissionTypes.FILE_UPLOAD,
    permission: Permissions.USE,
  });

  return (
    <Select.SelectProvider>
      <Select.Select
        aria-label={localize('com_nav_account_settings')}
        data-testid="nav-user"
        className="mt-text-sm flex h-auto w-full items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out hover:bg-surface-hover"
      >
        <div className="-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0">
          <div className="relative flex">
            <Avatar user={user} size={32} />
          </div>
        </div>
        <div
          className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
          style={{ marginTop: '0', marginLeft: '0' }}
        >
          {user?.name ?? user?.username ?? localize('com_nav_user')}
        </div>
      </Select.Select>
      <Select.SelectPopover
        className="popover-ui w-[235px]"
        style={{
          transformOrigin: 'bottom',
          marginRight: '0px',
          translate: '0px',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user?.email ?? localize('com_nav_user')}
        </div>
        <DropdownMenuSeparator />
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
              {localize('com_nav_balance')}:{' '}
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {storageQuery.data != null && (
          <>
            <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span>{localize('com_nav_storage')}:</span>
              </div>
              <div className="mt-1 text-xs">
                {formatBytes(storageQuery.data.used)} / {formatBytes(storageQuery.data.limit)}{' '}
                <span className={storageQuery.data.percentage >= 90 ? 'text-red-500' : ''}>
                  ({storageQuery.data.percentage}%)
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    storageQuery.data.percentage >= 90
                      ? 'bg-red-500'
                      : storageQuery.data.percentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(storageQuery.data.percentage, 100)}%` }}
                />
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {hasFileManagerAccess && (
        <Select.SelectItem
          value=""
          onClick={() => setShowFiles(true)}
          className="select-item text-sm"
        >
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Select.SelectItem>
        )}
        {startupConfig?.helpAndFaqURL !== '/' && hasHelpFaqAccess && (
          <Select.SelectItem
            value=""
            onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
            className="select-item text-sm"
          >
            <LinkIcon aria-hidden="true" />
            {localize('com_nav_help_faq')}
          </Select.SelectItem>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowSupport(true)}
          className="select-item text-sm"
        >
          <HelpCircle className="icon-md" aria-hidden="true" />
          {localize('com_nav_support')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowSettings(true)}
          className="select-item text-sm"
        >
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Select.SelectItem>
        {hasFileroServers && fileroAuthenticated && (
          <Select.SelectItem
            value=""
            onClick={handleFileroLogout}
            className="select-item text-sm"
          >
            <KeyRound className="icon-md" aria-hidden="true" />
            FILERO Abmelden
          </Select.SelectItem>
        )}
        {hasFileroServers && !fileroAuthenticated && (
          <Select.SelectItem
            value=""
            onClick={() => setShowFileroLogin(true)}
            className="select-item text-sm"
          >
            <LogIn className="icon-md" aria-hidden="true" />
            FILERO Anmelden
          </Select.SelectItem>
        )}
        <DropdownMenuSeparator />
        <Select.SelectItem
          aria-selected={true}
          onClick={() => logout()}
          value="logout"
          className="select-item text-sm"
        >
          <LogOut className="icon-md" />
          {localize('com_nav_log_out')}
        </Select.SelectItem>
      </Select.SelectPopover>
      {showFiles && <FilesView open={showFiles} onOpenChange={setShowFiles} />}
      {showSupport && <SupportModal open={showSupport} onOpenChange={setShowSupport} />}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
      <StorageLimitDialog
        open={storageLimitDialog.open}
        onOpenChange={(open) => setStorageLimitDialog({ ...storageLimitDialog, open })}
        used={storageLimitDialog.used}
        limit={storageLimitDialog.limit}
      />
    </Select.SelectProvider>
  );
}

export default memo(AccountSettings);
