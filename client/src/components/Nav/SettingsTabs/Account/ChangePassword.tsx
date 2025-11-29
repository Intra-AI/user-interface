import { Lock } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import {
  Input,
  Button,
  OGDialog,
  useToastContext,
  OGDialogContent,
  OGDialogTrigger,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { useChangePasswordMutation } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';

const ChangePassword = ({ disabled = false }: { disabled?: boolean }) => {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { mutate: changePassword, isLoading } = useChangePasswordMutation({
    onSuccess: (data) => {
      showToast({
        message: data.message || localize('com_auth_password_changed_success'),
        status: 'success',
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || localize('com_auth_password_change_error');
      showToast({
        message,
        status: 'error',
      });
    },
  });

  const resetForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: { [key: string]: string } = {};
    
    if (!currentPassword) {
      newErrors.currentPassword = localize('com_auth_password_required');
    }
    
    if (!newPassword) {
      newErrors.newPassword = localize('com_auth_password_required');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = localize('com_auth_password_min_length');
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = localize('com_auth_password_required');
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = localize('com_auth_password_mismatch');
    }

    if (currentPassword === newPassword && newPassword) {
      newErrors.newPassword = localize('com_auth_password_must_differ');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPassword, newPassword, confirmPassword, localize]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!validateForm()) {
        return;
      }

      changePassword({
        currentPassword,
        newPassword,
      });
    },
    [currentPassword, newPassword, validateForm, changePassword],
  );

  const handleDialogChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  }, [resetForm]);

  // Only show for local auth users
  if (user?.provider !== 'local') {
    return null;
  }

  return (
    <OGDialog open={isDialogOpen} onOpenChange={handleDialogChange}>
      <div className="flex items-center justify-between">
        <span>{localize('com_auth_change_password')}</span>
        <OGDialogTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center justify-center rounded-lg transition-colors duration-200"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
          >
            {localize('com_auth_change_password')}
          </Button>
        </OGDialogTrigger>
      </div>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle className="text-lg font-medium leading-6">
            {localize('com_auth_change_password')}
          </OGDialogTitle>
        </OGDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-black dark:text-white"
                htmlFor="current-password"
              >
                {localize('com_auth_current_password')}
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={localize('com_auth_current_password')}
                disabled={isLoading}
                className={errors.currentPassword ? 'border-red-500' : ''}
              />
              {errors.currentPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.currentPassword}</p>
              )}
            </div>

            <div>
              <label
                className="mb-1 block text-sm font-medium text-black dark:text-white"
                htmlFor="new-password"
              >
                {localize('com_auth_new_password')}
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={localize('com_auth_new_password')}
                disabled={isLoading}
                className={errors.newPassword ? 'border-red-500' : ''}
              />
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>
              )}
            </div>

            <div>
              <label
                className="mb-1 block text-sm font-medium text-black dark:text-white"
                htmlFor="confirm-password"
              >
                {localize('com_auth_confirm_password')}
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={localize('com_auth_confirm_password')}
                disabled={isLoading}
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={isLoading}
            >
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {localize('com_ui_saving')}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {localize('com_auth_change_password')}
                </>
              )}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
};

export default React.memo(ChangePassword);
