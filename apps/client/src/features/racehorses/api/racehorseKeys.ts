export const racehorseKeys = {
  all: ['racehorses'] as const,
  lists: () => [...racehorseKeys.all, 'list'] as const,
  list: (filters: string) => [...racehorseKeys.lists(), { filters }] as const,
  details: () => [...racehorseKeys.all, 'detail'] as const,
  detail: (id: number) => [...racehorseKeys.details(), id] as const,
};
