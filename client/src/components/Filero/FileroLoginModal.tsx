import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  QueryKeys,
  MutationKeys,
  dataService,
} from 'librechat-data-provider';
import type { TUpdateUserPlugins } from 'librechat-data-provider';
import { OGDialog, DialogTemplate, useToastContext } from '@librechat/client';
import { useMCPToolsQuery } from '~/data-provider';

/**
 * FILERO Login Modal
 *
 * Shows a login dialog that collects FILERO credentials, validates them
 * against the FILERO API, and stores them encrypted per-user for all
 * MCP servers with isFilero: true.
 */
const FileroLoginModal = ({
  open,
  onOpenChange,
  onSuccess,
  onCancel,
  fileroServers: fileroServersProp,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
  /** List of MCP server names with isFilero: true that need credentials */
  fileroServers: string[];
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [instance, setInstance] = useState<'lwk' | 'ctra'>('lwk');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const { data: mcpToolsData } = useMCPToolsQuery();

  // ALWAYS discover ALL FILERO servers — FILERO is one instance,
  // credentials must be saved for every server with isFilero: true
  const fileroServers = useMemo(() => {
    if (!mcpToolsData?.servers) {
      // Fall back to prop if MCP data not loaded yet
      return fileroServersProp ?? [];
    }
    return Object.entries(mcpToolsData.servers)
      .filter(([, server]) => server?.isFilero)
      .map(([name]) => name);
  }, [mcpToolsData, fileroServersProp]);

  const updatePluginsMutation = useMutation(
    (payload: TUpdateUserPlugins) => dataService.updateUserPlugins(payload),
    {
      mutationKey: [MutationKeys.updatePreset],
    },
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!username.trim() || !password.trim()) {
        setError('Benutzername und Passwort sind erforderlich.');
        return;
      }

      setIsSubmitting(true);

      try {
        // Step 1: Validate credentials against FILERO
        const result = await dataService.validateFileroAuth({
          username: username.trim(),
          password,
          instance,
        });

        if (!result.success) {
          setError(result.message || 'Ungültige FILERO-Anmeldedaten.');
          setIsSubmitting(false);
          return;
        }

        // Step 2: Save credentials for ALL isFilero MCP servers
        const savePromises = fileroServers.map((serverName) =>
          updatePluginsMutation.mutateAsync({
            pluginKey: `${Constants.mcp_prefix}${serverName}`,
            action: 'install',
            auth: {
              FILERO_USERNAME: username.trim(),
              FILERO_PASSWORD: password,
              FILERO_INSTANCE: instance,
            },
          }),
        );

        await Promise.all(savePromises);

        // Step 3: Invalidate relevant queries
        queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
        queryClient.invalidateQueries([QueryKeys.mcpTools]);
        queryClient.invalidateQueries([QueryKeys.fileroAuthStatus]);
        queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);

        showToast({ message: 'FILERO-Anmeldung erfolgreich!', status: 'success' });

        // Reset form and close
        setUsername('');
        setPassword('');
        setInstance('lwk');
        setError(null);
        onSuccess();
        onOpenChange(false);
      } catch (err: unknown) {
        // Detect 401/403 from Axios response and show a user-friendly German message
        const axiosErr = err as { response?: { status?: number } };
        const status = axiosErr?.response?.status;
        if (status === 401 || status === 403) {
          setError('Falsche Anmeldedaten. Bitte überprüfen Sie Ihren Benutzernamen und Ihr Passwort.');
        } else if (status === 502) {
          setError('FILERO-Server ist nicht erreichbar. Bitte versuchen Sie es später erneut.');
        } else {
          setError('Fehler bei der FILERO-Anmeldung. Bitte versuchen Sie es erneut.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, password, instance, fileroServers, updatePluginsMutation, queryClient, showToast, onSuccess, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    setUsername('');
    setPassword('');
    setInstance('lwk');
    setError(null);
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        handleCancel();
        return;
      }
      onOpenChange(isOpen);
    },
    [handleCancel, onOpenChange],
  );

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange}>
      <DialogTemplate
        title="FILERO Anmeldung"
        className="w-11/12 max-w-md sm:w-3/4 md:w-1/2 lg:w-2/5"
        showCloseButton={false}
        showCancelButton={false}
        main={
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-secondary">
              Dieser Agent benötigt Zugriff auf FILERO. Bitte melden Sie sich mit
              Ihren FILERO-Zugangsdaten an.
            </p>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="filero-username" className="text-sm font-medium text-text-primary">
                FILERO Benutzername
              </label>
              <input
                type="text"
                id="filero-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="webkit-dark-styles w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-text-primary transition-colors duration-200 focus:border-green-500 focus:outline-none"
                placeholder="Benutzername"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="filero-password" className="text-sm font-medium text-text-primary">
                FILERO Passwort
              </label>
              <input
                type="password"
                id="filero-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="webkit-dark-styles w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-text-primary transition-colors duration-200 focus:border-green-500 focus:outline-none"
                placeholder="Passwort"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="filero-instance" className="text-sm font-medium text-text-primary">
                FILERO Instanz
              </label>
              <select
                id="filero-instance"
                value={instance}
                onChange={(e) => setInstance(e.target.value as 'lwk' | 'ctra')}
                className="webkit-dark-styles w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-text-primary transition-colors duration-200 focus:border-green-500 focus:outline-none"
                disabled={isSubmitting}
              >
                <option value="lwk">LWK</option>
                <option value="ctra">CONTISS</option>
              </select>
            </div>
          </form>
        }
        buttons={
          <>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-4 py-2 text-sm text-text-primary hover:bg-surface-active disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-4 py-2 text-sm text-text-primary hover:bg-green-500 hover:text-white focus:bg-green-500 focus:text-white disabled:opacity-50 dark:hover:bg-green-600 dark:focus:bg-green-600"
            >
              {isSubmitting ? 'Anmeldung...' : 'Anmelden'}
            </button>
          </>
        }
      />
    </OGDialog>
  );
};

export default FileroLoginModal;
