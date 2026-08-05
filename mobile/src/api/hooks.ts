import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

import { api } from "./client";
import type {
  Child,
  ChildDetail,
  DirectorDashboard,
  DriverDay,
  Identity,
  RunRegister,
  TeacherDay,
} from "./types";

/**
 * One hook per screen's worth of data.
 *
 * Keys carry the date where the answer depends on it, so yesterday's runs and
 * today's are two entries in the cache rather than one that keeps overwriting
 * itself.
 */

export function useIdentity(): UseQueryResult<Identity> {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Identity>("/me"),
    // The set of spaces changes when a school opens a portal account or hands
    // out a role — rare, and never mid-session.
    staleTime: 10 * 60_000,
  });
}

export function useChildren(): UseQueryResult<Child[]> {
  return useQuery({
    queryKey: ["children"],
    queryFn: () => api<Child[]>("/family/children"),
  });
}

export function useChild(studentId: string): UseQueryResult<ChildDetail> {
  return useQuery({
    queryKey: ["child", studentId],
    queryFn: () => api<ChildDetail>(`/family/children/${studentId}`),
    enabled: Boolean(studentId),
  });
}

export function useTeacherDay(date: string): UseQueryResult<TeacherDay> {
  return useQuery({
    queryKey: ["teacher", date],
    queryFn: () => api<TeacherDay>(`/teacher/today?date=${date}`),
  });
}

export function useDriverDay(date: string): UseQueryResult<DriverDay> {
  return useQuery({
    queryKey: ["runs", date],
    queryFn: () => api<DriverDay>(`/driver/runs?date=${date}`),
    // The board moves during the morning — a run departs, another arrives.
    staleTime: 30_000,
  });
}

export function useRunRegister(runId: string): UseQueryResult<RunRegister> {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api<RunRegister>(`/driver/runs/${runId}/register`),
    enabled: Boolean(runId),
  });
}

/**
 * Le départ et l'arrivée.
 *
 * The server answers with the run and its register as they now stand, so the
 * cache is written from the response rather than invalidated and re-fetched:
 * a driver pressing "démarrer" on the kerb has one bar of signal, and a second
 * round trip before the names appear is the difference between a register taken
 * and a register skipped.
 *
 * `runs` is invalidated rather than written, because the day's list carries
 * counts this response does not.
 */
export function useMoveRun(
  runId: string,
): UseMutationResult<RunRegister & { moved: boolean }, Error, "EN_ROUTE" | "ARRIVED"> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (next: "EN_ROUTE" | "ARRIVED") =>
      api<RunRegister & { moved: boolean }>(`/driver/runs/${runId}/status`, {
        method: "POST",
        body: JSON.stringify({ next }),
      }),
    onSuccess: (data) => {
      client.setQueryData<RunRegister>(["run", runId], {
        run: data.run,
        entries: data.entries,
      });
      void client.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

/** L'appel: one child, marked at the kerb. */
export function useMarkRider(
  runId: string,
): UseMutationResult<
  RunRegister,
  Error,
  { subscriptionId: string; status: string; minutesLate?: number | null; reason?: string | null }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (mark) =>
      api<RunRegister>(`/driver/runs/${runId}/register`, {
        method: "POST",
        body: JSON.stringify(mark),
      }),
    onSuccess: (data) => client.setQueryData<RunRegister>(["run", runId], data),
  });
}

export function useDirectorDashboard(): UseQueryResult<DirectorDashboard> {
  return useQuery({
    queryKey: ["director"],
    queryFn: () => api<DirectorDashboard>("/director/dashboard"),
  });
}
