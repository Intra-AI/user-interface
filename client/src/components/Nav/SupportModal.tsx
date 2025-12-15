import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { HelpCircle, Check, X } from 'lucide-react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  OGDialogFooter,
  Button,
  Input,
  Label,
  TextareaAutosize,
  useToastContext,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useSubmitSupportRequestMutation } from '~/data-provider';
import type { TDialogProps } from '@librechat/client';
import { cn } from '~/utils';

type SupportFormData = {
  subject: string;
  category: string;
  priority: string;
  description: string;
};

type SupportModalProps = TDialogProps;

const categoryOptions = [
  { value: 'bug', labelKey: 'com_nav_support_category_bug' },
  { value: 'feature', labelKey: 'com_nav_support_category_feature' },
  { value: 'question', labelKey: 'com_nav_support_category_question' },
  { value: 'technical', labelKey: 'com_nav_support_category_technical' },
];

const priorityOptions = [
  { value: 'low', labelKey: 'com_nav_support_priority_low' },
  { value: 'normal', labelKey: 'com_nav_support_priority_normal' },
  { value: 'high', labelKey: 'com_nav_support_priority_high' },
];

export default function SupportModal({ open, onOpenChange }: SupportModalProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SupportFormData>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      subject: '',
      category: 'question',
      priority: 'normal',
      description: '',
    },
  });

  const submitSupportRequestMutation = useSubmitSupportRequestMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_nav_support_success'),
        status: 'success',
      });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Support request error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || localize('com_nav_support_error');
      showToast({
        message: `${localize('com_nav_support_error')}: ${errorMessage}`,
        status: 'error',
      });
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = (data: SupportFormData) => {
    if (submitSupportRequestMutation.isLoading) {
      return;
    }
    console.log('Submitting support request:', data);
    submitSupportRequestMutation.mutate(data);
  };

  const isSubmitting = submitSupportRequestMutation.isLoading;

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-h-[90vh] w-[500px] overflow-y-auto bg-background text-text-primary shadow-2xl">
        <OGDialogHeader>
          <OGDialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            {localize('com_nav_support_title')}
          </OGDialogTitle>
        </OGDialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-4">
          {/* Description */}
          <p className="text-sm text-text-secondary">
            {localize('com_nav_support_description')}
          </p>

          {/* Subject Field */}
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="support-subject" className="text-left text-sm font-medium">
              {localize('com_nav_support_subject')}
              <span className="text-red-500"> *</span>
            </Label>
            <Input
              type="text"
              id="support-subject"
              placeholder={localize('com_nav_support_subject_placeholder')}
              {...register('subject', {
                required: localize('com_nav_support_field_required'),
                maxLength: {
                  value: 128,
                  message: localize('com_nav_support_subject_max_length'),
                },
              })}
              aria-invalid={!!errors.subject}
              disabled={isSubmitting}
            />
            {errors.subject && (
              <span className="text-sm text-red-500">{errors.subject.message}</span>
            )}
          </div>

          {/* Category Field */}
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="support-category" className="text-left text-sm font-medium">
              {localize('com_nav_support_category')}
              <span className="text-red-500"> *</span>
            </Label>
            <Controller
              name="category"
              control={control}
              rules={{ required: localize('com_nav_support_field_required') }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="support-category" aria-invalid={!!errors.category}>
                    <SelectValue placeholder={localize('com_nav_support_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {localize(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <span className="text-sm text-red-500">{errors.category.message}</span>
            )}
          </div>

          {/* Priority Field */}
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="support-priority" className="text-left text-sm font-medium">
              {localize('com_nav_support_priority')}
              <span className="text-red-500"> *</span>
            </Label>
            <Controller
              name="priority"
              control={control}
              rules={{ required: localize('com_nav_support_field_required') }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="support-priority" aria-invalid={!!errors.priority}>
                    <SelectValue placeholder={localize('com_nav_support_priority')} />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {localize(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.priority && (
              <span className="text-sm text-red-500">{errors.priority.message}</span>
            )}
          </div>

          {/* Description Field */}
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="support-description" className="text-left text-sm font-medium">
              {localize('com_nav_support_description')}
              <span className="text-red-500"> *</span>
            </Label>
            <TextareaAutosize
              {...register('description', {
                required: localize('com_nav_support_field_required'),
                maxLength: {
                  value: 2000,
                  message: localize('com_nav_support_description_max_length'),
                },
              })}
              id="support-description"
              placeholder={localize('com_nav_support_description_placeholder')}
              disabled={isSubmitting}
              className={cn(
                'flex h-10 max-h-[300px] min-h-[120px] w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none',
                errors.description && 'border-red-500',
              )}
            />
            {errors.description && (
              <span className="text-sm text-red-500">{errors.description.message}</span>
            )}
          </div>

          {/* Success Message - shown after successful submission */}
          {submitSupportRequestMutation.isSuccess && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">{localize('com_nav_support_success')}</p>
                <p className="text-xs">{localize('com_nav_support_success_message')}</p>
              </div>
            </div>
          )}

          {/* Error Message - shown after failed submission */}
          {submitSupportRequestMutation.isError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
              <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">{localize('com_nav_support_error')}</p>
                <p className="text-xs">{localize('com_nav_support_error_message')}</p>
              </div>
            </div>
          )}
        </form>

        <OGDialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? localize('com_nav_support_submitting') : localize('com_nav_support_submit')}
          </Button>
        </OGDialogFooter>
      </OGDialogContent>
    </OGDialog>
  );
}
