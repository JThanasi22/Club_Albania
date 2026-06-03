'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  FileDown,
  Loader2,
  AlertTriangle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAttendanceLang } from '@/lang/attendance';
import {
  CLUB_TEAMS,
  getAttendanceDateKey,
  formatAttendanceDisplayDate,
  type AttendanceRecord,
} from '@/lib/attendance';
import {
  formatSessionDateKey,
  formatSessionRecordedAt,
  type AttendanceSessionSummary,
} from '@/lib/attendanceSession';
import { cn } from '@/lib/utils';

type RosterPlayer = {
  id: string;
  name: string;
  photo: string | null;
  jerseyNumber: number | null;
};

type SessionDetail = AttendanceSessionSummary & {
  players: {
    playerId: string;
    present: boolean;
    name: string;
    photo: string | null;
    jerseyNumber: number | null;
  }[];
};

type MobileStep = 'landing' | 'teams' | 'overwrite' | 'wizard' | 'success' | 'editSession';
type WizardLayout = 'cards' | 'list';

type AttendanceTabProps = {
  players: {
    id: string;
    name: string;
    photo: string | null;
    jerseyNumber: number | null;
    team: string | null;
    active: boolean;
  }[];
  operationInProgress: boolean;
  setOperationInProgress: (v: boolean) => void;
};

const L = getAttendanceLang('sq');

const DIALOG_DETAIL_CLASS =
  'max-h-[min(92dvh,820px)] w-[calc(100vw-1rem)] max-w-2xl gap-0 overflow-hidden p-0 flex flex-col';

const MOBILE_SHELL_CLASS = 'flex flex-col flex-1 min-h-0 overflow-hidden outline-none';
const MOBILE_CARD_CLASS = 'flex flex-1 min-h-0 flex-col overflow-hidden gap-0 py-0';
const MOBILE_CARD_HEADER_CLASS = 'shrink-0 gap-4 pb-4 pt-6';
const MOBILE_CARD_CONTENT_CLASS =
  'flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-y-contain px-6 pb-6';

function PlayerAvatar({
  name,
  photo,
  size = 'md',
}: {
  name: string;
  photo: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-2xl',
  };
  const cls = sizeClasses[size];

  if (photo) {
    return <img src={photo} alt={name} className={cn(cls, 'rounded-full object-cover')} />;
  }

  return (
    <div
      className={cn(
        cls,
        'rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/30',
      )}
    >
      <span className="font-semibold text-orange-600 dark:text-orange-400">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function StatusBadge({ present }: { present: boolean }) {
  if (present) {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600 dark:bg-green-700 dark:text-white">
        {L.statusPresent}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {L.statusAbsent}
    </Badge>
  );
}

function MobilePlayerStatusToggle({
  present,
  disabled,
  onToggle,
}: {
  present: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'shrink-0 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform active:scale-95 disabled:opacity-50',
        present
          ? 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-600'
          : 'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600',
      )}
      aria-label={present ? L.present : L.absent}
    >
      {present ? <Check className="w-5 h-5 stroke-[3]" /> : <X className="w-5 h-5 stroke-[3]" />}
    </button>
  );
}

function PlayerStatusEditor({
  present,
  disabled,
  onChange,
}: {
  present: boolean;
  disabled?: boolean;
  onChange: (present: boolean) => void;
}) {
  return (
    <Select
      value={present ? 'present' : 'absent'}
      onValueChange={(v) => onChange(v === 'present')}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-full min-w-[140px] sm:ml-auto sm:w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="present">{L.present}</SelectItem>
        <SelectItem value="absent">{L.absent}</SelectItem>
      </SelectContent>
    </Select>
  );
}

const WIZARD_SWIPE_TRANSITION = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

