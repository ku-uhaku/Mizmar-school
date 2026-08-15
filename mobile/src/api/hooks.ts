import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";

import { api } from "./client";
import type {
  AppNotification,
  Assessment,
  AssessmentOptions,
  Badges,
  Bulletins,
  Channel,
  ChatMessage,
  Child,
  ChildDetail,
  Classmates,
  DirectorDashboard,
  DocumentRequest,
  Dossier,
  DriverDay,
  Identity,
  Inbox,
  MarkSheet,
  MyRemark,
  NotificationKind,
  PupilOption,
  Timetable,
  Remark,
  RequestType,
  RunItinerary,
  RunRegister,
  RunRider,
  SeenTopic,
  SupplyList,
  SupplyOptions,
  SchoolEvent,
  TeacherDay,
  TeacherRegister,
  TeacherSupplyList,
  TeacherWeek,
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

/** What a lesson is, for the register endpoints below — same four fields the
 * web page keeps in its query string, since `findRegister` resolves them
 * against the teacher's own assignments rather than trusting them. */
export type LessonRef = {
  schoolClassId: string;
  subjectId: string | null;
  timeSlotId: string | null;
  date: string;
};

function registerQueryKey(ref: LessonRef) {
  return [
    "register",
    ref.schoolClassId,
    ref.subjectId,
    ref.timeSlotId,
    ref.date,
  ] as const;
}

function registerPath(ref: LessonRef): string {
  const params = new URLSearchParams({
    schoolClassId: ref.schoolClassId,
    date: ref.date,
  });
  if (ref.subjectId) params.set("subjectId", ref.subjectId);
  if (ref.timeSlotId) params.set("timeSlotId", ref.timeSlotId);
  return `/teacher/register?${params.toString()}`;
}

export function useLessonRegister(
  ref: LessonRef,
): UseQueryResult<TeacherRegister> {
  return useQuery({
    queryKey: registerQueryKey(ref),
    queryFn: () => api<TeacherRegister>(registerPath(ref)),
    enabled: Boolean(ref.schoolClassId),
  });
}

/**
 * L'appel, one pupil at a time — same rule as the driver's `useMarkRider`: a
 * payload carrying the whole roster would let a save from a stale screen undo
 * a mark made since it was opened.
 */
export function useMarkPupil(
  ref: LessonRef,
): UseMutationResult<
  TeacherRegister,
  Error,
  {
    enrollmentId: string;
    status: string;
    minutesLate?: number | null;
    reason?: string | null;
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (mark) =>
      api<TeacherRegister>("/teacher/register", {
        method: "POST",
        body: JSON.stringify({ ...ref, ...mark }),
      }),
    onSuccess: (data) => {
      client.setQueryData<TeacherRegister>(registerQueryKey(ref), data);
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
}

/**
 * "Les autres sont là" — fills in every pupil not yet marked as present.
 *
 * Answers with the whole sheet, like the per-pupil mark, so the screen renders
 * the server's version of the register rather than assuming what it wrote.
 */
export function useMarkRestPresent(
  ref: LessonRef,
): UseMutationResult<TeacherRegister, Error, void> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api<TeacherRegister>("/teacher/register/all-present", {
        method: "POST",
        body: JSON.stringify(ref),
      }),
    onSuccess: (data) => {
      client.setQueryData<TeacherRegister>(registerQueryKey(ref), data);
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
}

export function useTeacherWeek(
  scheduleKind: "STANDARD" | "RAMADAN" = "STANDARD",
): UseQueryResult<TeacherWeek> {
  return useQuery({
    queryKey: ["teacher", "week", scheduleKind],
    queryFn: () => api<TeacherWeek>(`/teacher/timetable?schedule=${scheduleKind}`),
    // A grid is settled at the rentrée and changes a few times a year.
    staleTime: 10 * 60_000,
  });
}

// ── Devoirs et contrôles ─────────────────────────────────────────────────────

export function useAssessments(
  kind?: "DEVOIR" | "CONTROLE",
): UseQueryResult<Assessment[]> {
  return useQuery({
    queryKey: ["assessments", kind ?? "ALL"],
    queryFn: () =>
      api<Assessment[]>(`/teacher/assessments${kind ? `?kind=${kind}` : ""}`),
  });
}

export function useMarkSheet(assessmentId: string): UseQueryResult<MarkSheet> {
  return useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => api<MarkSheet>(`/teacher/assessments/${assessmentId}`),
    enabled: Boolean(assessmentId),
  });
}

