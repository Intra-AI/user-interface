import { useForm } from 'react-hook-form';
import { useState, ReactNode, useEffect } from 'react';
import { Spinner, Button } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import { useRequestPasswordResetMutation } from 'librechat-data-provider/react-query';
import type { TRequestPasswordReset, TRequestPasswordResetResponse } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import type { FC } from 'react';
import { useLocalize } from '~/hooks';

const BodyTextWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div
      className="relative mt-6 rounded-xl border border-green-500/20 bg-green-50/50 px-6 py-4 text-green-700 shadow-sm transition-all dark:bg-green-950/30 dark:text-green-100"
      role="alert"
    >
      {children}
    </div>
  );
};

const ResetPasswordBodyText = () => {
  const localize = useLocalize();
  return (
    <div className="flex flex-col space-y-4">
      <p>{localize('com_auth_reset_password_if_email_exists')}</p>
      <a
        className="inline-flex text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
        href="/login"
      >
        {localize('com_auth_back_to_login')}
      </a>
    </div>
  );
};

function RequestPasswordReset() {
  const localize = useLocalize();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TRequestPasswordReset>();
  const [bodyText, setBodyText] = useState<ReactNode | undefined>(undefined);
  const [showNotification, setShowNotification] = useState(false);
  const { startupConfig, setHeaderText } = useOutletContext<TLoginLayoutContext>();

  const requestPasswordReset = useRequestPasswordResetMutation();
  const { isLoading } = requestPasswordReset;

  // Check if user was redirected here for initial password reset
  useEffect(() => {
    const passwordResetRequired = sessionStorage.getItem('passwordResetRequired');
    const passwordResetEmail = sessionStorage.getItem('passwordResetEmail');
    
    if (passwordResetRequired === 'true' && passwordResetEmail) {
      setShowNotification(true);
      setValue('email', passwordResetEmail);
      // Clear session storage
      sessionStorage.removeItem('passwordResetRequired');
      sessionStorage.removeItem('passwordResetEmail');
    }
  }, [setValue]);

  const onSubmit = (data: TRequestPasswordReset) => {
    requestPasswordReset.mutate(data, {
      onSuccess: (data: TRequestPasswordResetResponse) => {
        if (data.link && !startupConfig?.emailEnabled) {
          setHeaderText('com_auth_reset_password');
          setBodyText(
            <span>
              {localize('com_auth_click')}{' '}
              <a className="text-green-500 hover:underline" href={data.link}>
                {localize('com_auth_here')}
              </a>{' '}
              {localize('com_auth_to_reset_your_password')}
            </span>,
          );
        } else {
          setHeaderText('com_auth_reset_password_link_sent');
          setBodyText(<ResetPasswordBodyText />);
        }
      },
      onError: () => {
        setHeaderText('com_auth_reset_password_link_sent');
        setBodyText(<ResetPasswordBodyText />);
      },
    });
  };

  if (bodyText) {
    return <BodyTextWrapper>{bodyText}</BodyTextWrapper>;
  }

  return (
    <>
      {showNotification && (
        <div className="mb-6 rounded-xl border border-orange-500/30 bg-orange-50/50 px-6 py-4 shadow-sm dark:bg-orange-950/30">
          <div className="flex items-start space-x-3">
            <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                {localize('com_ui_initial_password_reset_required') || 'Initiales Passwort zurücksetzen erforderlich'}
              </h3>
              <p className="mt-2 text-sm text-orange-800 dark:text-orange-200">
                {localize('com_ui_initial_password_reset_notification') || 'Aus Sicherheitsgründen müssen Sie Ihr Passwort zurücksetzen, bevor Sie auf Ihr Konto zugreifen können. Bitte fordern Sie unten einen Passwort-Reset-Link an.'}
              </p>
            </div>
          </div>
        </div>
      )}
      <form
        className="mt-8 space-y-6"
        aria-label="Password reset form"
        method="POST"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="space-y-2">
          <div className="relative">
            <input
              type="email"
              id="email"
              autoComplete="off"
              aria-label={localize('com_auth_email')}
              {...register('email', {
                required: localize('com_auth_email_required'),
                minLength: {
                  value: 3,
                  message: localize('com_auth_email_min_length'),
                },
                maxLength: {
                  value: 120,
                  message: localize('com_auth_email_max_length'),
                },
                pattern: {
                  value: /\S+@\S+\.\S+/,
                  message: localize('com_auth_email_pattern'),
                },
              })}
              aria-invalid={!!errors.email}
              className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
              placeholder=" "
            />
            <label
              htmlFor="email"
              className="absolute -top-2 left-2 z-10 bg-white px-2 text-sm text-gray-600 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:-top-2 peer-focus:text-sm peer-focus:text-green-600 dark:bg-gray-900 dark:text-gray-400 dark:peer-focus:text-green-500"
            >
              {localize('com_auth_email_address')}
            </label>
          </div>
          {errors.email && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <Button
            aria-label="Continue with password reset"
            type="submit"
            disabled={!!errors.email || isLoading}
            variant="submit"
            className="h-12 w-full rounded-2xl"
          >
            {isLoading ? <Spinner /> : localize('com_auth_continue')}
          </Button>
          <a
            href="/login"
            className="block text-center text-sm font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            {localize('com_auth_back_to_login')}
          </a>
        </div>
      </form>
    </>
  );
}

export default RequestPasswordReset;
