import React, { useState, useRef } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import { useOnClickOutside } from '@librechat/client';
import ImportConversations from './ImportConversations';
import { RevokeKeys } from './RevokeKeys';
import { DeleteCache } from './DeleteCache';
import { ClearChats } from './ClearChats';
import SharedLinks from './SharedLinks';
import { useAuthContext } from '~/hooks';

function Data() {
  const dataTabRef = useRef(null);
  const [confirmClearConvos, setConfirmClearConvos] = useState(false);
  useOnClickOutside(dataTabRef, () => confirmClearConvos && setConfirmClearConvos(false), []);
  const { user } = useAuthContext();

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      {user?.role !== SystemRoles.USER && (
        <div className="pb-3">
          <ImportConversations />
        </div>
      )}
      {user?.role !== SystemRoles.USER && (
        <div className="pb-3">
          <SharedLinks />
        </div>
      )}
      {user?.role !== SystemRoles.USER && (
        <div className="pb-3">
          <RevokeKeys />
        </div>
      )}
      <div className="pb-3">
        <DeleteCache />
      </div>
      <div className="pb-3">
        <ClearChats />
      </div>
    </div>
  );
}

export default React.memo(Data);
