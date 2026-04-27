import { useCallback } from 'react';
import {
  upsertExchangeRate as upsertExchangeRateMW,
  updateExchangeRate as updateExchangeRateMW,
  type UpsertExchangeRatePayload,
} from '@/infrastructure/powersync/mutationWrappers';

export type { UpsertExchangeRatePayload };

export function useExchangeRateMutations(householdId: string, userId: string) {
  const upsertExchangeRate = useCallback(
    async (payload: Omit<UpsertExchangeRatePayload, 'household_id'>) => {
      return upsertExchangeRateMW({ ...payload, household_id: householdId }, userId);
    },
    [householdId, userId],
  );

  const updateExchangeRate = useCallback(
    async (id: string, rate: number, source: 'manual' | 'fallback') => {
      return updateExchangeRateMW(id, rate, source, userId);
    },
    [userId],
  );

  return { upsertExchangeRate, updateExchangeRate };
}