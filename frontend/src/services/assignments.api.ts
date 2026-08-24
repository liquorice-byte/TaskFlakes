import apiClient from './api';
import type { ApiResponse } from '@/types/api';
import type { UserResponse } from './auth.api';

// ===== Prisma enums (exactly matching schema.prisma) =====
export type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type AssignmentType =
  | 'WRITTEN'
  | 'COMPOSITE'
  | 'WRITING'
  | 'WATCHING'
  | 'PREVIEW'
  | 'ORAL';

export interface SubjectSummary {
  id: string;
  name: string;
  color: string;
}

export interface SubjectResponse extends SubjectSummary {
  createdAt: string;
  _count?: { assignments: number };
}

// ===== 自定义作业类型（用户拥有：名称 + 颜色） =====
export interface TaskTypeSummary {
  id: string;
  name: string;
  color: string;
}

export interface TaskTypeResponse extends TaskTypeSummary {
  createdAt: string;
  updatedAt: string;
  _count?: { assignments: number };
}

export interface AssignmentBase {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  type: AssignmentType;
  dueDate: string | null;
  completedAt: string | null;
  parentId: string | null;
  subjectId: string | null;
  taskTypeId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentResponse extends AssignmentBase {
  subject: SubjectSummary | null;
  taskType: TaskTypeSummary | null;
  parent?: Pick<AssignmentBase, 'id' | 'title' | 'status'> | null;
  children: AssignmentChild[];
  _count?: { children: number };
}

export interface AssignmentChild extends AssignmentBase {
  subject: SubjectSummary | null;
  taskType: TaskTypeSummary | null;
}

// ===== Payloads =====
export interface CreateSubjectPayload {
  name: string;
  color?: string;
}

export interface UpdateSubjectPayload {
  name?: string;
  color?: string;
}

export interface ListAssignmentsQuery {
  status?: Status;
  subjectId?: string;
  priority?: Priority;
  parentId?: string;
  taskTypeId?: string;
  topLevelOnly?: boolean;
  search?: string;
  sortBy?: 'dueDate' | 'priority' | 'status' | 'title' | 'type' | 'subject' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; total: number; limit: number };
}

export interface CreateAssignmentPayload {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  type?: AssignmentType;
  dueDate?: string | null;
  subjectId?: string | null;
  parentId?: string | null;
  taskTypeId?: string | null;
}

export interface UpdateAssignmentPayload extends Partial<Omit<CreateAssignmentPayload, 'title'>> {
  title?: string;
}

function handleResponse<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) {
    const err = response.data.error;
    const msg = err?.message || 'Request failed';
    const error = new Error(msg) as Error & { code?: string; details?: Record<string, string> };
    error.code = err?.code;
    error.details = err?.details;
    throw error;
  }
  return response.data.data as T;
}

function wrap<T>(data: unknown): ApiResponse<T> {
  return data as ApiResponse<T>;
}

// ============== Subjects ==============
export async function listSubjects(): Promise<SubjectResponse[]> {
  const { data } = await apiClient.get('/api/subjects');
  return handleResponse<SubjectResponse[]>({ data: wrap<SubjectResponse[]>(data) });
}

export async function createSubject(payload: CreateSubjectPayload): Promise<SubjectResponse> {
  const { data } = await apiClient.post('/api/subjects', payload);
  return handleResponse<SubjectResponse>({ data: wrap<SubjectResponse>(data) });
}

export async function updateSubject(
  id: string,
  payload: UpdateSubjectPayload
): Promise<SubjectResponse> {
  const { data } = await apiClient.patch(`/api/subjects/${id}`, payload);
  return handleResponse<SubjectResponse>({ data: wrap<SubjectResponse>(data) });
}

export async function deleteSubject(id: string): Promise<{ id: string; deleted: true }> {
  const { data } = await apiClient.delete(`/api/subjects/${id}`);
  return handleResponse<{ id: string; deleted: true }>({
    data: wrap<{ id: string; deleted: true }>(data),
  });
}

// ============== Task Types (custom) ==============
export interface CreateTaskTypePayload {
  name: string;
  color?: string;
}
export interface UpdateTaskTypePayload {
  name?: string;
  color?: string;
}

export async function listTaskTypes(): Promise<TaskTypeResponse[]> {
  const { data } = await apiClient.get('/api/task-types');
  return handleResponse<TaskTypeResponse[]>({ data: wrap<TaskTypeResponse[]>(data) });
}

export async function createTaskType(payload: CreateTaskTypePayload): Promise<TaskTypeResponse> {
  const { data } = await apiClient.post('/api/task-types', payload);
  return handleResponse<TaskTypeResponse>({ data: wrap<TaskTypeResponse>(data) });
}

