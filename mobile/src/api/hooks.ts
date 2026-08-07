import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

import { api } from "./client";
import type {
  Badges,
  Channel,
  ChatMessage,
  Child,
  ChildDetail,
  DirectorDashboard,
  Dossier,
  DriverDay,
  Identity,
  Timetable,
  Remark,
  RunRegister,
  SeenTopic,
  SchoolEvent,
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

/*
  The per-topic reads behind the child's menu.

  One hook per screen rather than one fat `useChild`: a parent opening the
  timetable should not wait on the fee schedule, and each screen keeps its own
  cache entry so going back and forth between two topics costs nothing.
*/

export function useChildRemarks(studentId: string): UseQueryResult<Remark[]> {
  return useQuery({
    queryKey: ["child", studentId, "remarks"],
    queryFn: () => api<Remark[]>(`/family/children/${studentId}/remarks`),
    enabled: Boolean(studentId),
  });
}

export function useChildTimetable(studentId: string): UseQueryResult<Timetable> {
  return useQuery({
    queryKey: ["child", studentId, "timetable"],
    queryFn: () => api<Timetable>(`/family/children/${studentId}/timetable`),
    enabled: Boolean(studentId),
    // A class's week is settled at the rentrée and changes a few times a year.
    staleTime: 10 * 60_000,
  });
}

export function useChildDossier(studentId: string): UseQueryResult<Dossier> {
  return useQuery({
    queryKey: ["child", studentId, "dossier"],
    queryFn: () => api<Dossier>(`/family/children/${studentId}/dossier`),
    enabled: Boolean(studentId),
  });
}

export function useEvents(): UseQueryResult<SchoolEvent[]> {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => api<SchoolEvent[]>("/family/events"),
  });
}

// ── L'espace parents ─────────────────────────────────────────────────────────

export function useChannels(): UseQueryResult<Channel[]> {
  return useQuery({
    queryKey: ["channels"],
    queryFn: () => api<Channel[]>("/family/channels"),
  });
}

export function useMessages(channelId: string): UseQueryResult<ChatMessage[]> {
  return useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => api<ChatMessage[]>(`/family/channels/${channelId}/messages`),
    enabled: Boolean(channelId),
    // There is no push here, so the thread polls while it is on screen. Ten
    // seconds is slow enough to cost nothing and fast enough that a reply
    // arrives before somebody wonders whether it sent.
    refetchInterval: 10_000,
  });
}

export function usePostMessage(
  channelId: string,
): UseMutationResult<{ id: string }, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ id: string }>(`/family/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    // Refetch rather than append: the answer from the server is the one with
    // the real id and timestamp, and a thread that shows a message twice for a
    // second reads as a double send.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["channel", channelId] });
      void client.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

// ── Ce qui est nouveau ───────────────────────────────────────────────────────

export function useBadges(): UseQueryResult<Badges> {
  return useQuery({
    queryKey: ["badges"],
    queryFn: () => api<Badges>("/family/badges"),
    // The one poll in the app that runs wherever you are, so it is slow: a
    // parent does not need to learn about a message within ten seconds of it
    // being posted, and a minute costs almost nothing.
    refetchInterval: 60_000,
  });
}

/**
 * Stamps a topic read, and takes the fresh counts back.
 *
 * Called when a screen opens rather than when it closes: a parent who reads
 * half the thread and leaves has still seen what the badge was about.
 */
export function useMarkSeen(): UseMutationResult<Badges, Error, SeenTopic> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (topic: SeenTopic) =>
      api<Badges>("/family/badges", {
        method: "POST",
        body: JSON.stringify({ topic }),
      }),
    onSuccess: (badges) => client.setQueryData(["badges"], badges),
  });
}
