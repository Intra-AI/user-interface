import { useMutation } from '@tanstack/react-query';
import { dataService, MutationKeys } from 'librechat-data-provider';
import type { UseMutationResult, UseMutationOptions } from '@tanstack/react-query';
import type { TSupportRequest, TSupportResponse } from 'librechat-data-provider';

type SupportMutationOptions = UseMutationOptions<
  TSupportResponse,
  unknown,
  TSupportRequest,
  unknown
>;

export const useSubmitSupportRequestMutation = (
  options?: SupportMutationOptions,
): UseMutationResult<TSupportResponse, unknown, TSupportRequest, unknown> => {
  return useMutation([MutationKeys.submitSupportRequest], {
    mutationFn: (data: TSupportRequest) => dataService.submitSupportRequest(data),
    ...options,
  });
};
