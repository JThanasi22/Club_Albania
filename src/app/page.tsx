'use client';

import { useState, useEffect, useRef, useMemo, type MouseEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { AnimatedText } from '@/components/AnimatedText';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Users, TrendingUp, Calendar, Plus, Pencil, Trash2,
  CheckCircle, UserPlus, CreditCard, Search, Wallet,
  Volleyball, Eye, LogOut, Lock, Loader2, Camera, X, FileDown, MessageCircle, LayoutGrid, Image as ImageIcon, ChevronLeft, ChevronRight, ClipboardCheck
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { sq as dateFnsSq } from 'date-fns/locale/sq';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import {
  normalizePhoneForWhatsApp,
  buildPaymentReminderMessage,
  formatDueDateForPaymentReminder,
  getPaymentReminderWhatsAppHref,
  getWhatsAppHref,
} from '@/lib/whatsappPaymentReminder';
import { getPlayerPaymentSummary, type PaymentEntry } from '@/lib/playerPaymentSummary';
import { getDashboardLang } from '@/lang/dashboard';
import { getTeamsLang } from '@/lang/teams';
import { getAttendanceLang } from '@/lang/attendance';
import { AttendanceTab } from '@/components/AttendanceTab';
import { parseFormationSlots, type FormationSlot } from '@/lib/teamFormation';
import {
  parseVolleyballSets,
  formatVolleyballSetsSummary,
  parseSetDraftRows,
} from '@/lib/volleyballMatchSets';
import { cn } from '@/lib/utils';
import MatchResultGraphic from '@/components/MatchResultGraphic';
import { buildMatchResultDataFromRow } from '@/lib/cloudinary-utils';

interface Player {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  team: string | null;
  jerseyNumber: number | null;
  photo: string | null;
  joinDate: string;
  dateOfBirth?: string | null;
  active: boolean;
  totalPayment?: number;
  paymentHistory?: PaymentEntry[];
  payments?: unknown[];
}

interface Stats {
  totalPlayers: number;
  activePlayerCount: number;
  inactivePlayerCount: number;
  totalExpectedAmount?: number;
  amountCollectedAllTime?: number;
  currentMonth: {
    month: number;
    year: number;
    paid: number;
    pending: number;
    totalExpected: number;
    collectionRate: number;
    amountCollected: number;
  };
  allTime: {
    paid: number;
    pending: number;
    overdue: number;
    totalExpected: number;
    collectionRate: number;
    amountCollected: number;
  };
  overall: {
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  recentPayments: { id: string; amount: number; paidDate: string; player: { id: string; name: string } }[];
  playersWithUnpaidBills: Player[];
  teamMatches: {
    id: string;
    teamName: string;
    matchDate: string;
    opponent: string;
    isHome: boolean;
    venue: string | null;
  }[];
}

interface AdminUser {
  id: string;
  username: string;
  name: string | null;
}

interface TeamMatchRow {
  id: string;
  teamName: string;
  matchDate: string;
  opponent: string;
  venue: string | null;
  isHome: boolean;
  ourScore: number | null;
  theirScore: number | null;
  volleyballSets?: unknown;
  notes: string | null;
}

const MONTHS = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
];

const TEAMS = [
  'U20', 'U18', 'U16', 'U14', 'U10'
];

const DASHBOARD_CARD_MODAL_HINT_MIN_ITEMS = 6;

const dl = getDashboardLang('sq');
const teamsL = getTeamsLang('sq');
const attendanceL = getAttendanceLang('sq');

// Format currency in ALL (Albanian Lek)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sq-AL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ALL';
};

const formatDateDDMMYYYY = (isoDate: string) => {
  if (!isoDate) return '';
  try {
    const d = parse(isoDate, 'yyyy-MM-dd', new Date());
    return format(d, 'dd/MM/yyyy');
  } catch {
    return isoDate;
  }
};

const formatDateDisplay = (val: string | Date | null | undefined): string => {
  if (val == null) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy');
};

function localDayKeyFromMatchIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function isTeamMatchFinished(matchDateIso: string): boolean {
  const d = new Date(matchDateIso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const startMatch = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return startNow >= startMatch;
}

const MAX_VOLLEY_SETS = 5;

function defaultPaymentDeadlineIsoYyyyMmDd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const deadlineThisYear = new Date(y, 5, 30, 23, 59, 59, 999);
  if (now <= deadlineThisYear) {
    return `${y}-06-30`;
  }
  return `${y + 1}-06-30`;
}