export async function updateTaskType(
  id: string,
  payload: UpdateTaskTypePayload
): Promise<TaskTypeResponse> {
  const { data } = await apiClient.patch(`/api/task-types/${id}`, payload);
  return handleResponse<TaskTypeResponse>({ data: wrap<TaskTypeResponse>(data) });
}

export async function deleteTaskType(id: string): Promise<{ id: string; deleted: true }> {
  const { data } = await apiClient.delete(`/api/task-types/${id}`);
  return handleResponse<{ id: string; deleted: true }>({
    data: wrap<{ id: string; deleted: true }>(data),
  });
}

// ============== Assignments ==============
export async function listAssignments(
  query: ListAssignmentsQuery = {}
): Promise<PaginatedResponse<AssignmentResponse>> {
  const params = new URLSearchParams();
  const append = (k: string, v: string | boolean | number | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    params.append(k, String(v));
  };
  append('status', query.status);
  append('subjectId', query.subjectId);
  append('priority', query.priority);
  append('parentId', query.parentId);
  append('taskTypeId', query.taskTypeId);
  append('topLevelOnly', query.topLevelOnly ? 'true' : undefined);
  append('search', query.search);
  append('sortBy', query.sortBy);
  append('sortDir', query.sortDir);
  append('page', query.page);
  append('limit', query.limit);

  const qs = params.toString();
  const { data } = await apiClient.get(`/api/assignments${qs ? `?${qs}` : ''}`);
  const ar = wrap<AssignmentResponse[]>(data);
  if (!ar.success) {
    const e = new Error(ar.error?.message || 'Request failed');
    throw e;
  }
  return {
    data: ar.data || [],
    meta: { page: ar.meta?.page ?? 1, total: ar.meta?.total ?? 0, limit: ar.meta?.limit ?? 50 },
  };
}

export interface AssignmentCounts {
  total: number;
  notStarted: number;
  inProgress: number;
  done: number;
}

/** 全局状态计数（不受分页限制），用于筛选 chip */
export async function fetchAssignmentCounts(
  subjectId?: string
): Promise<AssignmentCounts> {
  const params = new URLSearchParams();
  if (subjectId) params.append('subjectId', subjectId);
  params.append('topLevelOnly', 'true');
  const qs = params.toString();
  const { data } = await apiClient.get(`/api/assignments/counts${qs ? `?${qs}` : ''}`);
  const ar = wrap<AssignmentCounts>(data);
  if (!ar.success) {
    throw new Error(ar.error?.message || 'Request failed');
  }
  return (
    ar.data || { total: 0, notStarted: 0, inProgress: 0, done: 0 }
  );
}

