import { useQuery, type UseQueryResult } from "@tanstack/react-query";

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

export function useDirectorDashboard(): UseQueryResult<DirectorDashboard> {
  return useQuery({
    queryKey: ["director"],
    queryFn: () => api<DirectorDashboard>("/director/dashboard"),
  });
}
