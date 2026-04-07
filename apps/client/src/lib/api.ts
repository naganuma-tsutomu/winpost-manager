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
    list: () => request<any[]>('/stallions'),
    get: (id: number) => request<any>(`/stallions/${id}`),
    create: (data: any) => request<any>('/stallions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/stallions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/stallions/${id}`, { method: 'DELETE' }),
  },
  // 繁殖牝馬
  mares: {
    list: () => request<any[]>('/mares'),
    get: (id: number) => request<any>(`/mares/${id}`),
    create: (data: any) => request<any>('/mares', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/mares/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/mares/${id}`, { method: 'DELETE' }),
  },
  // 系統
  lineages: {
    parentList: () => request<any[]>('/lineages/parent'),
    parentCreate: (data: any) => request<any>('/lineages/parent', { method: 'POST', body: JSON.stringify(data) }),
    parentUpdate: (id: number, data: any) => request<any>(`/lineages/parent/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    parentDelete: (id: number) => request<void>(`/lineages/parent/${id}`, { method: 'DELETE' }),
    childList: () => request<any[]>('/lineages/child'),
    childCreate: (data: any) => request<any>('/lineages/child', { method: 'POST', body: JSON.stringify(data) }),
    childUpdate: (id: number, data: any) => request<any>(`/lineages/child/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    childDelete: (id: number) => request<void>(`/lineages/child/${id}`, { method: 'DELETE' }),
  },
  // 幼駒
  foals: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any[]>(`/foals${query}`);
    },
    get: (id: number) => request<any>(`/foals/${id}`),
    create: (data: any) => request<any>('/foals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/foals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/foals/${id}`, { method: 'DELETE' }),
    addFlag: (foalId: number, data: any) => request<any>(`/foals/${foalId}/flags`, { method: 'POST', body: JSON.stringify(data) }),
    deleteFlag: (foalId: number, flagId: number) => request<void>(`/foals/${foalId}/flags/${flagId}`, { method: 'DELETE' }),
  },
};