export async function getAssignment(id: string): Promise<AssignmentResponse> {
  const { data } = await apiClient.get(`/api/assignments/${id}`);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function createAssignment(
  payload: CreateAssignmentPayload
): Promise<AssignmentResponse> {
  const { data } = await apiClient.post('/api/assignments', payload);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function updateAssignment(
  id: string,
  payload: UpdateAssignmentPayload
): Promise<AssignmentResponse> {
  const { data } = await apiClient.patch(`/api/assignments/${id}`, payload);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function deleteAssignment(id: string): Promise<{ id: string; deleted: true }> {
  const { data } = await apiClient.delete(`/api/assignments/${id}`);
  return handleResponse<{ id: string; deleted: true }>({
    data: wrap<{ id: string; deleted: true }>(data),
  });
}

export async function completeAssignment(id: string): Promise<AssignmentResponse> {
  const { data } = await apiClient.post(`/api/assignments/${id}/complete`);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function reopenAssignment(id: string): Promise<AssignmentResponse> {
  const { data } = await apiClient.post(`/api/assignments/${id}/reopen`);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function setAssignmentStatus(
  id: string,
  status: Status
): Promise<AssignmentResponse> {
  const { data } = await apiClient.post(`/api/assignments/${id}/status`, { status });
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

export async function createSubtask(
  parentId: string,
  payload: Omit<CreateAssignmentPayload, 'parentId'>
): Promise<AssignmentResponse> {
  const { data } = await apiClient.post(`/api/assignments/${parentId}/subtasks`, payload);
  return handleResponse<AssignmentResponse>({ data: wrap<AssignmentResponse>(data) });
}

// ============ Stats helpers ============
export interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  highPriority: number;
  doneRatePct: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await listAssignments({ topLevelOnly: true, limit: 200 });
  const now = new Date();
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let overdue = 0;
  let highPriority = 0;

  const walk = (a: AssignmentResponse | AssignmentChild) => {
    total++;
    if (a.status === 'DONE') completed++;
    else if (a.status === 'IN_PROGRESS') inProgress++;
    else notStarted++;
    if (a.priority === 'HIGH' && a.status !== 'DONE') highPriority++;
    if (a.dueDate && a.status !== 'DONE' && new Date(a.dueDate) < now) overdue++;
  };

  for (const a of data) {
    walk(a);
    for (const c of a.children) walk(c);
  }

  return {
    total,
    completed,
    inProgress,
    notStarted,
    overdue,
    highPriority,
    doneRatePct: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

// ============ Phase 3: Settings / Stats / Export / Me ============

export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';
export type Language = 'ZH_CN' | 'EN';

export interface UserSettingsResponse {
  defaultSubjectColor: string;
  semesterStart: string | null;
  dailyCutoffHour: number;
  theme: Theme;
  language: Language;
  defaultPriority: Priority;
  defaultAssignmentType: AssignmentType;
  showCompletedByDefault: boolean;
}

export type UpdateSettingsPayload = Partial<Omit<UserSettingsResponse, 'semesterStart'> & { semesterStart: string | null }>;

export async function fetchSettings(): Promise<UserSettingsResponse> {
  const { data } = await apiClient.get('/api/settings');
  return handleResponse<UserSettingsResponse>({ data: wrap<UserSettingsResponse>(data) });
}

export async function updateSettings(
  payload: UpdateSettingsPayload
): Promise<UserSettingsResponse> {
  const { data } = await apiClient.patch('/api/settings', payload);
  return handleResponse<UserSettingsResponse>({ data: wrap<UserSettingsResponse>(data) });
}

export interface StatsOverview {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  highPriority: number;
  doneRatePct: number;
  weekOverWeekDelta: number;
}

export interface StatsSubjectBucket {
  subjectId: string;
  name: string;
  color: string;
  total: number;
  done: number;
  notDone: number;
  doneRate: number;
}

export interface StatsTypeBucket {
  type: AssignmentType;
  total: number;
  done: number;
  doneRate: number;
}

export interface StatsDailyPoint {
  date: string; // YYYY-MM-DD
  created: number;
  completed: number;
  netAccomplished: number;
}

export interface StatsWeekCell {
  day: number; // JS getDay(): 0=Sun..6=Sat
  weekdayLabel: string;
  completed: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface StatsOverdueRow {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  overdueDays: number;
}

export interface FullStatsResponse {
  overview: StatsOverview;
  bySubject: StatsSubjectBucket[];
  byType: StatsTypeBucket[];
  dailyTrend: StatsDailyPoint[];
  weekHeatmap: StatsWeekCell[];
  overdueTop5: StatsOverdueRow[];
}

export async function fetchFullStats(): Promise<FullStatsResponse> {
  const { data } = await apiClient.get('/api/stats');
  return handleResponse<FullStatsResponse>({ data: wrap<FullStatsResponse>(data) });
}

export interface ExportBundle {
  exportedAt: string;
  version: 1;
  subjects: Array<{ name: string; color: string }>;
  assignments: Array<{
    title: string;
    description: string | null;
    status: Status;
    priority: Priority;
    type: AssignmentType;
    dueDate: string | null;
    completedAt: string | null;
    parentTitle: string | null;
    subjectName: string | null;
  }>;
  settings: unknown;
}

export interface ImportSummary {
  mode: 'merge' | 'replace';
  subjectsCreated: number;
  subjectsSkipped: number;
  subjectsDeleted: number;
  assignmentsCreated: number;
  assignmentsSkipped: number;
  assignmentsDeleted: number;
}

export async function downloadExportJson(): Promise<void> {
  const res = await apiClient.get('/api/export', { responseType: 'blob' });
  const blob = res.data as Blob;
  // Prefer server-provided filename from Content-Disposition if available
  let filename = `taskflakes-export-${new Date().toISOString().slice(0, 10)}.json`;
  const disposition = (res as unknown as { headers?: Record<string, string> }).headers?.['content-disposition'];
  if (disposition) {
    const m = /filename="?([^"]+)"?/.exec(disposition);
    if (m?.[1]) filename = m[1];
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function importJsonBundle(
  bundle: ExportBundle,
  mode: 'merge' | 'replace' = 'merge'
): Promise<ImportSummary> {
  const payload = { mode, data: bundle };
  const { data } = await apiClient.post('/api/export/import', payload);
  return handleResponse<ImportSummary>({ data: wrap<ImportSummary>(data) });
}

// Update current user's public profile (name etc.)
export interface UpdateMePayload {
  name?: string;
}
export async function updateCurrentUser(payload: UpdateMePayload): Promise<UserResponse> {
  const { data } = await apiClient.patch('/api/auth/me', payload);
  return handleResponse<UserResponse>({ data: wrap<UserResponse>(data) });
}

// Delete the current user's account (requires email confirmation).
export async function deleteCurrentAccount(email: string): Promise<{ deleted: boolean }> {
  const { data } = await apiClient.delete('/api/auth/me', { data: { email } });
  return handleResponse<{ deleted: boolean }>({ data: wrap<{ deleted: boolean }>(data) });
}