/** One pupil's mark. Posted on its own — see the note on the route. */
export function useSaveMark(
  assessmentId: string,
): UseMutationResult<
  { ok: boolean; reason?: string; sheet: MarkSheet },
  Error,
  {
    enrollmentId: string;
    score: number | null;
    isAbsent: boolean;
    comment?: string | null;
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (mark) =>
      api<{ ok: boolean; reason?: string; sheet: MarkSheet }>(
        `/teacher/assessments/${assessmentId}`,
        { method: "POST", body: JSON.stringify(mark) },
      ),
    onSuccess: (data) => {
      // The server answers with the sheet either way — on a refusal it is the
      // sheet unchanged, which is exactly what the screen should snap back to.
      client.setQueryData<MarkSheet>(["assessment", assessmentId], data.sheet);
      void client.invalidateQueries({ queryKey: ["assessments"] });
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
}

/** Handing the marking in, and taking it back. */
export function useSetAssessmentStatus(
  assessmentId: string,
): UseMutationResult<
  { ok: boolean; reason?: string; status?: string },
  Error,
  "SUBMITTED" | "PUBLISHED"
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (status) =>
      api<{ ok: boolean; reason?: string; status?: string }>(
        `/teacher/assessments/${assessmentId}/status`,
        { method: "POST", body: JSON.stringify({ status }) },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      void client.invalidateQueries({ queryKey: ["assessments"] });
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
}

export function useAssessmentOptions(): UseQueryResult<AssessmentOptions> {
  return useQuery({
    queryKey: ["assessment-options"],
    queryFn: () => api<AssessmentOptions>("/teacher/assessment-options"),
    staleTime: 10 * 60_000,
  });
}

/** Setting a piece of work from the phone. */
export function useCreateAssessment(): UseMutationResult<
  { ok: boolean; reason?: string; assessmentId?: string },
  Error,
  {
    schoolClassId: string;
    subjectId: string;
    termId: string;
    assessmentTypeId: string;
    title: string;
    notes: string | null;
    scheduledOn: string;
    maxScore: number;
    coefficient: number;
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input) =>
      api<{ ok: boolean; reason?: string; assessmentId?: string }>(
        "/teacher/assessments",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["assessments"] });
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
}

// ── Fournitures ──────────────────────────────────────────────────────────────

export function useMySupplyLists(): UseQueryResult<TeacherSupplyList[]> {
  return useQuery({
    queryKey: ["supplies", "mine"],
    queryFn: () => api<TeacherSupplyList[]>("/teacher/supplies"),
  });
}

export function useSupplyOptions(): UseQueryResult<SupplyOptions> {
  return useQuery({
    queryKey: ["supplies", "options"],
    queryFn: () => api<SupplyOptions>("/teacher/supplies/options"),
    // A catalogue is agreed once and rarely touched.
    staleTime: 10 * 60_000,
  });
}

/** Writes a draft. Saving is not sending — see `useSubmitSupplyList`. */
export function useSaveSupplyList(): UseMutationResult<
  { ok: boolean; reason?: string; listId?: string },
  Error,
  {
    listId?: string;
    schoolClassId: string;
    subjectId: string | null;
    title: string;
    notes: string | null;
    items: {
      articleId: string;
      quantity: number | null;
      notes: string | null;
      isRequired: boolean;
    }[];
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input) =>
      api<{ ok: boolean; reason?: string; listId?: string }>(
        "/teacher/supplies",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

/** Hands the list to the direction — the teacher's last move on it. */
export function useSubmitSupplyList(): UseMutationResult<
  { ok: boolean; reason?: string },
  Error,
  string
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (listId: string) =>
      api<{ ok: boolean; reason?: string }>(
        `/teacher/supplies/${listId}/submit`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["supplies"] });
    },
  });
}