export function AttendanceTab({ players, operationInProgress, setOperationInProgress }: AttendanceTabProps) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const todayKey = useMemo(() => getAttendanceDateKey(), []);
  const todayDisplay = formatAttendanceDisplayDate(todayKey);

  const [sessions, setSessions] = useState<AttendanceSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [mobileStep, setMobileStep] = useState<MobileStep>('landing');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardLayout, setWizardLayout] = useState<WizardLayout>('cards');
  const [attendanceByPlayer, setAttendanceByPlayer] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<AttendanceSessionSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editPlayers, setEditPlayers] = useState<SessionDetail['players']>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionTeamFilter, setSessionTeamFilter] = useState<string>('all');
  const [wizardCardExiting, setWizardCardExiting] = useState(false);
  const wizardAdvanceRef = useRef<{ map: Record<string, boolean>; isLast: boolean } | null>(null);
  const wizardListHighlightRef = useRef<HTMLDivElement | null>(null);
  const [wizardListSpotlightIndex, setWizardListSpotlightIndex] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const teamCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of CLUB_TEAMS) m.set(t, 0);
    for (const p of players) {
      if (!p.active || !p.team?.trim()) continue;
      const t = p.team.trim();
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [players]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/attendance/sessions');
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as AttendanceSessionSummary[];
      setSessions(data);
    } catch {
      toast.error(L.toastLoadError);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    return sessions.filter((s) => {
      if (sessionTeamFilter !== 'all' && s.teamName !== sessionTeamFilter) return false;
      if (!q) return true;
      const dateStr = formatSessionDateKey(s.dateKey).toLowerCase();
      const recorded = formatSessionRecordedAt(s.updatedAt).toLowerCase();
      return (
        s.teamName.toLowerCase().includes(q) ||
        dateStr.includes(q) ||
        recorded.includes(q) ||
        s.dateKey.includes(q)
      );
    });
  }, [sessions, sessionSearch, sessionTeamFilter]);

  const detailDirty = useMemo(() => {
    if (!detail) return false;
    return editPlayers.some((ep) => {
      const orig = detail.players.find((p) => p.playerId === ep.playerId);
      return orig != null && orig.present !== ep.present;
    });
  }, [detail, editPlayers]);

  const backToMobileLanding = () => {
    setMobileStep('landing');
    setDetail(null);
    setEditPlayers([]);
    setDetailOpen(false);
  };

  const resetMobileFlow = () => {
    backToMobileLanding();
    setSelectedTeam(null);
    setRoster([]);
    setWizardIndex(0);
    setAttendanceByPlayer({});
    setWizardLayout('cards');
    setWizardCardExiting(false);
    wizardAdvanceRef.current = null;
    setWizardListSpotlightIndex(null);
  };

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.dateKey === todayKey),
    [sessions, todayKey],
  );

  const startFlow = () => {
    setMobileStep('teams');
  };

  const startTeamFlow = async (teamName: string) => {
    setOperationInProgress(true);
    try {
      const [rosterRes, checkRes] = await Promise.all([
        fetch(`/api/attendance/roster?teamName=${encodeURIComponent(teamName)}`),
        fetch(`/api/attendance/check?teamName=${encodeURIComponent(teamName)}`),
      ]);
      if (!rosterRes.ok || !checkRes.ok) throw new Error('load');
      const rosterData = (await rosterRes.json()) as { players: RosterPlayer[] };
      const checkData = (await checkRes.json()) as { exists: boolean };
      if (rosterData.players.length === 0) {
        toast.error(L.emptyTeam);
        return;
      }
      setSelectedTeam(teamName);
      setRoster(rosterData.players);
      setWizardIndex(0);
      setAttendanceByPlayer({});
      setWizardLayout('cards');
      setWizardCardExiting(false);
      wizardAdvanceRef.current = null;
      setWizardListSpotlightIndex(null);
      if (checkData.exists) {
        setMobileStep('overwrite');
      } else {
        setMobileStep('wizard');
      }
    } catch {
      toast.error(L.toastLoadError);
    } finally {
      setOperationInProgress(false);
    }
  };

  const buildAttendanceRecords = useCallback(
    (map: Record<string, boolean>): AttendanceRecord[] =>
      roster.map((p) => ({ playerId: p.id, present: map[p.id] ?? true })),
    [roster],
  );

  const completeWizardCardSwipe = () => {
    const pending = wizardAdvanceRef.current;
    if (!pending) return;
    wizardAdvanceRef.current = null;
    setWizardCardExiting(false);
    setAttendanceByPlayer(pending.map);
    if (pending.isLast) {
      void submitAttendanceWithRecords(buildAttendanceRecords(pending.map));
      return;
    }
    setWizardIndex((i) => i + 1);
  };

  const onMarkPlayer = (present: boolean) => {
    const player = roster[wizardIndex];
    if (!player || wizardCardExiting || operationInProgress) return;
    const nextMap = { ...attendanceByPlayer, [player.id]: present };
    const isLast = wizardIndex + 1 >= roster.length;
    wizardAdvanceRef.current = { map: nextMap, isLast };
    setWizardCardExiting(true);
  };

  const toggleWizardLayout = () => {
    setWizardLayout((v) => (v === 'cards' ? 'list' : 'cards'));
  };

  useEffect(() => {
    if (mobileStep !== 'wizard' || wizardLayout !== 'list') {
      setWizardListSpotlightIndex(null);
      return;
    }
    setWizardListSpotlightIndex(wizardIndex);
    const scrollTimer = window.setTimeout(() => {
      const row = wizardListHighlightRef.current;
      if (!row) return;
      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }, 50);
    const clearTimer = window.setTimeout(() => setWizardListSpotlightIndex(null), 3000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [mobileStep, wizardLayout, wizardIndex]);

  const wizardSwipeTransition = reduceMotion ? { duration: 0 } : WIZARD_SWIPE_TRANSITION;

  const wizardMarkedCount = useMemo(
    () => roster.filter((p) => attendanceByPlayer[p.id] !== undefined).length,
    [roster, attendanceByPlayer],
  );

  const submitAttendanceWithRecords = async (records: AttendanceRecord[]) => {
    if (!selectedTeam) return;
    setOperationInProgress(true);
    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: selectedTeam, records }),
      });
      if (!res.ok) throw new Error('save');
      const saved = (await res.json()) as AttendanceSessionSummary;
      setLastSaved(saved);
      setMobileStep('success');
      setAttendanceByPlayer({});
      await loadSessions();
      toast.success(L.toastSaved);
      if (isMobile) {
        try {
          await triggerSessionPdfDownload(saved.id);
        } catch {
          toast.error(L.toastPdfError);
        }
      }
    } catch {
      toast.error(L.toastSaveError);
    } finally {
      setOperationInProgress(false);
    }
  };

  const loadSessionDetail = async (sessionId: string) => {
    setDetailLoading(true);
    setDetail(null);
    setEditPlayers([]);
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}`);
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as SessionDetail;
      setDetail(data);
      setEditPlayers(data.players);
      return true;
    } catch {
      toast.error(L.toastLoadError);
      setDetail(null);
      setEditPlayers([]);
      return false;
    } finally {
      setDetailLoading(false);
    }
  };

  const openSessionDetail = async (sessionId: string) => {
    setDetailOpen(true);
    const ok = await loadSessionDetail(sessionId);
    if (!ok) setDetailOpen(false);
  };

  const openMobileSessionEdit = async (sessionId: string) => {
    setMobileStep('editSession');
    const ok = await loadSessionDetail(sessionId);
    if (!ok) setMobileStep('landing');
  };

  const saveDetailChanges = async (options?: { returnToLanding?: boolean }) => {
    if (!detail || !detailDirty) return;
    setOperationInProgress(true);
    try {
      const records: AttendanceRecord[] = editPlayers.map((p) => ({
        playerId: p.playerId,
        present: p.present,
      }));
      const res = await fetch(`/api/attendance/sessions/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error('update');
      const updated = (await res.json()) as AttendanceSessionSummary;
      setDetail({ ...detail, ...updated, players: editPlayers });
      setLastSaved(null);
      await loadSessions();
      toast.success(L.toastUpdated);
      if (options?.returnToLanding) {
        backToMobileLanding();
      }
    } catch {
      toast.error(L.toastUpdateError);
    } finally {
      setOperationInProgress(false);
    }
  };

  const deleteSessionById = async (sessionId: string) => {
    setOperationInProgress(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete');
      if (detail?.id === sessionId) {
        if (detailOpen) {
          setDetailOpen(false);
          setDetail(null);
          setEditPlayers([]);
        } else {
          backToMobileLanding();
        }
      }
      await loadSessions();
      toast.success(L.toastDeleted);
    } catch {
      toast.error(L.toastDeleteError);
    } finally {
      setOperationInProgress(false);
    }
  };

  const confirmDeleteSession = (session: AttendanceSessionSummary, e?: MouseEvent) => {
    e?.stopPropagation();
    const dateLabel = formatSessionDateKey(session.dateKey);
    setConfirmDialog({
      open: true,
      title: L.confirmDeleteTitle,
      description: L.confirmDeleteDescription(session.teamName, dateLabel),
      variant: 'destructive',
      onConfirm: () => void deleteSessionById(session.id),
    });
  };

  const setPlayerPresent = (playerId: string, present: boolean) => {
    setEditPlayers((prev) => prev.map((p) => (p.playerId === playerId ? { ...p, present } : p)));
  };

  const triggerSessionPdfDownload = async (sessionId: string) => {
    const res = await fetch(`/api/attendance/sessions/${sessionId}/pdf`);
    if (!res.ok) throw new Error('pdf');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prezenca-${sessionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (sessionId: string) => {
    setOperationInProgress(true);
    try {
      await triggerSessionPdfDownload(sessionId);
    } catch {
      toast.error(L.toastPdfError);
    } finally {
      setOperationInProgress(false);
    }
  };

  const flowDialogMeta = useMemo(() => {
    if (mobileStep === 'teams') {
      return { title: L.chooseTeam, description: L.attendanceForDate(todayDisplay) };
    }
    if (mobileStep === 'overwrite' && selectedTeam) {
      return { title: L.overwriteTitle, description: L.overwriteBody(selectedTeam) };
    }
    if (mobileStep === 'wizard' && selectedTeam && roster[wizardIndex]) {
      return {
        title: L.playerProgress(selectedTeam, wizardIndex + 1, roster.length),
        description: roster[wizardIndex].name,
      };
    }
    if (mobileStep === 'success') {
      return { title: L.successTitle, description: L.pageDescription };
    }
    if (mobileStep === 'editSession' && detail) {
      return {
        title: L.detailTitle(detail.teamName, formatSessionDateKey(detail.dateKey)),
        description: L.detailRecorded(formatSessionRecordedAt(detail.updatedAt)),
      };
    }
    if (mobileStep === 'editSession') {
      return { title: L.todaySessionsTitle, description: L.loading };
    }
    return { title: L.startCta, description: L.pageDescription };
  }, [mobileStep, selectedTeam, roster, wizardIndex, todayDisplay, detail]);

  const teamListUi = (
    <div className="space-y-2">
      {CLUB_TEAMS.map((team) => {
        const count = teamCounts.get(team) ?? 0;
        const disabled = count === 0;
        return (
          <button
            key={team}
            type="button"
            disabled={disabled || operationInProgress}
            onClick={() => void startTeamFlow(team)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors min-h-[56px]',
              disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent/50',
            )}
          >
            <span className="text-lg font-semibold text-foreground">{team}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{disabled ? L.emptyTeam : L.playersCount(count)}</Badge>
              <ChevronRight className="w-5 h-5 shrink-0" />
            </span>
          </button>
        );
      })}
    </div>
  );

  const wizardPlayer = roster[wizardIndex];
  const wizardLayoutToggle = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      disabled={operationInProgress || wizardCardExiting}
      onClick={toggleWizardLayout}
    >
      {wizardLayout === 'cards' ? L.viewList : L.viewCards}
    </Button>
  );

  const wizardCardsUi = wizardPlayer && (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex flex-1 min-h-0 items-center overflow-hidden px-1">
        <motion.div
          key={wizardPlayer.id}
          className="flex w-full flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
          initial={{ opacity: 0, x: 48 }}
          animate={
            wizardCardExiting
              ? { opacity: 0, x: -120, scale: 0.96 }
              : { opacity: 1, x: 0, scale: 1 }
          }
          transition={wizardSwipeTransition}
          onAnimationComplete={() => {
            if (wizardCardExiting) completeWizardCardSwipe();
          }}
        >
          <PlayerAvatar name={wizardPlayer.name} photo={wizardPlayer.photo} size="lg" />
          <div className="text-center">
            <p className="text-xl font-semibold text-foreground">{wizardPlayer.name}</p>
            {wizardPlayer.jerseyNumber != null && (
              <p className="text-sm text-muted-foreground mt-1">Nr. {wizardPlayer.jerseyNumber}</p>
            )}
          </div>
        </motion.div>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={operationInProgress || wizardCardExiting}
          onClick={() => onMarkPlayer(true)}
        >
          <CheckCircle2 className="w-5 h-5" />
          {L.present}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full"
          disabled={operationInProgress || wizardCardExiting}
          onClick={() => onMarkPlayer(false)}
        >
          {L.absent}
        </Button>
      </div>
    </div>
  );

  const wizardListUi = (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <p className="text-xs text-muted-foreground shrink-0">{L.tapStatusToToggle}</p>
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto -mx-1 px-1">
        {roster.map((p, index) => {
          const present = attendanceByPlayer[p.id] ?? true;
          const showSpotlight = wizardListSpotlightIndex === index;
          return (
            <div
              key={p.id}
              ref={showSpotlight ? wizardListHighlightRef : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm',
                !present && 'bg-red-50 dark:bg-red-950/40',
                showSpotlight && 'player-row-spotlight player-row-spotlight-3s',
              )}
            >
              <PlayerAvatar name={p.name} photo={p.photo} size="sm" />
              <span className="flex-1 min-w-0 font-medium text-sm text-foreground truncate">{p.name}</span>
              <MobilePlayerStatusToggle
                present={present}
                disabled={operationInProgress}
                onToggle={() =>
                  setAttendanceByPlayer((prev) => ({ ...prev, [p.id]: !(prev[p.id] ?? true) }))
                }
              />
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        size="lg"
        className="w-full shrink-0"
        disabled={operationInProgress}
        onClick={() => void submitAttendanceWithRecords(buildAttendanceRecords(attendanceByPlayer))}
      >
        {L.saveAttendance}
      </Button>
    </div>
  );

  const wizardBodyUi = selectedTeam && roster.length > 0 && (
    <div className="flex flex-col flex-1 min-h-0 gap-4 py-2">
      <div className="flex shrink-0 items-center gap-3">
        <Progress
          value={
            wizardLayout === 'cards'
              ? ((wizardIndex + 1) / roster.length) * 100
              : (wizardMarkedCount / roster.length) * 100
          }
          className="h-2 flex-1"
        />
        {wizardLayoutToggle}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {wizardLayout === 'cards' ? wizardCardsUi : wizardListUi}
      </div>
    </div>
  );

  const mobileTodaySessionsUi = (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{L.todaySessionsTitle}</h3>
      {sessionsLoading ? (
        <p className="text-sm text-muted-foreground py-2">{L.loading}</p>
      ) : todaySessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{L.emptyTodaySessions}</p>
      ) : (
        <div className="space-y-2">
          {todaySessions.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={operationInProgress}
              onClick={() => void openMobileSessionEdit(s.id)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors min-h-[56px]',
                'hover:bg-accent/50 active:bg-accent/70',
              )}
            >
              <span className="text-lg font-semibold text-foreground">{s.teamName}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                <Badge variant="secondary">
                  {s.presentCount}/{s.totalCount}
                </Badge>
                <ChevronRight className="w-5 h-5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const mobileEditSessionUi = (
    <>
      {detailLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : detail ? (
        <div className="flex flex-1 min-h-0 flex-col gap-4">
          <p className="text-xs text-muted-foreground shrink-0">{L.tapStatusToToggle}</p>
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto -mx-1 px-1">
            {editPlayers.map((p) => (
              <div
                key={p.playerId}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm',
                  !p.present && 'bg-red-50 dark:bg-red-950/40',
                )}
              >
                <PlayerAvatar name={p.name} photo={p.photo} size="sm" />
                <span className="flex-1 min-w-0 font-medium text-sm text-foreground truncate">{p.name}</span>
                <MobilePlayerStatusToggle
                  present={p.present}
                  disabled={operationInProgress}
                  onToggle={() => setPlayerPresent(p.playerId, !p.present)}
                />
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full shrink-0"
            disabled={operationInProgress || !detailDirty}
            onClick={() => void saveDetailChanges({ returnToLanding: true })}
          >
            {operationInProgress ? L.saving : L.saveChanges}
          </Button>
        </div>
      ) : null}
    </>
  );

  const successBodyUi = lastSaved && (
    <div className="space-y-6 py-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-600 dark:text-green-400" />
      </div>
      <div className="rounded-lg bg-muted/50 dark:bg-gray-800 p-4 space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">{L.successTeam}:</span>{' '}
          <span className="font-medium text-foreground">{lastSaved.teamName}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{L.successDate}:</span>{' '}
          <span className="font-medium text-foreground">{formatSessionDateKey(lastSaved.dateKey)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">{L.successPresent}:</span>{' '}
          <span className="font-medium text-foreground">
            {lastSaved.presentCount} / {lastSaved.totalCount}
          </span>
        </p>
      </div>
    </div>
  );

  const detailDialog = (
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className={DIALOG_DETAIL_CLASS}>
        {detailLoading || !detail ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{L.historyTitle}</DialogTitle>
              <DialogDescription>{L.loading}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-16 px-6">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 space-y-1 px-6 pt-6 pb-4 pr-12 text-left">
              <DialogTitle>{L.detailTitle(detail.teamName, formatSessionDateKey(detail.dateKey))}</DialogTitle>
              <DialogDescription>{L.detailRecorded(formatSessionRecordedAt(detail.updatedAt))}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6">
              <div className="hidden sm:block overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{L.colPhoto}</TableHead>
                      <TableHead>{L.colPlayer}</TableHead>
                      <TableHead className="w-[160px]">{L.colStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editPlayers.map((p) => (
                      <TableRow
                        key={p.playerId}
                        className={cn(
                          !p.present &&
                            'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950/60',
                        )}
                      >
                        <TableCell>
                          <PlayerAvatar name={p.name} photo={p.photo} size="sm" />
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <PlayerStatusEditor
                            present={p.present}
                            disabled={operationInProgress}
                            onChange={(value) => setPlayerPresent(p.playerId, value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="sm:hidden space-y-2 pb-2">
                {editPlayers.map((p) => (
                  <div
                    key={p.playerId}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar name={p.name} photo={p.photo} size="sm" />
                      <span className="flex-1 font-medium text-sm text-foreground">{p.name}</span>
                    </div>
                    <PlayerStatusEditor
                      present={p.present}
                      disabled={operationInProgress}
                      onChange={(value) => setPlayerPresent(p.playerId, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto sm:mr-auto"
                disabled={operationInProgress}
                onClick={() =>
                  confirmDeleteSession({
                    id: detail.id,
                    teamName: detail.teamName,
                    dateKey: detail.dateKey,
                    sessionDate: detail.sessionDate,
                    createdAt: detail.createdAt,
                    updatedAt: detail.updatedAt,
                    presentCount: detail.presentCount,
                    totalCount: detail.totalCount,
                  })
                }
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {L.deleteSession}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => downloadPdf(detail.id)}
                disabled={operationInProgress}
              >
                <FileDown className="w-4 h-4 mr-2" />
                {L.exportPdf}
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={operationInProgress || !detailDirty}
                onClick={() => void saveDetailChanges()}
              >
                {operationInProgress ? L.saving : L.saveChanges}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDetailOpen(false)}>
                {L.close}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  if (isMobile && mobileStep !== 'landing') {
    return (
      <div className={MOBILE_SHELL_CLASS}>
        <Card className={MOBILE_CARD_CLASS}>
          <CardHeader className={MOBILE_CARD_HEADER_CLASS}>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit -ml-2"
                onClick={mobileStep === 'editSession' ? backToMobileLanding : resetMobileFlow}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {L.back}
              </Button>
            </div>
            {mobileStep !== 'overwrite' && (
              <>
                <CardTitle>{flowDialogMeta.title}</CardTitle>
                <CardDescription>{flowDialogMeta.description}</CardDescription>
              </>
            )}
            {mobileStep === 'overwrite' && selectedTeam && (
              <>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  {L.overwriteTitle}
                </CardTitle>
                <CardDescription>{L.overwriteBody(selectedTeam)}</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className={MOBILE_CARD_CONTENT_CLASS}>
            {mobileStep === 'teams' && teamListUi}
            {mobileStep === 'overwrite' && selectedTeam && (
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" onClick={() => setMobileStep('teams')}>
                  {L.cancel}
                </Button>
                <Button type="button" onClick={() => setMobileStep('wizard')}>
                  {L.overwriteConfirm}
                </Button>
              </div>
            )}
            {mobileStep === 'wizard' && wizardBodyUi}
            {mobileStep === 'editSession' && mobileEditSessionUi}
            {mobileStep === 'success' && (
              <>
                {successBodyUi}
                <Button type="button" className="w-full mt-4" onClick={resetMobileFlow}>
                  {L.successBack}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        {detailDialog}
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog((c) => ({ ...c, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          variant={confirmDialog.variant}
          confirmText={L.deleteSession}
          cancelText={L.cancel}
        />
      </div>
    );
  }

  if (isMobile && mobileStep === 'landing') {
    return (
      <div className={MOBILE_SHELL_CLASS}>
        <Card className={MOBILE_CARD_CLASS}>
          <CardHeader className={MOBILE_CARD_HEADER_CLASS}>
            <CardTitle>{L.pageTitle}</CardTitle>
            <CardDescription>{L.pageDescription}</CardDescription>
          </CardHeader>
          <CardContent className={cn(MOBILE_CARD_CONTENT_CLASS, 'space-y-6')}>
            {mobileTodaySessionsUi}
            <Button
              type="button"
              onClick={startFlow}
              disabled={operationInProgress}
              className="w-full"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {L.startCta}
            </Button>
          </CardContent>
        </Card>
        {detailDialog}
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog((c) => ({ ...c, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          variant={confirmDialog.variant}
          confirmText={L.deleteSession}
          cancelText={L.cancel}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 overflow-y-auto outline-none">
      <Card className="flex flex-col flex-1 min-h-0">
        <CardHeader className="shrink-0 space-y-4">
          <CardTitle>{L.historyTitle}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={L.searchPlaceholder}
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sessionTeamFilter} onValueChange={setSessionTeamFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={L.filterTeam} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L.filterAllTeams}</SelectItem>
                {CLUB_TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          {sessionsLoading ? (
            <p className="text-center text-muted-foreground py-10">{L.loading}</p>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">{L.emptySessions}</p>
          ) : filteredSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">{L.emptyFilter}</p>
          ) : (
            <Table stickyHorizontalScroll>
              <TableHeader>
                <TableRow>
                  <TableHead>{L.colDate}</TableHead>
                  <TableHead>{L.colTeam}</TableHead>
                  <TableHead>{L.colPresentTotal}</TableHead>
                  <TableHead>{L.colRecorded}</TableHead>
                  <TableHead className="text-right w-[100px]">{L.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => openSessionDetail(s.id)}
                  >
                    <TableCell>{formatSessionDateKey(s.dateKey)}</TableCell>
                    <TableCell className="font-medium">{s.teamName}</TableCell>
                    <TableCell>
                      {s.presentCount}/{s.totalCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatSessionRecordedAt(s.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={operationInProgress}
                        title={L.deleteSession}
                        onClick={(e) => confirmDeleteSession(s, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {detailDialog}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((c) => ({ ...c, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={L.deleteSession}
        cancelText={L.cancel}
      />
    </div>
  );
}

