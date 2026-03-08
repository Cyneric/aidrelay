import type { ActivityLogEntry, LogFilters } from '@shared/channels'

export const logService = {
  query: (filters: LogFilters): Promise<ActivityLogEntry[]> => window.api.logQuery(filters),
}