export default function VolleyballTeamManager() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerPaymentFilter, setPlayerPaymentFilter] = useState('all');
  const [playerPaymentSort, setPlayerPaymentSort] = useState('none');
  const [dashboardListModal, setDashboardListModal] = useState<null | 'recentPayments' | 'unpaid'>(null);
  const [dashboardListSearch, setDashboardListSearch] = useState('');
  const [playerRowSpotlightId, setPlayerRowSpotlightId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [matchCalendarMonth, setMatchCalendarMonth] = useState(() => new Date());
  const [matchCalendarSelected, setMatchCalendarSelected] = useState<Date | undefined>(undefined);
  const [dashboardCalendarTeamFilter, setDashboardCalendarTeamFilter] = useState<string[]>(() => [...TEAMS]);

  const [teamsFormationTeam, setTeamsFormationTeam] = useState<string | null>(null);
  const [teamsFormationSlots, setTeamsFormationSlots] = useState<FormationSlot[]>([]);
  const [teamsFormationLoading, setTeamsFormationLoading] = useState(false);
  const [teamsFormationSaving, setTeamsFormationSaving] = useState(false);

  const [teamsMatchesTeam, setTeamsMatchesTeam] = useState<string | null>(null);
  const [teamsMatchesList, setTeamsMatchesList] = useState<TeamMatchRow[]>([]);
  const [teamsMatchesLoading, setTeamsMatchesLoading] = useState(false);
  const [newMatchOpponent, setNewMatchOpponent] = useState('');
  const [newMatchDate, setNewMatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newMatchVenue, setNewMatchVenue] = useState('');
  const [newMatchIsHome, setNewMatchIsHome] = useState(true);
  const [newMatchNotes, setNewMatchNotes] = useState('');
  const [matchSubmitting, setMatchSubmitting] = useState(false);
  const [addMatchModalOpen, setAddMatchModalOpen] = useState(false);
  const [addMatchOurTeam, setAddMatchOurTeam] = useState(TEAMS[0]);
  const [matchScoreDrafts, setMatchScoreDrafts] = useState<
    Record<string, { sets: { our: string; their: string }[] }>
  >({});
  const [matchResultSavingId, setMatchResultSavingId] = useState<string | null>(null);
  const [resultGraphicMatchId, setResultGraphicMatchId] = useState<string | null>(null);

  // Photo state
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addPaymentPlayer, setAddPaymentPlayer] = useState<Player | null>(null);
  const [addPaymentAmount, setAddPaymentAmount] = useState('');
  const [addPaymentDate, setAddPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [addPaymentDatePickerOpen, setAddPaymentDatePickerOpen] = useState(false);

  const [editingPaymentEntry, setEditingPaymentEntry] = useState<{ player: Player; index: number; amount: string; date: string } | null>(null);
  const [editPaymentDatePickerOpen, setEditPaymentDatePickerOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {}, variant: 'default' });

  const showConfirmDialog = (
    title: string,
    description: string,
    onConfirm: () => void,
    variant: 'default' | 'destructive' = 'default'
  ) => {
    setConfirmDialog({ open: true, title, description, onConfirm, variant });
  };

  const [playerForm, setPlayerForm] = useState({
    name: '',
    email: '',
    phone: '',
    team: '',
    jerseyNumber: '',
    joinDate: new Date().toISOString().split('T')[0],
    dateOfBirth: '',
    active: true,
    totalPayment: '',
  });

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setAuthenticated(data.authenticated);
      if (data.authenticated && data.admin) {
        setAdmin(data.admin);
      }
    } catch {
      setAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setOperationInProgress(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();

      if (data.success) {
        setAuthenticated(true);
        setAdmin(data.admin);
        toast.success('Hyrja u krye me sukses!');
      } else {
        toast.error(data.error || 'Hyrja dështoi');
      }
    } catch {
      toast.error('Hyrja dështoi');
    } finally {
      setLoginLoading(false);
      setOperationInProgress(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthenticated(false);
      setAdmin(null);
      toast.success('Dalja u krye me sukses');
    } catch {
      toast.error('Dalja dështoi');
    }
  };

  // Fetch data
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.totalPlayers !== undefined) {
        setStats({
          ...data,
          teamMatches: Array.isArray(data.teamMatches) ? data.teamMatches : [],
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlayers(data);
      } else {
        setPlayers([]);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
      setPlayers([]);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([fetchStats(), fetchPlayers()]);
  };

  useEffect(() => {
    if (authenticated) {
      const initFetch = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchPlayers()]);
        setLoading(false);
      };
      initFetch();
    }
  }, [authenticated]);

  // Handle photo upload to Cloudinary
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoUploading(true);
      setOperationInProgress(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Ngarkimi i fotos dështoi');
        }

        const data = await res.json();
        setPlayerPhoto(data.url);
        toast.success('Fotoja u ngarkua me sukses');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ngarkimi i fotos dështoi');
      } finally {
        setPhotoUploading(false);
        setOperationInProgress(false);
      }
    }
  };

  const removePhoto = () => {
    setPlayerPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadPlayerPaymentPdf = async (player: Player) => {
    setOperationInProgress(true);
    try {
      const res = await fetch(`/api/players/${player.id}/payment-pdf`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/pdf' },
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        let msg = 'Gjenerimi i PDF dështoi';
        if (contentType.includes('application/json')) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          if (err.error) msg = err.error;
        }
        throw new Error(msg);
      }
      if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        throw new Error('Gjenerimi i PDF dështoi');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const cd = res.headers.get('Content-Disposition');
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `pagesat-${player.name.replace(/\s+/g, '_')}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 30_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gjenerimi i PDF dështoi');
    } finally {
      setOperationInProgress(false);
    }
  };

  const onPlayerPaymentPdfClick = (player: Player) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void handleDownloadPlayerPaymentPdf(player);
  };

  const openWhatsappPaymentReminder = (player: Player) => {
    const digits = normalizePhoneForWhatsApp(player.phone);
    if (!digits) return;
    const { amountLeft } = getPlayerPaymentSummary(player);
    const amt = formatCurrency(Math.max(0, amountLeft));
    const dueDisplay = formatDueDateForPaymentReminder(defaultPaymentDeadlineIsoYyyyMmDd());
    const msg = buildPaymentReminderMessage(amt, dueDisplay);
    const href = getPaymentReminderWhatsAppHref(digits, msg);
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const broadcastRecipients = useMemo(
    () => (players || []).filter((p) => normalizePhoneForWhatsApp(p.phone)),
    [players]
  );
  const broadcastSkippedCount = (players || []).length - broadcastRecipients.length;

  const openBroadcastDialog = () => {
    setBroadcastMessage('');
    setBroadcastIndex(0);
    setBroadcastOpen(true);
  };

  const sendBroadcastToCurrent = () => {
    const player = broadcastRecipients[broadcastIndex];
    if (!player) return;
    const digits = normalizePhoneForWhatsApp(player.phone);
    if (digits) {
      const href = getWhatsAppHref(digits, broadcastMessage);
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    setBroadcastIndex((i) => i + 1);
  };

  const goBackBroadcast = () => {
    setBroadcastIndex((i) => Math.max(0, i - 1));
  };

  // Player CRUD operations
  const handleCreatePlayer = async () => {
    setOperationInProgress(true);
    try {
      const totalPayment = playerForm.totalPayment ? parseFloat(String(playerForm.totalPayment)) : 0;
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...playerForm, photo: playerPhoto, totalPayment: Number.isNaN(totalPayment) ? 0 : totalPayment }),
      });
      if (!res.ok) throw new Error('Failed to create player');
      toast.success('Lojtari u shtua me sukses');
      setPlayerDialogOpen(false);
      resetPlayerForm();
      refreshAllData();
    } catch {
      toast.error('Shtimi i lojtarit dështoi');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    setOperationInProgress(true);
    try {
      const totalPayment = playerForm.totalPayment ? parseFloat(String(playerForm.totalPayment)) : 0;
      const res = await fetch(`/api/players/${editingPlayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...playerForm,
          photo: playerPhoto !== undefined ? playerPhoto : editingPlayer.photo,
          totalPayment: Number.isNaN(totalPayment) ? 0 : totalPayment,
        }),
      });
      if (!res.ok) throw new Error('Failed to update player');
      toast.success('Lojtari u përditësua me sukses');
      setPlayerDialogOpen(false);
      setEditingPlayer(null);
      resetPlayerForm();
      refreshAllData();
    } catch {
      toast.error('Përditësimi i lojtarit dështoi');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleAddPayment = async () => {
    if (!addPaymentPlayer) return;
    const amount = parseFloat(addPaymentAmount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Vendosni një shumë të vlefshme');
      return;
    }
    if (!addPaymentDate.trim()) {
      toast.error('Vendosni datën');
      return;
    }
    setOperationInProgress(true);
    try {
      const res = await fetch(`/api/players/${addPaymentPlayer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, date: addPaymentDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Shtimi i pagesës dështoi');
      toast.success('Pagesa u shtua');
      setAddPaymentPlayer(null);
      setAddPaymentAmount('');
      setAddPaymentDate(new Date().toISOString().split('T')[0]);
      fetchPlayers();
      fetchStats();
      if (viewingPlayer?.id === addPaymentPlayer.id) setViewingPlayer(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Shtimi i pagesës dështoi');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleUpdatePaymentInHistory = async () => {
    if (!editingPaymentEntry) return;
    const amount = Number.parseFloat(editingPaymentEntry.amount.replace(/,/g, '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Vendosni një shumë të vlefshme');
      return;
    }
    if (!editingPaymentEntry.date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(editingPaymentEntry.date)) {
      toast.error('Vendosni një datë të vlefshme (yyyy-MM-dd)');
      return;
    }
    const history = [...(editingPaymentEntry.player.paymentHistory ?? [])];
    if (editingPaymentEntry.index < 0 || editingPaymentEntry.index >= history.length) return;
    history[editingPaymentEntry.index] = { amount, date: editingPaymentEntry.date };
    setOperationInProgress(true);
    try {
      const res = await fetch(`/api/players/${editingPaymentEntry.player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentHistory: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Përditësimi dështoi');
      toast.success('Pagesa u përditësua');
      setEditingPaymentEntry(null);
      fetchPlayers();
      fetchStats();
      if (viewingPlayer?.id === editingPaymentEntry.player.id) setViewingPlayer(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Përditësimi dështoi');
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleDeletePaymentFromHistory = (player: Player, index: number) => {
    showConfirmDialog(
      'Fshi pagesën',
      'A jeni të sigurt që doni të fshini këtë regjistrim pagese?',
      async () => {
        const history = [...(player.paymentHistory ?? [])];
        if (index < 0 || index >= history.length) return;
        history.splice(index, 1);
        setOperationInProgress(true);
        try {
          const res = await fetch(`/api/players/${player.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentHistory: history }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Fshirja dështoi');
          toast.success('Pagesa u fshi');
          fetchPlayers();
          fetchStats();
          if (viewingPlayer?.id === player.id) setViewingPlayer(data);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Fshirja dështoi');
        } finally {
          setOperationInProgress(false);
        }
      },
      'destructive'
    );
  };

  const handleDeletePlayer = async (id: string) => {
    showConfirmDialog(
      'Fshi Lojtarin',
      'A jeni të sigurt që doni të fshini këtë lojtar? Të gjitha pagesat e tij do të fshihen gjithashtu.',
      async () => {
        setOperationInProgress(true);
        try {
          const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete player');
          toast.success('Lojtari u fshi me sukses');
          refreshAllData();
        } catch {
          toast.error('Fshirja e lojtarit dështoi');
        } finally {
          setOperationInProgress(false);
        }
      },
      'destructive'
    );
  };

  // Reset forms
  const resetPlayerForm = () => {
    setPlayerForm({
      name: '',
      email: '',
      phone: '',
      team: '',
      jerseyNumber: '',
      joinDate: new Date().toISOString().split('T')[0],
      dateOfBirth: '',
      active: true,
      totalPayment: '',
    });
    setPlayerPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({
      name: player.name,
      email: player.email || '',
      phone: player.phone || '',
      team: player.team || '',
      jerseyNumber: player.jerseyNumber?.toString() || '',
      joinDate: new Date(player.joinDate).toISOString().split('T')[0],
      dateOfBirth: player.dateOfBirth
        ? new Date(player.dateOfBirth).toISOString().split('T')[0]
        : '',
      active: player.active,
      totalPayment: (player.totalPayment ?? 0) > 0 ? String(player.totalPayment) : '',
    });
    setPlayerPhoto(player.photo);
    setPlayerDialogOpen(true);
  };

  // Filter players
  const filteredPlayers = (players || []).filter((player) => {
    const searchTerm = playerSearch.toLowerCase();
    const matchesSearch =
      player?.name?.toLowerCase().includes(searchTerm) ||
      player?.email?.toLowerCase().includes(searchTerm) ||
      player?.team?.toLowerCase().includes(searchTerm) ||
      (player?.jerseyNumber != null && String(player.jerseyNumber).includes(playerSearch));

    const { amountLeft } = getPlayerPaymentSummary(player);
    const matchesPaymentFilter =
      playerPaymentFilter === 'all' ||
      (playerPaymentFilter === 'withBalance' && amountLeft > 0) ||
      (playerPaymentFilter === 'paid' && amountLeft === 0) ||
      (playerPaymentFilter === 'credit' && amountLeft < 0);

    return matchesSearch && matchesPaymentFilter;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (playerPaymentSort === 'highestBalance') {
      return getPlayerPaymentSummary(b).amountLeft - getPlayerPaymentSummary(a).amountLeft;
    }

    if (playerPaymentSort === 'lowestBalance') {
      return getPlayerPaymentSummary(a).amountLeft - getPlayerPaymentSummary(b).amountLeft;
    }

    return 0;
  });

  const sortedPlayerIdsKey = sortedPlayers.map((p) => p.id).join(',');

  const goToPlayersRowFromUnpaid = (player: Player) => {
    const { amountLeft } = getPlayerPaymentSummary(player);
    const wouldHide =
      (playerPaymentFilter === 'paid' && amountLeft !== 0) ||
      (playerPaymentFilter === 'credit' && amountLeft >= 0) ||
      (playerPaymentFilter === 'withBalance' && amountLeft <= 0);
    if (wouldHide) setPlayerPaymentFilter('all');
    setPlayerSearch('');
    setDashboardListModal(null);
    setDashboardListSearch('');
    setPlayerRowSpotlightId(player.id);
    setActiveTab('players');
  };

  useEffect(() => {
    if (!playerRowSpotlightId) return;
    const t = window.setTimeout(() => {
      setPlayerRowSpotlightId(null);
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#player-row-')) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [playerRowSpotlightId]);

  useEffect(() => {
    if (activeTab !== 'players' || !playerRowSpotlightId) return;
    if (!sortedPlayers.some((p) => p.id === playerRowSpotlightId)) return;
    const id = playerRowSpotlightId;
    const t = window.setTimeout(() => {
      const nodes = document.querySelectorAll<HTMLElement>(`[data-player-row="${id}"]`);
      let el: HTMLElement | null = null;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].offsetParent !== null) {
          el = nodes[i];
          break;
        }
      }
      if (!el) el = nodes[0] ?? null;
      if (!el) return;
      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      window.history.replaceState(null, '', `#player-row-${id}`);
    }, 50);
    return () => window.clearTimeout(t);
  }, [activeTab, playerRowSpotlightId, sortedPlayerIdsKey, playerSearch, playerPaymentFilter]);

  const openDashboardListModal = (kind: 'recentPayments' | 'unpaid') => {
    setDashboardListSearch('');
    setDashboardListModal(kind);
  };

  const teamRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of players) {
      if (!p.active) continue;
      const t = (p.team || '').trim();
      if (!t) continue;
      m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [players]);

  const resetNewMatchForm = () => {
    setNewMatchOpponent('');
    setNewMatchDate(new Date().toISOString().split('T')[0]);
    setNewMatchVenue('');
    setNewMatchIsHome(true);
    setNewMatchNotes('');
    setAddMatchOurTeam(TEAMS[0]);
  };

  const openTeamsFormation = async (teamName: string) => {
    setTeamsFormationTeam(teamName);
    setTeamsFormationLoading(true);
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamName)}/formation`);
      const data = (await res.json()) as { slots?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || 'fetch');
      const saved = parseFormationSlots(data.slots);
      const roster = players.filter((p) => p.active && (p.team || '').trim() === teamName);
      const byId = new Map(saved.map((s) => [s.playerId, s]));
      const merged: FormationSlot[] = roster.map((p) => {
        const s = byId.get(p.id);
        return s ?? { playerId: p.id, position: '', inSquad: true };
      });
      setTeamsFormationSlots(merged);
    } catch {
      toast.error(teamsL.toastFormationError);
      setTeamsFormationTeam(null);
    } finally {
      setTeamsFormationLoading(false);
    }
  };

  const saveTeamsFormation = async () => {
    if (!teamsFormationTeam) return;
    setTeamsFormationSaving(true);
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamsFormationTeam)}/formation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: teamsFormationSlots }),
      });
      if (!res.ok) throw new Error();
      toast.success(teamsL.toastFormationSaved);
      setTeamsFormationTeam(null);
    } catch {
      toast.error(teamsL.toastFormationError);
    } finally {
      setTeamsFormationSaving(false);
    }
  };

  const reloadTeamsMatches = async () => {
    if (!teamsMatchesTeam) return;
    const res = await fetch(`/api/teams/${encodeURIComponent(teamsMatchesTeam)}/matches`);
    const data = await res.json();
    setTeamsMatchesList(Array.isArray(data) ? data : []);
  };

  const openTeamsMatches = async (teamName: string) => {
    setTeamsMatchesTeam(teamName);
    setTeamsMatchesLoading(true);
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamName)}/matches`);
      const data = await res.json();
      setTeamsMatchesList(Array.isArray(data) ? data : []);
    } catch {
      toast.error(teamsL.toastMatchError);
      setTeamsMatchesTeam(null);
    } finally {
      setTeamsMatchesLoading(false);
    }
  };

  const submitAddMatchModal = async () => {
    if (!addMatchOurTeam || !newMatchOpponent.trim()) return;
    setMatchSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(addMatchOurTeam)}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponent: newMatchOpponent.trim(),
          matchDate: new Date(newMatchDate).toISOString(),
          venue: newMatchVenue.trim() || null,
          isHome: newMatchIsHome,
          volleyballSets: null,
          notes: newMatchNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(teamsL.toastMatchAdded);
      resetNewMatchForm();
      setAddMatchModalOpen(false);
      void fetchStats();
      if (teamsMatchesTeam === addMatchOurTeam) void reloadTeamsMatches();
    } catch {
      toast.error(teamsL.toastMatchError);
    } finally {
      setMatchSubmitting(false);
    }
  };

  const saveMatchResult = async (matchId: string) => {
    if (!teamsMatchesTeam) return;
    const draft = matchScoreDrafts[matchId];
    if (!draft) return;
    const parsed = parseSetDraftRows(draft.sets);
    if (!parsed.ok) {
      if (parsed.reason === 'tie') {
        toast.error(teamsL.toastSetCannotTie);
      } else {
        toast.error(teamsL.toastSetsInvalid);
      }
      return;
    }
    setMatchResultSavingId(matchId);
    try {
      const res = await fetch(
        `/api/teams/${encodeURIComponent(teamsMatchesTeam)}/matches/${matchId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volleyballSets: parsed.sets }),
        },
      );
      if (!res.ok) throw new Error();
      toast.success(teamsL.toastResultSaved);
      await reloadTeamsMatches();
      void fetchStats();
    } catch {
      toast.error(teamsL.toastResultError);
    } finally {
      setMatchResultSavingId(null);
    }
  };

  const deleteTeamMatch = async (matchId: string) => {
    if (!teamsMatchesTeam) return;
    try {
      const res = await fetch(
        `/api/teams/${encodeURIComponent(teamsMatchesTeam)}/matches/${matchId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      toast.success(teamsL.toastMatchDeleted);
      await reloadTeamsMatches();
      void fetchStats();
    } catch {
      toast.error(teamsL.toastMatchDeleteError);
    }
  };

  useEffect(() => {
    if (!teamsMatchesTeam) {
      setMatchScoreDrafts({});
      return;
    }
    const next: Record<string, { sets: { our: string; their: string }[] }> = {};
    for (const m of teamsMatchesList) {
      const parsed = parseVolleyballSets(m.volleyballSets);
      if (parsed.length > 0) {
        next[m.id] = {
          sets: parsed.map((s) => ({ our: String(s.our), their: String(s.their) })),
        };
      } else {
        next[m.id] = { sets: [{ our: '', their: '' }] };
      }
    }
    setMatchScoreDrafts(next);
  }, [teamsMatchesTeam, teamsMatchesList]);

  const resultGraphicMatch = useMemo(
    () =>
      resultGraphicMatchId === null
        ? null
        : teamsMatchesList.find((m) => m.id === resultGraphicMatchId) ?? null,
    [resultGraphicMatchId, teamsMatchesList],
  );

  useEffect(() => {
    if (resultGraphicMatchId === null) return;
    if (!teamsMatchesList.some((m) => m.id === resultGraphicMatchId)) {
      setResultGraphicMatchId(null);
    }
  }, [teamsMatchesList, resultGraphicMatchId]);

  const dashboardFilteredPayments = useMemo(() => {
    const list = stats?.recentPayments ?? [];
    if (dashboardListModal !== 'recentPayments') return list;
    const q = dashboardListSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const name = (p.player?.name || '').toLowerCase();
      const amt = String(p.amount ?? '');
      const rawDate = (p.paidDate || '').toLowerCase();
      const disp = formatDateDisplay(p.paidDate).toLowerCase();
      return name.includes(q) || amt.includes(q) || rawDate.includes(q) || disp.includes(q);
    });
  }, [stats?.recentPayments, dashboardListSearch, dashboardListModal]);

  const dashboardFilteredUnpaid = useMemo(() => {
    const list = stats?.playersWithUnpaidBills ?? [];
    if (dashboardListModal !== 'unpaid') return list;
    const q = dashboardListSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((player) => {
      const name = player.name.toLowerCase();
      const team = (player.team || '').toLowerCase();
      const { amountLeft } = getPlayerPaymentSummary(player);
      const left = Math.max(0, amountLeft);
      const amtStr = formatCurrency(left).toLowerCase();
      const qCompact = q.replace(/\s/g, '');
      return (
        name.includes(q) ||
        team.includes(q) ||
        String(left).includes(q) ||
        amtStr.replace(/\s/g, '').includes(qCompact)
      );
    });
  }, [stats?.playersWithUnpaidBills, dashboardListSearch, dashboardListModal]);

  const dashboardCalendarFilteredMatches = useMemo(() => {
    const all = stats?.teamMatches ?? [];
    if (dashboardCalendarTeamFilter.length === 0) return [];
    const allowed = new Set(dashboardCalendarTeamFilter);
    return all.filter((m) => allowed.has(m.teamName));
  }, [stats?.teamMatches, dashboardCalendarTeamFilter]);

  const dashboardCalendarMatchDays = useMemo(() => {
    const keys = new Set<string>();
    for (const m of dashboardCalendarFilteredMatches) {
      const k = localDayKeyFromMatchIso(m.matchDate);
      if (k) keys.add(k);
    }
    return [...keys].map((k) => parse(k, 'yyyy-MM-dd', new Date()));
  }, [dashboardCalendarFilteredMatches]);

  const dashboardCalendarDayMatches = useMemo(() => {
    if (!matchCalendarSelected) return [];
    const key = format(matchCalendarSelected, 'yyyy-MM-dd');
    return dashboardCalendarFilteredMatches
      .filter((m) => localDayKeyFromMatchIso(m.matchDate) === key)
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  }, [dashboardCalendarFilteredMatches, matchCalendarSelected]);

  const getPlayerAvatar = (player: Player, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-16 h-16 text-2xl'
    };

    if (player.photo) {
      return (
        <img
          src={player.photo}
          alt={player.name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      );
    }

    return (
      <div className={`${sizeClasses[size]} bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center`}>
        <span className={`font-semibold text-orange-600 dark:text-orange-400`}>
          {player.name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  // Loading state while checking auth
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-bounce">
            <Volleyball className="w-16 h-16 mx-auto animate-spin-slow text-orange-500" />
          </div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Po ngarkohet...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        {(loginLoading || operationInProgress) && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm" aria-hidden="true">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
              <p className="text-lg font-medium text-foreground">Po ngarkohet...</p>
            </div>
          </div>
        )}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-white ring-2 ring-gray-200 dark:ring-gray-600">
              <img src="/logo-club-albania.png" alt="Club Albania" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl h-10 flex items-center justify-center overflow-hidden">
              <AnimatedText text="Club Albania Manager Portal" />
            </CardTitle>
            <CardDescription className="h-5 flex items-center justify-center overflow-hidden">
              <AnimatedText text="Hyni për të menaxhuar ekipin tuaj" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="h-5 flex items-center overflow-hidden">
                  <AnimatedText text="Përdoruesi" />
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Shkruani përdoruesin"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="h-5 flex items-center overflow-hidden">
                  <AnimatedText text="Fjalëkalimi" />
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Shkruani fjalëkalimin"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-10 overflow-hidden" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Duke hyrë...
                  </>
                ) : (
                  <AnimatedText text="Hyr" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-bounce">
            <Volleyball className="w-16 h-16 mx-auto animate-spin-slow text-orange-500" />
          </div>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Po ngarkohet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {operationInProgress && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto" aria-hidden="true">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-lg font-medium text-foreground">Po ngarkohet...</p>
          </div>
        </div>
      )}
      <header className="shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0 bg-white ring-2 ring-gray-200 dark:ring-gray-600">
                <img src="/logo-club-albania.png" alt="Club Albania" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">Club Albania Manager Portal</h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Mirë se vini, {admin?.name || admin?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden sm:flex"
                onClick={() => {
                  resetNewMatchForm();
                  setAddMatchOurTeam(teamRows[0]?.[0] ?? TEAMS[0]);
                  setAddMatchModalOpen(true);
                }}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {teamsL.addMatch}
              </Button>
              <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }} size="sm" className="hidden sm:flex">
                <UserPlus className="w-4 h-4 mr-2" />
                Shto Lojtar
              </Button>
              <Button variant="outline" onClick={handleLogout} size="sm" className="sm:size-default">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Dil</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1 w-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 mb-4 sm:mb-6 h-auto gap-1">
            <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Përgjithësi</span>
            </TabsTrigger>
            <TabsTrigger value="players" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Lojtarët</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{teamsL.tabShort}</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{attendanceL.tabShort}</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="flex flex-col flex-1 min-h-0 gap-6 overflow-y-auto outline-none">
            {/* Stats Cards */}
            <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Totali i Lojtarëve</CardTitle>
                  <Users className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {stats?.activePlayerCount ?? 0}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Aktiv</p>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {stats?.inactivePlayerCount ?? 0}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Joaktiv</p>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {stats?.totalPlayers ?? 0}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Gjithsej</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Norma e Arkëtimit</CardTitle>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.allTime.collectionRate.toFixed(0) || 0}%
                  </div>
                  <Progress value={stats?.allTime.collectionRate || 0} className="mt-2 h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Shuma e Arkëtuar</CardTitle>
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats?.allTime.amountCollected || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Gjithsej i arkëtuar</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Totali i Pritshëm</CardTitle>
                  <Calendar className="w-5 h-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats?.allTime.totalExpected || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Shuma totale e pagesave</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Mbetja për pagesë</CardTitle>
                  <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(
                      Math.max(
                        0,
                        (stats?.allTime?.totalExpected ?? 0) - (stats?.allTime?.amountCollected ?? 0)
                      )
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Totali pritshëm minus i arkëtuar</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-1 flex-col min-h-0">
              <div className="grid auto-rows-auto items-start grid-cols-1 gap-4 sm:gap-5 lg:auto-rows-fr lg:items-stretch lg:grid-cols-3 lg:gap-6 lg:[grid-template-columns:repeat(3,minmax(0,1fr))]">
                <Card className="dashboard-calendar-card relative flex flex-col gap-4 overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.06] py-4 dark:to-primary/10 sm:gap-5 sm:py-5 shadow-md shadow-primary/5 max-lg:min-h-[34rem] max-lg:overflow-visible">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-orange-400/10 blur-2xl" />
                  <CardHeader className="relative shrink-0 px-4 sm:px-5">
                    <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25 shadow-inner">
                        <Calendar className="h-4 w-4" aria-hidden />
                      </span>
                      {dl.calendarTitle}
                    </CardTitle>
                    <CardDescription className="text-xs leading-snug sm:text-sm">{dl.calendarDescription}</CardDescription>
                  </CardHeader>
                <CardContent className="relative flex flex-col gap-3 px-4 sm:px-5">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{dl.calendarTeamFilterLabel}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEAMS.map((team) => {
                        const on = dashboardCalendarTeamFilter.includes(team);
                        return (
                          <button
                            key={team}
                            type="button"
                            onClick={() => {
                              setDashboardCalendarTeamFilter((prev) => {
                                if (prev.includes(team)) return prev.filter((t) => t !== team);
                                return [...prev, team].sort((a, b) => TEAMS.indexOf(a) - TEAMS.indexOf(b));
                              });
                            }}
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all sm:text-xs',
                              on
                                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                                : 'bg-muted/80 text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {team}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setDashboardCalendarTeamFilter([...TEAMS])}
                      >
                        {dl.calendarTeamFilterAll}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setDashboardCalendarTeamFilter([])}
                      >
                        {dl.calendarTeamFilterNone}
                      </Button>
                    </div>
                  </div>
                  {dashboardCalendarTeamFilter.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">{dl.calendarNoMatchesFiltered}</p>
                  ) : (
                    <>
                      <div className="dashboard-match-calendar-wrapper flex justify-center items-start rounded-2xl border border-primary/15 bg-background/70 p-0.5 shadow-inner backdrop-blur-sm max-lg:min-h-[19rem] lg:items-stretch">
                        <DatePicker
                          mode="single"
                          locale={dateFnsSq}
                          month={matchCalendarMonth}
                          onMonthChange={setMatchCalendarMonth}
                          selected={matchCalendarSelected}
                          onSelect={setMatchCalendarSelected}
                          modifiers={{ hasMatch: dashboardCalendarMatchDays }}
                          modifiersClassNames={{
                            hasMatch: cn(
                              'relative font-semibold text-primary',
                              "after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
                            ),
                          }}
                          className="dashboard-match-calendar mx-auto w-full min-w-0 max-w-full sm:max-w-[20rem] [--cell-size:2rem] sm:[--cell-size:2.1rem] xl:[--cell-size:2.25rem] rounded-xl bg-transparent p-1"
                        />
                      </div>
                      <div className="min-h-[3.5rem] max-h-36 overflow-y-auto rounded-xl border border-primary/10 bg-muted/25 p-2 touch-pan-y">
                        {!matchCalendarSelected ? (
                          <p className="text-center text-sm text-muted-foreground py-2">{dl.calendarPickDay}</p>
                        ) : dashboardCalendarDayMatches.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-2">{dl.calendarNoMatchesThisDay}</p>
                        ) : (
                          <ul className="space-y-2">
                            {dashboardCalendarDayMatches.map((m) => (
                              <li
                                key={m.id}
                                className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/80 px-3 py-2 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {m.teamName}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {m.isHome ? dl.calendarHome : dl.calendarAway}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Volleyball className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                  <span className="font-medium text-foreground truncate">{m.opponent}</span>
                                </div>
                                {m.venue ? (
                                  <p className="text-xs text-muted-foreground truncate">{m.venue}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card
                role="button"
                tabIndex={0}
                onClick={() => openDashboardListModal('recentPayments')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDashboardListModal('recentPayments');
                  }
                }}
                className="h-0 min-h-full overflow-hidden max-lg:h-auto max-lg:min-h-0 max-lg:overflow-visible cursor-pointer border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <CardHeader className="shrink-0">
                  <CardTitle>{dl.recentPaymentsTitle}</CardTitle>
                  <CardDescription>{dl.recentPaymentsDescription}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0 max-lg:overflow-visible">
                  {!stats?.recentPayments || stats.recentPayments.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center text-center text-gray-500 py-6 min-h-[12rem]">{dl.recentPaymentsEmpty}</p>
                  ) : (
                    <>
                      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain touch-pan-y max-lg:overflow-visible max-lg:[&>*:nth-child(n+6)]:hidden">
                        {(stats?.recentPayments ?? []).map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 shrink-0 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">{payment.player?.name || dl.unknownPlayer}</div>
                                <div className="text-sm text-gray-500">
                                  {formatDateDisplay(payment.paidDate)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 pl-2">
                              <div className="font-semibold text-green-600">{formatCurrency(payment.amount)}</div>
                              <div className="text-xs text-gray-500">
                                {formatDateDisplay(payment.paidDate)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {stats.recentPayments.length > DASHBOARD_CARD_MODAL_HINT_MIN_ITEMS ? (
                        <p className="text-xs text-muted-foreground shrink-0 pt-3 mt-auto border-t border-border/60">
                          {dl.cardPreviewHint(stats.recentPayments.length)}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card
                role="button"
                tabIndex={0}
                onClick={() => openDashboardListModal('unpaid')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDashboardListModal('unpaid');
                  }
                }}
                className="h-0 min-h-full overflow-hidden max-lg:h-auto max-lg:min-h-0 max-lg:overflow-visible cursor-pointer border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <CardHeader className="shrink-0">
                  <CardTitle>{dl.unpaidTitle}</CardTitle>
                  <CardDescription>{dl.unpaidDescription}</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0 max-lg:overflow-visible">
                  {!stats?.playersWithUnpaidBills || stats.playersWithUnpaidBills.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-center py-8 min-h-[12rem]">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                      <p className="text-gray-500">{dl.unpaidEmpty}</p>
                    </div>
                  ) : (
                    <>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain touch-pan-y max-lg:overflow-visible max-lg:[&>*:nth-child(n+6)]:hidden">
                        {(stats?.playersWithUnpaidBills ?? []).map((player) => (
                          <div key={player.id} className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              {getPlayerAvatar(player, 'md')}
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">{player.name}</div>
                                <div className="text-sm text-gray-500 truncate">{player.team || dl.noTeam}</div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToPlayersRowFromUnpaid(player);
                              }}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              {dl.viewPlayers}
                            </Button>
                          </div>
                        ))}
                      </div>
                      {stats.playersWithUnpaidBills.length > DASHBOARD_CARD_MODAL_HINT_MIN_ITEMS ? (
                        <p className="text-xs text-muted-foreground shrink-0 pt-3 mt-auto border-t border-border/60">
                          {dl.cardPreviewHint(stats.playersWithUnpaidBills.length)}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="flex flex-col flex-1 min-h-0 gap-6 overflow-y-auto outline-none">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Lista e Lojtarëve</CardTitle>
                    <CardDescription>Menaxhoni lojtarët e ekipit tuaj</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Kërko lojtarë..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="pl-10 w-full sm:w-64"
                      />
                    </div>
                    <Select value={playerPaymentFilter} onValueChange={setPlayerPaymentFilter}>
                      <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Filtro sipas pagesës" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Të gjithë</SelectItem>
                        <SelectItem value="withBalance">Kanë shumë për të paguar</SelectItem>
                        <SelectItem value="paid">Të paguar plotësisht</SelectItem>
                        <SelectItem value="credit">Me tepricë</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={playerPaymentSort} onValueChange={setPlayerPaymentSort}>
                      <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Rendit sipas shumës së mbetur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pa renditje</SelectItem>
                        <SelectItem value="highestBalance">Shuma e mbetur: nga më e madhja</SelectItem>
                        <SelectItem value="lowestBalance">Shuma e mbetur: nga më e vogla</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto border-green-600/50 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40 disabled:opacity-40"
                      onClick={openBroadcastDialog}
                      disabled={broadcastRecipients.length === 0}
                      title={broadcastRecipients.length === 0 ? 'Asnjë lojtar me numër të vlefshëm' : 'Dërgo një mesazh WhatsApp te të gjithë lojtarët'}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Njofto të gjithë
                    </Button>
                    <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }} className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Lojtar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sortedPlayers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">Nuk u gjetën lojtarë</p>
                    <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Lojtarin e Parë
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="sm:hidden space-y-3">
                      {sortedPlayers.map((player) => (
                        <div
                          key={player.id}
                          data-player-row={player.id}
                          className={cn(
                            'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm scroll-mt-24',
                            playerRowSpotlightId === player.id && 'player-row-spotlight',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {getPlayerAvatar(player, 'lg')}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{player.name}</h3>
                                <Badge variant={player.active ? 'default' : 'secondary'} className="ml-2">
                                  {player.active ? 'Aktiv' : 'Joaktiv'}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm text-gray-500 space-y-1">
                                {player.team && <p>📍 {player.team}</p>}
                                {player.jerseyNumber && <p>👕 Nr. {player.jerseyNumber}</p>}
                                {player.dateOfBirth && (
                                  <p>Datelindja: {formatDateDisplay(player.dateOfBirth)}</p>
                                )}
                                {player.email && <p className="truncate">✉️ {player.email}</p>}
                                {player.phone && <p>📞 {player.phone}</p>}
                              </div>
                              {(() => {
                                const { totalBills, amountPaid, amountLeft } = getPlayerPaymentSummary(player);
                                const isOverpaid = amountLeft < 0;
                                return (
                                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs space-y-0.5">
                                    <p><span className="text-gray-500">Totali:</span> {formatCurrency(totalBills)}</p>
                                    <p><span className="text-gray-500">Paguar:</span> {formatCurrency(amountPaid)}</p>
                                    {amountLeft === 0 ? (
                                      <p className="text-green-600 dark:text-green-400 font-medium">Paguar Plotesisht</p>
                                    ) : (
                                      <p>
                                        <span className="text-gray-500">{isOverpaid ? 'Tepricë:' : 'Mbetur:'}</span>{' '}
                                        <span className={isOverpaid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                          {isOverpaid ? `-${formatCurrency(Math.abs(amountLeft))}` : formatCurrency(amountLeft)}
                                        </span>
                                        {isOverpaid && <span className="ml-1 text-gray-500">Tepricë</span>}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            {(() => {
                              const { amountLeft } = getPlayerPaymentSummary(player);
                              return (
                                <Button
                                  size="sm"
                                  disabled={amountLeft <= 0}
                                  className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                                  onClick={() => { setAddPaymentPlayer(player); setAddPaymentAmount(''); setAddPaymentDate(new Date().toISOString().split('T')[0]); }}
                                >
                                  SHTO PAGESE
                                </Button>
                              );
                            })()}
                            <Button size="sm" variant="outline" onClick={() => setViewingPlayer(player)}>
                              <Eye className="w-4 h-4 mr-1" /> Shiko
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={onPlayerPaymentPdfClick(player)}
                              title="Shkarko PDF pagesash"
                            >
                              <FileDown className="w-4 h-4 mr-1" /> PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!normalizePhoneForWhatsApp(player.phone)}
                              onClick={() => openWhatsappPaymentReminder(player)}
                              title={
                                normalizePhoneForWhatsApp(player.phone)
                                  ? 'WhatsApp te numri i lojtarit me mesazh të gatshëm'
                                  : 'Shto numër telefoni'
                              }
                              className="border-green-600/50 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40 disabled:opacity-40"
                            >
                              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEditPlayer(player)}>
                              <Pencil className="w-4 h-4 mr-1" /> Ndrysho
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeletePlayer(player.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table Layout */}
                    <Table stickyHorizontalScroll containerClassName="hidden sm:block">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Foto</TableHead>
                          <TableHead>Emri</TableHead>
                          <TableHead>Ekipi</TableHead>
                          <TableHead>Numri</TableHead>
                          <TableHead>Datelindja</TableHead>
                          <TableHead>Kontakti</TableHead>
                          <TableHead>Faturat</TableHead>
                          <TableHead>Statusi</TableHead>
                          <TableHead className="text-right">Veprimet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPlayers.map((player) => (
                          <TableRow
                            key={player.id}
                            data-player-row={player.id}
                            className={cn(
                              'scroll-mt-24',
                              playerRowSpotlightId === player.id && 'player-row-spotlight',
                            )}
                          >
                            <TableCell>
                              {getPlayerAvatar(player, 'md')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {player.name}
                            </TableCell>
                            <TableCell>{player.team || '-'}</TableCell>
                            <TableCell>{player.jerseyNumber || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {player.dateOfBirth ? formatDateDisplay(player.dateOfBirth) : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{player.email || '-'}</div>
                                <div className="text-gray-500">{player.phone || ''}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const { totalBills, amountPaid, amountLeft } = getPlayerPaymentSummary(player);
                                const isOverpaid = amountLeft < 0;
                                return (
                                  <div className="text-sm min-w-[140px]">
                                    <div><span className="text-gray-500">Totali:</span> {formatCurrency(totalBills)}</div>
                                    <div><span className="text-gray-500">Paguar:</span> {formatCurrency(amountPaid)}</div>
                                    {amountLeft === 0 ? (
                                      <div className="text-green-600 dark:text-green-400 font-medium">Paguar Plotesisht</div>
                                    ) : (
                                      <div>
                                        <span className="text-gray-500">{isOverpaid ? 'Tepricë:' : 'Mbetur:'}</span>{' '}
                                        <span className={isOverpaid ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                                          {isOverpaid ? `-${formatCurrency(Math.abs(amountLeft))}` : formatCurrency(amountLeft)}
                                        </span>
                                        {isOverpaid && <span className="ml-1 text-gray-500 text-xs">Tepricë</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={player.active ? 'default' : 'secondary'}>
                                {player.active ? 'Aktiv' : 'Joaktiv'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {(() => {
                                  const { amountLeft } = getPlayerPaymentSummary(player);
                                  return (
                                    <Button
                                      size="sm"
                                      disabled={amountLeft <= 0}
                                      className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                                      onClick={() => { setAddPaymentPlayer(player); setAddPaymentAmount(''); setAddPaymentDate(new Date().toISOString().split('T')[0]); }}
                                      title="Shto pagesë"
                                    >
                                      SHTO PAGESE
                                    </Button>
                                  );
                                })()}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewingPlayer(player)}
                                  title="Shiko"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={onPlayerPaymentPdfClick(player)}
                                  title="Shkarko PDF pagesash"
                                >
                                  <FileDown className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!normalizePhoneForWhatsApp(player.phone)}
                                  onClick={() => openWhatsappPaymentReminder(player)}
                                  title={
                                    normalizePhoneForWhatsApp(player.phone)
                                      ? 'WhatsApp te lojtari me mesazh të gatshëm'
                                      : 'Shto numër telefoni'
                                  }
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 disabled:opacity-30"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditPlayer(player)}
                                  title="Ndrysho"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => handleDeletePlayer(player.id)}
                                  title="Fshi"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="flex flex-col flex-1 min-h-0 gap-6 overflow-y-auto outline-none">
            <Card>
              <CardHeader>
                <CardTitle>{teamsL.pageTitle}</CardTitle>
                <CardDescription>{teamsL.pageDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {teamRows.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">{teamsL.emptyNoTeams}</p>
                ) : (
                  <>
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{teamsL.colTeam}</TableHead>
                            <TableHead>{teamsL.colPlayers}</TableHead>
                            <TableHead className="text-right">{teamsL.colActions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamRows.map(([teamName, count]) => (
                            <TableRow key={teamName}>
                              <TableCell className="font-medium">{teamName}</TableCell>
                              <TableCell>{count}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => void openTeamsMatches(teamName)}>
                                    {teamsL.matches}
                                  </Button>
                                  <Button type="button" size="sm" onClick={() => void openTeamsFormation(teamName)}>
                                    {teamsL.editFormation}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="sm:hidden space-y-3">
                      {teamRows.map(([teamName, count]) => (
                        <div
                          key={teamName}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-lg font-semibold text-foreground">{teamName}</span>
                            <Badge variant="secondary">
                              {count} {teamsL.colPlayers}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            <Button type="button" variant="outline" className="w-full" onClick={() => void openTeamsMatches(teamName)}>
                              {teamsL.matches}
                            </Button>
                            <Button type="button" className="w-full" onClick={() => void openTeamsFormation(teamName)}>
                              {teamsL.editFormation}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="flex flex-col flex-1 min-h-0 gap-6 overflow-y-auto outline-none">
            <AttendanceTab
              players={players}
              operationInProgress={operationInProgress}
              setOperationInProgress={setOperationInProgress}
            />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={teamsFormationTeam !== null}
        onOpenChange={(open) => {
          if (!open) setTeamsFormationTeam(null);
        }}
      >
        <DialogContent className="flex h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
            <DialogTitle>{teamsFormationTeam ? teamsL.formationTitle(teamsFormationTeam) : ''}</DialogTitle>
            <DialogDescription>{teamsL.formationDescription}</DialogDescription>
          </DialogHeader>
          {teamsFormationLoading ? (
            <div className="flex min-h-[12rem] flex-1 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : teamsFormationSlots.length === 0 ? (
            <div className="flex min-h-[12rem] flex-1 items-center justify-center px-6">
              <p className="text-center text-sm text-muted-foreground">{teamsL.emptyFormationRoster}</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-4">
              {teamsFormationSlots.map((slot) => {
                const pl = players.find((p) => p.id === slot.playerId);
                return (
                  <div
                    key={slot.playerId}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4 sm:max-w-[min(100%,20rem)]">
                      {pl ? (
                        getPlayerAvatar(pl, 'lg')
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                          ?
                        </div>
                      )}
                      <span className="truncate text-base font-semibold text-foreground">{pl?.name ?? '—'}</span>
                    </div>
                    <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 sm:items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{teamsL.colPosition}</Label>
                        <Input
                          value={slot.position}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTeamsFormationSlots((prev) =>
                              prev.map((s) => (s.playerId === slot.playerId ? { ...s, position: v } : s)),
                            );
                          }}
                          placeholder={teamsL.positionPlaceholder}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 sm:justify-end sm:py-2.5">
                        <Label htmlFor={`squad-${slot.playerId}`} className="text-sm">
                          {teamsL.colInSquad}
                        </Label>
                        <Switch
                          id={`squad-${slot.playerId}`}
                          checked={slot.inSquad}
                          onCheckedChange={(checked) => {
                            setTeamsFormationSlots((prev) =>
                              prev.map((s) => (s.playerId === slot.playerId ? { ...s, inSquad: checked } : s)),
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setTeamsFormationTeam(null)}>
              {teamsL.close}
            </Button>
            <Button
              type="button"
              onClick={() => void saveTeamsFormation()}
              disabled={teamsFormationSaving || teamsFormationLoading || teamsFormationSlots.length === 0}
            >
              {teamsFormationSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {teamsL.saving}
                </>
              ) : (
                teamsL.saveFormation
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={teamsMatchesTeam !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTeamsMatchesTeam(null);
            setMatchScoreDrafts({});
            setResultGraphicMatchId(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(92dvh,820px)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{teamsMatchesTeam ? teamsL.matchesTitle(teamsMatchesTeam) : ''}</DialogTitle>
            <DialogDescription>{teamsL.matchesDescriptionListOnly}</DialogDescription>
          </DialogHeader>
          {teamsMatchesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[min(72dvh,640px)] space-y-0 overflow-y-auto rounded-lg border">
              {teamsMatchesList.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{teamsL.emptyMatches}</p>
              ) : (
                teamsMatchesList.map((m) => {
                  const finished = isTeamMatchFinished(m.matchDate);
                  const draft = matchScoreDrafts[m.id] ?? { sets: [{ our: '', their: '' }] };
                  const savedParsed = parseVolleyballSets(m.volleyballSets);
                  const hasLegacySetsOnly =
                    savedParsed.length === 0 && m.ourScore != null && m.theirScore != null;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-3 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-medium text-foreground">{formatDateDisplay(m.matchDate)}</div>
                        <div className="text-sm text-muted-foreground">
                          {m.opponent} · {m.isHome ? teamsL.home : teamsL.away}
                        </div>
                        {m.venue ? <div className="text-xs text-muted-foreground">{m.venue}</div> : null}
                        {m.notes ? <div className="text-xs text-foreground/80 line-clamp-2">{m.notes}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                        {finished ? (
                          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                            <div className="text-xs font-medium text-muted-foreground">{teamsL.setsHeading}</div>
                            <div className="flex flex-col gap-2">
                              {draft.sets.map((row, setIdx) => (
                                <div key={setIdx} className="flex flex-wrap items-end gap-2">
                                  <span className="w-full text-xs text-muted-foreground sm:w-auto sm:min-w-[4.5rem]">
                                    {teamsL.setNumber(setIdx + 1)}
                                  </span>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{teamsL.ourScoreShort}</Label>
                                    <Input
                                      className="h-9 w-14 text-center tabular-nums"
                                      inputMode="numeric"
                                      value={row.our}
                                      onChange={(e) =>
                                        setMatchScoreDrafts((prev) => {
                                          const cur = prev[m.id] ?? { sets: [{ our: '', their: '' }] };
                                          const sets = cur.sets.map((s, i) =>
                                            i === setIdx ? { ...s, our: e.target.value } : s,
                                          );
                                          return { ...prev, [m.id]: { sets } };
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{teamsL.theirScoreShort}</Label>
                                    <Input
                                      className="h-9 w-14 text-center tabular-nums"
                                      inputMode="numeric"
                                      value={row.their}
                                      onChange={(e) =>
                                        setMatchScoreDrafts((prev) => {
                                          const cur = prev[m.id] ?? { sets: [{ our: '', their: '' }] };
                                          const sets = cur.sets.map((s, i) =>
                                            i === setIdx ? { ...s, their: e.target.value } : s,
                                          );
                                          return { ...prev, [m.id]: { sets } };
                                        })
                                      }
                                    />
                                  </div>
                                  {draft.sets.length > 1 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="mb-0.5 h-9 px-2"
                                      onClick={() =>
                                        setMatchScoreDrafts((prev) => {
                                          const cur = prev[m.id];
                                          if (!cur || cur.sets.length <= 1) return prev;
                                          return {
                                            ...prev,
                                            [m.id]: { sets: cur.sets.filter((_, i) => i !== setIdx) },
                                          };
                                        })
                                      }
                                    >
                                      {teamsL.removeSet}
                                    </Button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {draft.sets.length < MAX_VOLLEY_SETS ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setMatchScoreDrafts((prev) => {
                                      const cur = prev[m.id] ?? { sets: [{ our: '', their: '' }] };
                                      if (cur.sets.length >= MAX_VOLLEY_SETS) return prev;
                                      return {
                                        ...prev,
                                        [m.id]: { sets: [...cur.sets, { our: '', their: '' }] },
                                      };
                                    })
                                  }
                                >
                                  <Plus className="mr-1 h-4 w-4" />
                                  {teamsL.addSet}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                disabled={matchResultSavingId === m.id}
                                onClick={() => void saveMatchResult(m.id)}
                              >
                                {matchResultSavingId === m.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  teamsL.saveResult
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : savedParsed.length > 0 ? (
                          <span className="font-mono text-base tabular-nums sm:text-lg">
                            {formatVolleyballSetsSummary(savedParsed)}
                          </span>
                        ) : hasLegacySetsOnly ? (
                          <div className="flex flex-col items-end gap-0.5 text-right">
                            <span className="font-mono text-base tabular-nums sm:text-lg">
                              {m.ourScore} — {m.theirScore}
                            </span>
                            <span className="text-xs text-muted-foreground">{teamsL.legacySetScoreLabel}</span>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="destructive" size="sm" onClick={() => void deleteTeamMatch(m.id)}>
                            <Trash2 className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">{teamsL.deleteMatch}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={resultGraphicMatchId !== null}
        onOpenChange={(open) => {
          if (!open) setResultGraphicMatchId(null);
        }}
      >
        <DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {resultGraphicMatch ? teamsL.resultGraphicDialogTitle(resultGraphicMatch.opponent) : ''}
            </DialogTitle>
          </DialogHeader>
          {resultGraphicMatch ? (
            <MatchResultGraphic
              data={buildMatchResultDataFromRow(
                resultGraphicMatch,
                matchScoreDrafts[resultGraphicMatch.id],
              )}
              locale="sq"
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResultGraphicMatchId(null)}>
              {teamsL.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMatchModalOpen}
        onOpenChange={(open) => {
          setAddMatchModalOpen(open);
          if (!open) resetNewMatchForm();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{teamsL.addMatchModalTitle}</DialogTitle>
            <DialogDescription>{teamsL.addMatchModalDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{teamsL.ourTeamLabel}</Label>
              <Select value={addMatchOurTeam} onValueChange={setAddMatchOurTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{teamsL.colDate}</Label>
              <Input type="date" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{teamsL.colOpponent}</Label>
              <Input
                value={newMatchOpponent}
                onChange={(e) => setNewMatchOpponent(e.target.value)}
                placeholder={teamsL.opponentPlaceholder}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="add-match-home" className="text-sm">
                {newMatchIsHome ? teamsL.home : teamsL.away}
              </Label>
              <Switch id="add-match-home" checked={newMatchIsHome} onCheckedChange={setNewMatchIsHome} />
            </div>
            <div className="space-y-2">
              <Label>{teamsL.colVenue}</Label>
              <Input
                value={newMatchVenue}
                onChange={(e) => setNewMatchVenue(e.target.value)}
                placeholder={teamsL.venuePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{teamsL.notesPlaceholder}</Label>
              <Textarea value={newMatchNotes} onChange={(e) => setNewMatchNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddMatchModalOpen(false)}>
              {teamsL.close}
            </Button>
            <Button
              type="button"
              onClick={() => void submitAddMatchModal()}
              disabled={matchSubmitting || !newMatchOpponent.trim()}
            >
              {matchSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {teamsL.saving}
                </>
              ) : (
                teamsL.addMatch
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dashboardListModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDashboardListModal(null);
            setDashboardListSearch('');
          }
        }}
      >
        <DialogContent
          className={cn(
            'flex w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl',
            'max-h-[min(90dvh,820px)] min-h-0',
            'top-[max(0.75rem,4dvh)] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]',
            'duration-300',
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 text-left sm:px-6">
            <DialogTitle>
              {dashboardListModal === 'recentPayments' ? dl.recentPaymentsTitle : dl.unpaidTitle}
            </DialogTitle>
            <DialogDescription>
              {dashboardListModal === 'recentPayments' ? dl.recentPaymentsDescription : dl.unpaidDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0 border-b px-4 py-3 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  dashboardListModal === 'recentPayments'
                    ? dl.listSearchPlaceholderPayments
                    : dl.listSearchPlaceholderUnpaid
                }
                value={dashboardListSearch}
                onChange={(e) => setDashboardListSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>
          <div
            key={dashboardListModal ?? 'closed'}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          >
            {dashboardListModal === 'recentPayments' && (() => {
              const total = stats?.recentPayments?.length ?? 0;
              if (total === 0) {
                return <p className="py-8 text-center text-muted-foreground">{dl.recentPaymentsEmpty}</p>;
              }
              if (dashboardFilteredPayments.length === 0) {
                return <p className="py-8 text-center text-muted-foreground">{dl.listNoResults}</p>;
              }
              return (
                <ul className="space-y-2">
                  {dashboardFilteredPayments.map((payment, i) => (
                    <li
                      key={payment.id}
                      style={{ animationDelay: `${Math.min(i * 28, 400)}ms` }}
                      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/40 p-3 duration-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{payment.player?.name || dl.unknownPlayer}</div>
                          <div className="text-sm text-muted-foreground">{formatDateDisplay(payment.paidDate)}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <div className="font-semibold text-green-600">{formatCurrency(payment.amount)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
            {dashboardListModal === 'unpaid' && (() => {
              const total = stats?.playersWithUnpaidBills?.length ?? 0;
              if (total === 0) {
                return (
                  <div className="py-8 text-center">
                    <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
                    <p className="text-muted-foreground">{dl.unpaidEmpty}</p>
                  </div>
                );
              }
              if (dashboardFilteredUnpaid.length === 0) {
                return <p className="py-8 text-center text-muted-foreground">{dl.listNoResults}</p>;
              }
              return (
                <ul className="space-y-2">
                  {dashboardFilteredUnpaid.map((player, i) => {
                    const { amountLeft } = getPlayerPaymentSummary(player);
                    const left = Math.max(0, amountLeft);
                    return (
                      <li
                        key={player.id}
                        style={{ animationDelay: `${Math.min(i * 28, 400)}ms` }}
                        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 duration-200 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {getPlayerAvatar(player, 'md')}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{player.name}</div>
                            <div className="text-sm text-muted-foreground truncate">{player.team || dl.noTeam}</div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="font-semibold text-amber-700 dark:text-amber-500 sm:min-w-[7rem] sm:text-right">
                            {formatCurrency(left)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => goToPlayersRowFromUnpaid(player)}
                          >
                            <Users className="mr-1 h-4 w-4" />
                            {dl.viewPlayers}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
          <div className="shrink-0 border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
            {dashboardListModal === 'recentPayments' && (
              <span>{dl.listFooterCounts(dashboardFilteredPayments.length, stats?.recentPayments?.length ?? 0)}</span>
            )}
            {dashboardListModal === 'unpaid' && (
              <span>{dl.listFooterCounts(dashboardFilteredUnpaid.length, stats?.playersWithUnpaidBills?.length ?? 0)}</span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Dialog */}
      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Përditëso Lojtarin' : 'Shto Lojtar të Ri'}</DialogTitle>
            <DialogDescription>
              {editingPlayer ? 'Përditësoni informacionin e lojtarit' : 'Vendosni të dhënat për anëtarin e ri të ekipit'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Fotoja e Lojtarit</Label>
              <div className="flex items-center gap-4">
                {playerPhoto ? (
                  <div className="relative">
                    <img
                      src={playerPhoto}
                      alt="Preview"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-orange-300"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
                      onClick={removePhoto}
                      disabled={photoUploading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-dashed border-gray-300 dark:border-gray-600 ${photoUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !photoUploading && fileInputRef.current?.click()}
                  >
                    {photoUploading ? (
                      <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={photoUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                  >
                    {photoUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Duke ngarkuar...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        {playerPhoto ? 'Ndrysho Foton' : 'Ngarko Foto'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, WebP</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Emri *</Label>
              <Input
                id="name"
                value={playerForm.name}
                onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                placeholder="Emri i lojtarit"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={playerForm.email}
                  onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefoni</Label>
                <Input
                  id="phone"
                  value={playerForm.phone}
                  onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })}
                  placeholder="+355 69 123 4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="team">Ekipi</Label>
                <Select value={playerForm.team} onValueChange={(value) => setPlayerForm({ ...playerForm, team: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Zgjidhni ekipin" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS.map((team) => (
                      <SelectItem key={team} value={team}>{team}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jerseyNumber">Numri i Fanellës</Label>
                <Input
                  id="jerseyNumber"
                  type="number"
                  value={playerForm.jerseyNumber}
                  onChange={(e) => setPlayerForm({ ...playerForm, jerseyNumber: e.target.value })}
                  placeholder="1-99"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1.2fr_0.85fr]">
              <div className="space-y-2">
                <Label htmlFor="joinDate">Data e Bashkimit</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={playerForm.joinDate}
                  onChange={(e) => setPlayerForm({ ...playerForm, joinDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Datelindja</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={playerForm.dateOfBirth}
                  onChange={(e) => setPlayerForm({ ...playerForm, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Statusi</Label>
                <Select
                  value={playerForm.active ? 'active' : 'inactive'}
                  onValueChange={(value) => setPlayerForm({ ...playerForm, active: value === 'active' })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Joaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalPayment">Shuma totale e pagesës (ALL)</Label>
              <Input
                id="totalPayment"
                type="number"
                min="0"
                step="100"
                value={playerForm.totalPayment}
                onChange={(e) => setPlayerForm({ ...playerForm, totalPayment: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setPlayerDialogOpen(false); setEditingPlayer(null); resetPlayerForm(); }} className="w-full sm:w-auto">
              Anulo
            </Button>
            <Button onClick={editingPlayer ? handleUpdatePlayer : handleCreatePlayer} className="w-full sm:w-auto">
              {editingPlayer ? 'Përditëso' : 'Shto'} Lojtarin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player View Dialog */}
      <Dialog open={!!viewingPlayer} onOpenChange={() => setViewingPlayer(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detajet e Lojtarit</DialogTitle>
          </DialogHeader>
          {viewingPlayer && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {getPlayerAvatar(viewingPlayer, 'lg')}
                <div>
                  <h3 className="text-xl font-semibold">{viewingPlayer.name}</h3>
                  <p className="text-gray-500">{viewingPlayer.team || 'Pa ekip të caktuar'}</p>
                  {viewingPlayer.jerseyNumber && (
                    <Badge className="mt-1">#{viewingPlayer.jerseyNumber}</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p className="font-medium break-all">{viewingPlayer.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Telefoni</Label>
                  <p className="font-medium">{viewingPlayer.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Data e Bashkimit</Label>
                  <p className="font-medium">{formatDateDisplay(viewingPlayer.joinDate)}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Datelindja</Label>
                  <p className="font-medium">
                    {viewingPlayer.dateOfBirth ? formatDateDisplay(viewingPlayer.dateOfBirth) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Statusi</Label>
                  <Badge variant={viewingPlayer.active ? 'default' : 'secondary'}>
                    {viewingPlayer.active ? 'Aktiv' : 'Joaktiv'}
                  </Badge>
                </div>
              </div>

              {(() => {
                const { totalBills, amountPaid, amountLeft } = getPlayerPaymentSummary(viewingPlayer);
                const isOverpaid = amountLeft < 0;
                return (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Totali:</span>
                      <span className="font-medium">{formatCurrency(totalBills)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paguar:</span>
                      <span className="font-medium">{formatCurrency(amountPaid)}</span>
                    </div>
                    {amountLeft === 0 ? (
                      <div className="font-medium text-green-600 dark:text-green-400">Paguar Plotesisht</div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{isOverpaid ? 'Tepricë:' : 'Mbetur:'}</span>
                        <span className={`font-medium ${isOverpaid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isOverpaid ? `-${formatCurrency(Math.abs(amountLeft))}` : formatCurrency(amountLeft)}
                        </span>
                        {isOverpaid && <span className="text-gray-500 text-sm">Tepricë</span>}
                      </div>
                    )}
                    {amountLeft > 0 && (
                      <Button
                        size="sm"
                        className="w-full mt-2 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                        onClick={() => { setViewingPlayer(null); setAddPaymentPlayer(viewingPlayer); setAddPaymentAmount(''); setAddPaymentDate(new Date().toISOString().split('T')[0]); }}
                      >
                        SHTO PAGESE
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={onPlayerPaymentPdfClick(viewingPlayer)}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Shkarko PDF pagesash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 border-green-600/50 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40 disabled:opacity-40"
                      disabled={!normalizePhoneForWhatsApp(viewingPlayer.phone)}
                      onClick={() => openWhatsappPaymentReminder(viewingPlayer)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Njoftim pagese (WhatsApp)
                    </Button>
                  </div>
                );
              })()}

              <div>
                <Label className="text-gray-500">Historia e Pagesave</Label>
                {viewingPlayer.paymentHistory && viewingPlayer.paymentHistory.length > 0 ? (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {[...viewingPlayer.paymentHistory]
                      .map((entry, originalIndex) => ({ ...entry, _index: originalIndex }))
                      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
                      .map((entry) => (
                        <div key={`${entry.date}-${entry.amount}-${entry._index}`} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm">{formatDateDisplay(entry.date)}</span>
                            <span className="font-medium">{formatCurrency(entry.amount ?? 0)}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingPaymentEntry({
                                player: viewingPlayer,
                                index: entry._index,
                                amount: String(entry.amount ?? 0),
                                date: entry.date ?? new Date().toISOString().split('T')[0],
                              })}
                              title="Ndrysho"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                              onClick={() => handleDeletePaymentFromHistory(viewingPlayer, entry._index)}
                              title="Fshi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 mt-2">Nuk ka regjistrime pagesash</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!addPaymentPlayer} onOpenChange={(open) => { if (!open) { setAddPaymentPlayer(null); setAddPaymentAmount(''); setAddPaymentDate(new Date().toISOString().split('T')[0]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shto pagesë</DialogTitle>
            <DialogDescription>
              {addPaymentPlayer ? `${addPaymentPlayer.name} – shtoni shumën dhe datën` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-payment-amount">Shuma (ALL) *</Label>
              <Input
                id="add-payment-amount"
                type="number"
                min="0"
                step="100"
                value={addPaymentAmount}
                onChange={(e) => setAddPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover open={addPaymentDatePickerOpen} onOpenChange={setAddPaymentDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {addPaymentDate ? formatDateDDMMYYYY(addPaymentDate) : 'Zgjidhni datën'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePicker
                    mode="single"
                    selected={addPaymentDate ? parse(addPaymentDate, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(date) => {
                      if (date) { setAddPaymentDate(format(date, 'yyyy-MM-dd')); setAddPaymentDatePickerOpen(false); }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddPaymentPlayer(null); setAddPaymentAmount(''); setAddPaymentDate(new Date().toISOString().split('T')[0]); }}>
              Anulo
            </Button>
            <Button onClick={handleAddPayment} disabled={!addPaymentAmount.trim() || !addPaymentDate.trim()}>
              Shto pagesë
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPaymentEntry} onOpenChange={(open) => { if (!open) setEditingPaymentEntry(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ndrysho pagesën</DialogTitle>
            <DialogDescription>
              {editingPaymentEntry ? `${editingPaymentEntry.player.name} – ndryshoni shumën ose datën` : ''}
            </DialogDescription>
          </DialogHeader>
          {editingPaymentEntry && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-payment-amount">Shuma (ALL) *</Label>
                <Input
                  id="edit-payment-amount"
                  type="number"
                  min="0"
                  step="100"
                  value={editingPaymentEntry.amount}
                  onChange={(e) => setEditingPaymentEntry({ ...editingPaymentEntry, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover open={editPaymentDatePickerOpen} onOpenChange={setEditPaymentDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {editingPaymentEntry.date ? formatDateDDMMYYYY(editingPaymentEntry.date) : 'Zgjidhni datën'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DatePicker
                      mode="single"
                      selected={editingPaymentEntry.date ? parse(editingPaymentEntry.date, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setEditingPaymentEntry({ ...editingPaymentEntry, date: format(date, 'yyyy-MM-dd') });
                          setEditPaymentDatePickerOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          {editingPaymentEntry && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPaymentEntry(null)}>
                Anulo
              </Button>
              <Button onClick={handleUpdatePaymentInHistory} disabled={!editingPaymentEntry.amount.trim() || !editingPaymentEntry.date.trim()}>
                Ruaj
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Broadcast WhatsApp Dialog */}
      <Dialog open={broadcastOpen} onOpenChange={(open) => { if (!open) setBroadcastOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Njofto të gjithë lojtarët (WhatsApp)</DialogTitle>
            <DialogDescription>
              Shkruani mesazhin, pastaj dërgojeni te çdo lojtar një nga një. Për secilin hapet WhatsApp me mesazhin gati — ju vetëm shtypni “Dërgo”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Mesazhi *</Label>
              <Textarea
                id="broadcast-message"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Shkruani mesazhin për të gjithë lojtarët..."
                rows={5}
                disabled={broadcastIndex > 0}
              />
            </div>
            <p className="text-sm text-gray-500">
              {broadcastRecipients.length} lojtarë me numër të vlefshëm
              {broadcastSkippedCount > 0 && ` · ${broadcastSkippedCount} pa numër (anashkalohen)`}
            </p>
            {broadcastRecipients.length > 0 && (
              <div className="space-y-1">
                <Progress value={(Math.min(broadcastIndex, broadcastRecipients.length) / broadcastRecipients.length) * 100} />
                <p className="text-sm text-gray-500">
                  {Math.min(broadcastIndex, broadcastRecipients.length)} / {broadcastRecipients.length} të dërguar
                </p>
              </div>
            )}
            {broadcastIndex < broadcastRecipients.length && (
              <p className="text-sm font-medium text-center break-words">
                {broadcastRecipients[broadcastIndex]?.name}
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:justify-stretch">
            {broadcastIndex > 0 && (
              <Button
                variant="outline"
                onClick={goBackBroadcast}
                className="w-full"
                title={`Kthehu te ${broadcastRecipients[broadcastIndex - 1]?.name ?? ''}`}
              >
                <ChevronLeft className="w-4 h-4 mr-2 shrink-0" />
                Kthehu
              </Button>
            )}
            {broadcastIndex < broadcastRecipients.length ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setBroadcastIndex((i) => i + 1)}
                  disabled={!broadcastMessage.trim()}
                  className="w-full"
                  title={`Kalo ${broadcastRecipients[broadcastIndex]?.name ?? ''}`}
                >
                  Kalo
                  <ChevronRight className="w-4 h-4 mr-2 shrink-0" />
                </Button>
                <Button
                  onClick={sendBroadcastToCurrent}
                  disabled={!broadcastMessage.trim()}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                  title={`Dërgo te ${broadcastRecipients[broadcastIndex]?.name ?? ''}`}
                >
                  <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
                  Dërgo në WhatsApp
                </Button>
              </>
            ) : (
              <Button onClick={() => setBroadcastOpen(false)} className="w-full">
                <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
                U përfundua — Mbyll
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Club Albania Manager &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
