import React, { useState, useCallback } from 'react';
import { OGDialog, DialogTemplate, useToastContext } from '@librechat/client';
import { 
  useEnableTwoFactorMutation, 
  useVerifyTwoFactorMutation,
  useConfirmTwoFactorMutation,
  useCompleteInitial2FAMutation
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import { SetupPhase, QRPhase, VerifyPhase, BackupPhase } from '~/components/Nav/SettingsTabs/Account/TwoFactorPhases';

type Phase = 'setup' | 'qr' | 'verify' | 'backup';

const InitialTwoFactorModal = ({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [phase, setPhase] = useState<Phase>('setup');
  const [secret, setSecret] = useState<string>('');
  const [otpauthUrl, setOtpauthUrl] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState<boolean>(false);

  const { mutate: enable2FAMutate, isLoading: isGenerating } = useEnableTwoFactorMutation();
  const { mutate: verify2FAMutate, isLoading: isVerifying } = useVerifyTwoFactorMutation();
  const { mutate: confirm2FAMutate } = useConfirmTwoFactorMutation();
  const { mutate: completeSetupMutate } = useCompleteInitial2FAMutation();

  const handleGenerate = useCallback(() => {
    enable2FAMutate(undefined, {
      onSuccess: ({ otpauthUrl, backupCodes }) => {
        setOtpauthUrl(otpauthUrl);
        setSecret(otpauthUrl.split('secret=')[1].split('&')[0]);
        setBackupCodes(backupCodes);
        setPhase('qr');
      },
      onError: () => showToast({ 
        message: localize('com_ui_2fa_generate_error') || 'Error generating 2FA', 
        status: 'error' 
      }),
    });
  }, [enable2FAMutate, localize, showToast]);

  const handleVerify = useCallback(() => {
    if (!verificationToken || verificationToken.length < 6) {
      showToast({ 
        message: localize('com_ui_2fa_invalid') || 'Please enter a valid code', 
        status: 'error' 
      });
      return;
    }

    verify2FAMutate(
      { token: verificationToken },
      {
        onSuccess: () => {
          confirm2FAMutate(
            { token: verificationToken },
            {
              onSuccess: () => {
                showToast({ 
                  message: localize('com_ui_2fa_verified') || '2FA verified successfully' 
                });
                setPhase('backup');
              },
              onError: () => showToast({ 
                message: localize('com_ui_2fa_invalid') || 'Invalid verification code', 
                status: 'error' 
              }),
            },
          );
        },
        onError: () => showToast({ 
          message: localize('com_ui_2fa_invalid') || 'Invalid verification code', 
          status: 'error' 
        }),
      },
    );
  }, [verificationToken, verify2FAMutate, confirm2FAMutate, localize, showToast]);

  const handleDownload = useCallback(() => {
    if (!backupCodes.length) {
      return;
    }
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }, [backupCodes]);

  const handleConfirm = useCallback(() => {
    completeSetupMutate(undefined, {
      onSuccess: () => {
        showToast({ 
          message: localize('com_ui_2fa_setup_complete') || '2FA setup completed successfully' 
        });
        onComplete();
      },
      onError: () => {
        showToast({ 
          message: localize('com_ui_2fa_complete_error') || 'Error completing 2FA setup',
          status: 'error' 
        });
      },
    });
  }, [completeSetupMutate, localize, showToast, onComplete]);

  return (
    <OGDialog open={open} onOpenChange={() => {}}>
      <DialogTemplate
        title={localize('com_ui_initial_2fa_setup') || 'Two-Factor Authentication Setup Required'}
        className="w-11/12 max-w-lg sm:w-3/4"
        showCloseButton={false}
        showCancelButton={false}
        main={
          <div className="p-4">
            {phase === 'setup' && (
              <SetupPhase 
                isGenerating={isGenerating} 
                onGenerate={handleGenerate}
              />
            )}
            {phase === 'qr' && (
              <QRPhase
                secret={secret}
                otpauthUrl={otpauthUrl}
                onNext={() => setPhase('verify')}
              />
            )}
            {phase === 'verify' && (
              <VerifyPhase
                token={verificationToken}
                onTokenChange={setVerificationToken}
                isVerifying={isVerifying}
                onNext={handleVerify}
              />
            )}
            {phase === 'backup' && (
              <BackupPhase
                backupCodes={backupCodes}
                downloaded={downloaded}
                onDownload={handleDownload}
                onNext={handleConfirm}
                onError={(error) => showToast({ 
                  message: error.message || localize('com_ui_2fa_complete_error'), 
                  status: 'error' 
                })}
              />
            )}
          </div>
        }
      />
    </OGDialog>
  );
};

export default InitialTwoFactorModal;