/** What this teacher has written, and whether the direction has released it. */
export function useMyRemarks(): UseQueryResult<MyRemark[]> {
  return useQuery({
    queryKey: ["remarks", "mine"],
    queryFn: () => api<MyRemark[]>("/teacher/remarks/mine"),
  });
}

export function useMyPupils(): UseQueryResult<PupilOption[]> {
  return useQuery({
    queryKey: ["teacher", "pupils"],
    queryFn: () => api<PupilOption[]>("/teacher/pupils"),
    // A teacher's roster changes at the rentrée and rarely mid-year.
    staleTime: 10 * 60_000,
  });
}

/** Writes an observation about a pupil the teacher teaches. */
export function useSaveRemark(): UseMutationResult<
  { ok: true },
  Error,
  {
    enrollmentId: string;
    subjectId: string | null;
    kind: string;
    tone: string;
    body: string;
    occurredOn: string;
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (remark) =>
      api<{ ok: true }>("/teacher/remarks", {
        method: "POST",
        body: JSON.stringify(remark),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["teacher"] });
    },
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

/** Le trajet — readable before the départ, unlike the register. */
export function useRunItinerary(runId: string): UseQueryResult<RunItinerary> {
  return useQuery({
    queryKey: ["run", runId, "trajet"],
    queryFn: () => api<RunItinerary>(`/driver/runs/${runId}/trajet`),
    enabled: Boolean(runId),
    // A line's stops are drawn once and rarely moved.
    staleTime: 10 * 60_000,
  });
}

