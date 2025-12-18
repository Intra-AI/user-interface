import { MessageSquare, Ticket } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  Button,
} from '@librechat/client';
import { useLocalize } from '~/hooks';
import type { TDialogProps } from '@librechat/client';
import { cn } from '~/utils';

type SupportChoiceModalProps = TDialogProps & {
  onOpenTicket: () => void;
  onOpenChat: () => void;
};

export default function SupportChoiceModal({
  open,
  onOpenChange,
  onOpenTicket,
  onOpenChat,
}: SupportChoiceModalProps) {
  const localize = useLocalize();

  const handleTicketClick = () => {
    onOpenChange(false);
    onOpenTicket();
  };

  const handleChatClick = () => {
    onOpenChange(false);
    onOpenChat();
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-[500px] bg-background text-text-primary shadow-2xl">
        <OGDialogHeader>
          <OGDialogTitle className="flex items-center gap-2">
            {localize('com_nav_support_choice_title')}
          </OGDialogTitle>
        </OGDialogHeader>

        <div className="py-4">
          <p className="mb-6 text-sm text-text-secondary">
            {localize('com_nav_support_choice_description')}
          </p>

          <div className="flex flex-col gap-3">
            {/* Live Chat Option */}
            <button
              onClick={handleChatClick}
              className={cn(
                'group flex items-start gap-4 rounded-lg border border-border-medium p-4 text-left transition-all',
                'hover:border-blue-500 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500',
              )}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/30 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-medium text-text-primary">
                  {localize('com_nav_support_choice_chat')}
                </h3>
                <p className="text-sm text-text-secondary">
                  {localize('com_nav_support_choice_chat_description')}
                </p>
              </div>
            </button>

            {/* Support Ticket Option */}
            <button
              onClick={handleTicketClick}
              className={cn(
                'group flex items-start gap-4 rounded-lg border border-border-medium p-4 text-left transition-all',
                'hover:border-purple-500 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-purple-500',
              )}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/30 dark:text-purple-400 dark:group-hover:bg-purple-600 dark:group-hover:text-white">
                <Ticket className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-medium text-text-primary">
                  {localize('com_nav_support_choice_ticket')}
                </h3>
                <p className="text-sm text-text-secondary">
                  {localize('com_nav_support_choice_ticket_description')}
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {localize('com_ui_cancel')}
          </Button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
