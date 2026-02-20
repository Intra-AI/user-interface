import React, { useRef } from 'react';
import { MyFilesModal } from './MyFilesModal';

type FilesViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function FilesView({ open, onOpenChange }: FilesViewProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <MyFilesModal open={open} onOpenChange={onOpenChange} triggerRef={triggerRef} />;
}