/** One child on the bus, with how to reach their family. */
export function useRunRider(
  runId: string,
  subscriptionId: string,
): UseQueryResult<RunRider> {
  return useQuery({
    queryKey: ["run", runId, "rider", subscriptionId],
    queryFn: () =>
      api<RunRider>(`/driver/runs/${runId}/riders/${subscriptionId}`),
    enabled: Boolean(runId && subscriptionId),
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

export function useChildBulletins(
  studentId: string,
): UseQueryResult<Bulletins> {
  return useQuery({
    queryKey: ["child", studentId, "bulletins"],
    queryFn: () => api<Bulletins>(`/family/children/${studentId}/bulletins`),
    enabled: Boolean(studentId),
    // A bulletin is issued three times a year and never changes afterwards, so
    // this is the one family read that is worth holding on to.
    staleTime: 30 * 60_000,
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

/**
 * Who else is in this child's class.
 *
 * Not cached for long, unlike the other reference-ish reads here: the only
 * thing on it that changes is whose birthday it is today, and a list that went
 * stale overnight would wish the wrong child many happy returns.
 */
export function useClassmates(studentId: string): UseQueryResult<Classmates> {
  return useQuery({
    queryKey: ["child", studentId, "classmates"],
    queryFn: () => api<Classmates>(`/family/children/${studentId}/classmates`),
    enabled: Boolean(studentId),
    staleTime: 60_000,
  });
}

export function useChildSupplies(
  studentId: string,
): UseQueryResult<SupplyList[]> {
  return useQuery({
    queryKey: ["child", studentId, "supplies"],
    queryFn: () => api<SupplyList[]>(`/family/children/${studentId}/supplies`),
    enabled: Boolean(studentId),
    // A list is agreed at the rentrée and rarely touched after.
    staleTime: 10 * 60_000,
  });
}

// ── Les demandes de documents ────────────────────────────────────────────────

/** Every request this household has filed, newest first. */
export function useMyRequests(): UseQueryResult<DocumentRequest[]> {
  return useQuery({
    queryKey: ["requests"],
    queryFn: () => api<DocumentRequest[]>("/family/requests"),
  });
}

/**
 * What one child's school will issue.
 *
 * Keyed on the child, because the catalogue belongs to a school: a parent with
 * children in two schools of the same groupe has two different lists.
 */
export function useRequestTypes(
  studentId: string,
): UseQueryResult<RequestType[]> {
  return useQuery({
    queryKey: ["child", studentId, "request-types"],
    queryFn: () =>
      api<RequestType[]>(`/family/children/${studentId}/request-types`),
    enabled: Boolean(studentId),
    // A school's catalogue changes once a year, if that.
    staleTime: 10 * 60_000,
  });
}

/**
 * Filing one.
 *
 * The refusals come back as data rather than as errors — every one of them is
 * something the parent can act on (say what it is for, or open the request they
 * already have), and none is a failure of the request itself.
 */
export function useFileRequest(): UseMutationResult<
  { ok: boolean; reason?: string; requestId?: string },
  Error,
  {
    studentId: string;
    typeId: string;
    copies: number;
    reason: string | null;
  }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input) =>
      api<{ ok: boolean; reason?: string; requestId?: string }>(
        "/family/requests",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: (result) => {
      if (!result.ok) return;
      void client.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

/** Withdrawing one, while the office has not started on it. */
export function useCancelRequest(): UseMutationResult<
  { ok: boolean; reason?: string },
  Error,
  string
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      api<{ ok: boolean; reason?: string }>(
        `/family/requests/${requestId}/cancel`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

// ── Les notifications ────────────────────────────────────────────────────────

/**
 * The inbox, for whichever space the account is in.
 *
 * ── Polled, and slowly ──────────────────────────────────────────────────────
 * The same reasoning as the badges above and the web bell: nothing here is
 * urgent to the minute, and a socket per phone is not worth running for a
 * school. React Query stops the interval when the app is backgrounded, so this
 * costs nothing while the phone is in a pocket.
 */
export function useNotifications(): UseInfiniteQueryResult<
  InfiniteData<Inbox>
> {
  return useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      api<Inbox>(
        pageParam ? `/notifications?cursor=${pageParam}` : "/notifications",
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    /*
      The same slow poll as before, and it is worth knowing what it costs here:
      on an infinite query `refetchInterval` re-reads *every* page loaded so
      far, not just the newest. In the ordinary case that is one page. Somebody
      who has scrolled back through months has several — but they are actively
      reading the screen while it happens, and the alternative (capping the
      cache with `maxPages`) would throw away the pages they just scrolled
      through, which is the scroll silently not working.
    */
    refetchInterval: 60_000,
  });
}

/**
 * The unread total, wherever the inbox has been scrolled to.
 *
 * Every page carries the same account-wide count, so page one is as good as any
 * — but reading `pages[0]` at each call site would be the sort of detail that
 * gets it wrong once and shows a stale badge for ever.
 */
export function unreadOf(data: InfiniteData<Inbox> | undefined): number {
  return data?.pages[0]?.unread ?? 0;
}

/** What one call marks read. Mirrors `ReadSelector` on the server. */
export type ReadSelector =
  | { id: string }
  | { all: true }
  | { studentId: string; kinds: NotificationKind[] };

/** Whether a line is one of the ones this call just cleared. */
function isCleared(item: AppNotification, input: ReadSelector): boolean {
  if ("all" in input) return true;
  if ("id" in input) return item.id === input.id;
  return item.studentId === input.studentId && input.kinds.includes(item.kind);
}

/**
 * Marks one read, the lot, or everything one screen is about.
 *
 * Answers with the whole refreshed inbox rather than an acknowledgement, so the
 * count on the bell and the dots in the list come from one server answer and
 * cannot end up disagreeing with each other.
 */
export function useMarkNotificationsRead(): UseMutationResult<
  Inbox,
  Error,
  ReadSelector
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api<Inbox>("/notifications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    /*
      The server answers with page one; the screen may be showing five.

      So rather than replacing the cache with that answer — which would throw
      away everything the reader had scrolled through — the read marks are
      applied across every loaded page, and only the *count* is taken from the
      server. Replacing it outright was the obvious thing to write and would
      have made marking one line read jump the list back to the top.
    */
    onSuccess: (fresh, input) => {
      client.setQueryData<InfiniteData<Inbox>>(["notifications"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            unread: fresh.unread,
            items: page.items.map((item) =>
              isCleared(item, input) ? { ...item, isRead: true } : item,
            ),
          })),
        };
      });
    },
  });
}
