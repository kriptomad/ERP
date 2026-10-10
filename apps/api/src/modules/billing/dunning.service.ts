import { addDays } from 'date-fns';

const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

export interface DunningResult {
  nextRetryAt: Date | null;
  shouldSuspend: boolean;
  attempt: number;
}

export function calculateDunningSchedule(attempt: number): DunningResult {
  const retryInDays = RETRY_SCHEDULE_DAYS[Math.min(attempt - 1, RETRY_SCHEDULE_DAYS.length - 1)];
  const nextRetryAt = addDays(new Date(), retryInDays);
  const shouldSuspend = attempt >= RETRY_SCHEDULE_DAYS.length;

  return { nextRetryAt, shouldSuspend, attempt };
}

export function getRetryScheduleDays(): readonly number[] {
  return RETRY_SCHEDULE_DAYS;
}
