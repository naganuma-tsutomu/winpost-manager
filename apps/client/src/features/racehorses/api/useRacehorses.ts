import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { racehorseKeys } from './racehorseKeys.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// --- Types ---
export interface Racehorse {
  id: number;
  name: string;
  birthYear?: number;
  gender: 'MALE' | 'FEMALE';
  sireId?: number;
  damId?: number;
  growthType?: 'SUPER_EARLY' | 'EARLY' | 'NORMAL' | 'LATE' | 'SUPER_LATE';
  surface?: 'TURF' | 'DIRT' | 'BOTH';
  distanceMin?: number;
  distanceMax?: number;
  temperament?: 'FIERCE' | 'ROUGH' | 'NORMAL' | 'MILD' | 'SUPER_MILD';
  runningStyles?: ('GREAT_ESCAPE' | 'ESCAPE' | 'LEADER' | 'CLOSER' | 'CHASER' | 'VERSATILE')[];
  // 成績
  starts?: number;
  wins?: number;
  g1Wins?: number;
  // 能力値（グレード）
  speed?: string;        // スピード
  guts?: string;         // 勝負根性
  acceleration?: string; // 瞬発力
  power?: string;        // パワー
  health?: string;       // 健康
  intelligence?: string; // 賢さ
  spirit?: string;       // 精神力
  flexibility?: string;  // 柔軟性
  autoComment?: string;
  aiComment?: string;
  memo?: string;
  status: 'ACTIVE' | 'RETIRED';
}

export type CreateRacehorseDTO = Omit<Racehorse, 'id'>;
export type UpdateRacehorseDTO = Partial<CreateRacehorseDTO>;

// --- Fetchers ---
const fetchRacehorses = async (): Promise<Racehorse[]> => {
  const res = await fetch(`${API_URL}/racehorses`);
  if (!res.ok) throw new Error('Failed to fetch racehorses');
  return res.json();
};

const createRacehorse = async (data: CreateRacehorseDTO): Promise<Racehorse> => {
  const res = await fetch(`${API_URL}/racehorses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create racehorse');
  return res.json();
};

const updateRacehorse = async (params: { id: number; data: UpdateRacehorseDTO }): Promise<Racehorse> => {
  const res = await fetch(`${API_URL}/racehorses/${params.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.data),
  });
  if (!res.ok) throw new Error('Failed to update racehorse');
  return res.json();
};

const deleteRacehorse = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/racehorses/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete racehorse');
};

const fetchAIAdvice = async (data: any): Promise<{ advice: string }> => {
  const res = await fetch(`${API_URL}/ai/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to fetch AI advice');
  return res.json();
};

// --- Hooks ---
export const useRacehorses = () => {
  return useQuery({
    queryKey: racehorseKeys.lists(),
    queryFn: fetchRacehorses,
  });
};

export const useCreateRacehorse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRacehorse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: racehorseKeys.all });
    },
  });
};

export const useUpdateRacehorse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateRacehorse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: racehorseKeys.all });
    },
  });
};

export const useDeleteRacehorse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRacehorse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: racehorseKeys.all });
    },
  });
};

export const useAIAdvice = () => {
  return useMutation({
    mutationFn: fetchAIAdvice,
  });
};
