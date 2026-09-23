import type {
  AiInfo,
  Business,
  CardFields,
  Catalog,
  Decision,
  Evaluation,
  Meta,
  MyTask,
  Preview,
  ProposalView,
  Recommendation,
  Task,
  Team,
  TeamProposal,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Issue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues: Issue[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Сервер API недоступен. Запустите backend: pnpm dev в папке backend.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; issues?: Issue[] };
    throw new ApiError(res.status, body.error ?? `Ошибка ${res.status}`, body.issues ?? []);
  }
  return data as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  meta: () => request<Meta>("/meta"),
  aiInfo: () => request<AiInfo>("/ai/info"),
  scorePreview: (fields: Partial<CardFields>) => request<Evaluation>("/score/preview", json("POST", { fields })),

  catalog: (q: { sort?: string; levels?: string[]; topics?: string[] } = {}) => {
    const params = new URLSearchParams();
    if (q.sort) params.set("sort", q.sort);
    if (q.levels?.length) params.set("levels", q.levels.join(","));
    if (q.topics?.length) params.set("topics", q.topics.join(","));
    return request<Catalog>(`/catalog?${params.toString()}`);
  },
  catalogTask: (id: string) => request<Task>(`/catalog/${encodeURIComponent(id)}`),

  businesses: () => request<Business[]>("/businesses"),
  business: (id: string) => request<Business>(`/businesses/${encodeURIComponent(id)}`),
  updateBusiness: (id: string, body: Omit<Business, "id">) => request<Business>(`/businesses/${encodeURIComponent(id)}`, json("PATCH", body)),
  businessTasks: (id: string) => request<MyTask[]>(`/businesses/${encodeURIComponent(id)}/tasks`),

  teams: () => request<Team[]>("/teams"),
  team: (id: string) => request<Team>(`/teams/${encodeURIComponent(id)}`),
  updateTeam: (id: string, body: Omit<Team, "id">) => request<Team>(`/teams/${encodeURIComponent(id)}`, json("PATCH", body)),
  teamProposals: (id: string) => request<TeamProposal[]>(`/teams/${encodeURIComponent(id)}/proposals`),
  recommendations: (id: string) => request<Recommendation[]>(`/teams/${encodeURIComponent(id)}/recommendations`),

  task: (id: string) => request<Task>(`/tasks/${encodeURIComponent(id)}`),
  createTask: (body: { businessId: string; topic: string; rawDraft: string }) => request<Task>("/tasks", json("POST", body)),
  reanalyze: (id: string, body: { rawDraft?: string; topic?: string }) => request<Task>(`/tasks/${encodeURIComponent(id)}/analyze`, json("POST", body)),
  saveAnswers: (id: string, answers: Record<string, string>) =>
    request<{ preview: Preview; fields: CardFields }>(`/tasks/${encodeURIComponent(id)}/answers`, json("PUT", { answers })),
  structure: (id: string) => request<Task>(`/tasks/${encodeURIComponent(id)}/structure`, json("POST")),
  confirm: (id: string, body: { title: string; topic: string; fields: CardFields }) => request<Task>(`/tasks/${encodeURIComponent(id)}`, json("PATCH", body)),
  publish: (id: string) => request<Task>(`/tasks/${encodeURIComponent(id)}/publish`, json("POST")),
  proposals: (id: string) => request<ProposalView[]>(`/tasks/${encodeURIComponent(id)}/proposals`),
  decide: (taskId: string, teamId: string, status: Decision) =>
    request<{ teamId: string; decision: Decision }>(`/tasks/${encodeURIComponent(taskId)}/selections/${encodeURIComponent(teamId)}`, json("PUT", { status })),
  propose: (taskId: string, body: { teamId: string; idea: string; plan: string; deadline: string; prototypeUrl: string }) =>
    request<{ id: string }>(`/tasks/${encodeURIComponent(taskId)}/proposals`, json("POST", body)),
};

/** Ошибки валидации по полям: { idea: 'Опишите идею…' } */
export function issuesByField(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  return Object.fromEntries(err.issues.map((i) => [i.path.split(".").at(-1) ?? i.path, i.message]));
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Что-то пошло не так";
}
