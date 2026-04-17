'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Volleyball, Eye, LogOut, Lock, Loader2, Camera, X, FileDown, MessageCircle
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import {
  normalizePhoneForWhatsApp,
  buildPaymentReminderMessage,
  formatDueDateForPaymentReminder,
  getPaymentReminderWhatsAppHref,
} from '@/lib/whatsappPaymentReminder';
import { getPlayerPaymentSummary, type PaymentEntry } from '@/lib/playerPaymentSummary';

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
}

interface AdminUser {
  id: string;
  username: string;
  name: string | null;
}

const MONTHS = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
];

const TEAMS = [
  'U20', 'U18', 'U16', 'U14', 'U10'
];

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

  // Photo state
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevTabRef = useRef<string | null>(null);

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
        setStats(data);
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

  useEffect(() => {
    if (!authenticated) return;
    if (prevTabRef.current !== null && prevTabRef.current !== activeTab) {
      refreshAllData();
    }
    prevTabRef.current = activeTab;
  }, [activeTab, authenticated]);

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
      const res = await fetch(`/api/players/${player.id}/payment-pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || 'Gjenerimi i PDF dështoi');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition');
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `pagesat-${player.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gjenerimi i PDF dështoi');
    } finally {
      setOperationInProgress(false);
    }
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

  // Get player avatar
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {operationInProgress && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto" aria-hidden="true">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-lg font-medium text-foreground">Po ngarkohet...</p>
          </div>
        </div>
      )}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-auto">
            <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Përgjithësi</span>
            </TabsTrigger>
            <TabsTrigger value="players" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Lojtarët</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Pagesat e Fundit</CardTitle>
                  <CardDescription>Aktivitetet e fundit të pagesave</CardDescription>
                </CardHeader>
                <CardContent>
                  {!stats?.recentPayments || stats.recentPayments.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Nuk ka pagesa të fundit</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {stats.recentPayments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{payment.player?.name || 'I panjohur'}</div>
                              <div className="text-sm text-gray-500">
                                {formatDateDisplay(payment.paidDate)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">{formatCurrency(payment.amount)}</div>
                            <div className="text-xs text-gray-500">
                              {formatDateDisplay(payment.paidDate)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Players Who Haven't Paid */}
              <Card>
                <CardHeader>
                  <CardTitle>Pagesat e Papaguara</CardTitle>
                  <CardDescription>Lojtarët me fatura të papaguara (në pritje ose vonuar)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!stats?.playersWithUnpaidBills || stats.playersWithUnpaidBills.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                      <p className="text-gray-500">Nuk ka lojtarë me fatura të papaguara</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.playersWithUnpaidBills.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getPlayerAvatar(player, 'md')}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{player.name}</div>
                              <div className="text-sm text-gray-500">{player.team || 'Pa ekip'}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTab('players')}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Shiko Lojtarët
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="space-y-6">
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
                        <div key={player.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
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
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadPlayerPaymentPdf(player)}
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
                    <div className="hidden sm:block overflow-x-auto">
                    <Table>
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
                          <TableRow key={player.id}>
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
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadPlayerPaymentPdf(player)}
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="active">Statusi</Label>
                <Select
                  value={playerForm.active ? 'active' : 'inactive'}
                  onValueChange={(value) => setPlayerForm({ ...playerForm, active: value === 'active' })}
                >
                  <SelectTrigger>
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
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => handleDownloadPlayerPaymentPdf(viewingPlayer)}
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
