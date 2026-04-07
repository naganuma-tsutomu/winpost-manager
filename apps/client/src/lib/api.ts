import type {
  Stallion,
  Mare,
  Foal,
  FoalFlag,
  ParentLineageWithChildren,
  ChildLineageWithParent,
  PedigreeEntryRecord,
  NicksRelationRecord,
  BreedingPlan,
  BreedingCalculateResponse,
} from '@winpost/shared';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'リクエストに失敗しました' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // 種牡馬
  stallions: {
    list: () => request<Stallion[]>('/stallions'),
    get: (id: number) => request<Stallion>(`/stallions/${id}`),
    create: (data: unknown) => request<Stallion>('/stallions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) => request<Stallion>(`/stallions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/stallions/${id}`, { method: 'DELETE' }),
  },
  // 繁殖牝馬
  mares: {
    list: () => request<Mare[]>('/mares'),
    get: (id: number) => request<Mare>(`/mares/${id}`),
    create: (data: unknown) => request<Mare>('/mares', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) => request<Mare>(`/mares/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/mares/${id}`, { method: 'DELETE' }),
  },
  // 系統
  lineages: {
    parentList: () => request<ParentLineageWithChildren[]>('/lineages/parent'),
    parentCreate: (data: unknown) => request<ParentLineageWithChildren>('/lineages/parent', { method: 'POST', body: JSON.stringify(data) }),
    parentUpdate: (id: number, data: unknown) => request<ParentLineageWithChildren>(`/lineages/parent/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    parentDelete: (id: number) => request<void>(`/lineages/parent/${id}`, { method: 'DELETE' }),
    childList: () => request<ChildLineageWithParent[]>('/lineages/child'),
    childCreate: (data: unknown) => request<ChildLineageWithParent>('/lineages/child', { method: 'POST', body: JSON.stringify(data) }),
    childUpdate: (id: number, data: unknown) => request<ChildLineageWithParent>(`/lineages/child/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    childDelete: (id: number) => request<void>(`/lineages/child/${id}`, { method: 'DELETE' }),
  },
  // 幼駒
  foals: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Foal[]>(`/foals${query}`);
    },
    get: (id: number) => request<Foal>(`/foals/${id}`),
    create: (data: unknown) => request<Foal>('/foals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: unknown) => request<Foal>(`/foals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/foals/${id}`, { method: 'DELETE' }),
    addFlag: (foalId: number, data: unknown) => request<FoalFlag>(`/foals/${foalId}/flags`, { method: 'POST', body: JSON.stringify(data) }),
    deleteFlag: (foalId: number, flagId: number) => request<void>(`/foals/${foalId}/flags/${flagId}`, { method: 'DELETE' }),
  },
  // 配合シミュレーター
  breeding: {
    calculate: (stallionId: number, mareId: number) =>
      request<BreedingCalculateResponse>('/breeding/calculate', { method: 'POST', body: JSON.stringify({ stallionId, mareId }) }),
    getPedigree: (type: 'stallion' | 'mare', id: number) =>
      request<PedigreeEntryRecord[]>(`/breeding/pedigree/${type}/${id}`),
    savePedigree: (type: 'stallion' | 'mare', id: number, entries: unknown[]) =>
      request<PedigreeEntryRecord[]>(`/breeding/pedigree/${type}/${id}`, { method: 'POST', body: JSON.stringify({ entries }) }),
    plans: {
      list: (year?: number) => {
        const query = year ? `?year=${year}` : '';
        return request<BreedingPlan[]>(`/breeding/plans${query}`);
      },
      create: (data: unknown) => request<BreedingPlan>('/breeding/plans', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: number, data: unknown) => request<BreedingPlan>(`/breeding/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: number) => request<void>(`/breeding/plans/${id}`, { method: 'DELETE' }),
    },
    nicks: {
      list: () => request<NicksRelationRecord[]>('/breeding/nicks'),
      upsert: (data: unknown) => request<NicksRelationRecord>('/breeding/nicks', { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: number) => request<void>(`/breeding/nicks/${id}`, { method: 'DELETE' }),
    },
  },
};
