'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Users, TrendingUp, Calendar, Plus, Pencil, Trash2,
  CheckCircle, Clock, AlertCircle, UserPlus, CreditCard, Search,
  Volleyball, Eye, LogOut, Lock, Loader2, Camera, X
} from 'lucide-react';

// Types
interface Player {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  jerseyNumber: number | null;
  photo: string | null;
  joinDate: string;
  active: boolean;
  payments?: Payment[];
}

interface Payment {
  id: string;
  playerId: string;
  player?: Player;
  month: number;
  year: number;
  amount: number;
  status: string;
  paidDate: string | null;
  notes: string | null;
  paymentType?: string;
  planId?: string | null;
  planStartDate?: string | null;
  planEndDate?: string | null;
  dueDate?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}

interface Stats {
  totalPlayers: number;
  currentMonth: {
    month: number;
    year: number;
    paid: number;
    pending: number;
    totalExpected: number;
    collectionRate: number;
    amountCollected: number;
  };
  overall: {
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  recentPayments: (Payment & { player: Player })[];
  playersNotPaidThisMonth: Player[];
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

const POSITIONS = [
  'Pasues', 'Sulmues Jashtë', 'Sulmues Kundër',
  'Bllokues Mesor', 'Libero', 'Specialist Mbrojtës'
];

// Format currency in ALL (Albanian Lek)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sq-AL', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ALL';
};

export default function VolleyballTeamManager() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [payments, setPayments] = useState<(Payment & { player: Player })[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

  // Filter states
  const [paymentMonthFilter, setPaymentMonthFilter] = useState<string>('all');
  const [paymentYearFilter, setPaymentYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [playerSearch, setPlayerSearch] = useState('');

  // Photo state
  const [playerPhoto, setPlayerPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Player form
  const [playerForm, setPlayerForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    jerseyNumber: '',
    joinDate: new Date().toISOString().split('T')[0],
    active: true,
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    playerId: '',
    paymentType: 'monthly',
    totalAmount: '5000',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    installments: '3',
    status: 'pending',
    notes: '',
    // Legacy fields for edit mode
    month: (new Date().getMonth() + 1).toString(),
    year: new Date().getFullYear().toString(),
    amount: '5000',
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
    }
    setLoginLoading(false);
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

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams();
      if (paymentMonthFilter !== 'all') params.append('month', paymentMonthFilter);
      if (paymentYearFilter !== 'all') params.append('year', paymentYearFilter);
      if (paymentStatusFilter !== 'all') params.append('status', paymentStatusFilter);

      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    }
  };

  useEffect(() => {
    if (authenticated) {
      const initFetch = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchPlayers(), fetchPayments()]);
        setLoading(false);
      };
      initFetch();
    }
  }, [authenticated]);

  useEffect(() => {
    if (authenticated) {
      fetchPayments();
    }
  }, [paymentMonthFilter, paymentYearFilter, paymentStatusFilter, authenticated]);

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Fotoja nuk duhet të jetë më e madhe se 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPlayerPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPlayerPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Player CRUD operations
  const handleCreatePlayer = async () => {
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...playerForm, photo: playerPhoto }),
      });
      if (!res.ok) throw new Error('Failed to create player');
      toast.success('Lojtari u shtua me sukses');
      setPlayerDialogOpen(false);
      resetPlayerForm();
      fetchPlayers();
      fetchStats();
    } catch {
      toast.error('Shtimi i lojtarit dështoi');
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    try {
      const res = await fetch(`/api/players/${editingPlayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...playerForm,
          photo: playerPhoto !== undefined ? playerPhoto : editingPlayer.photo
        }),
      });
      if (!res.ok) throw new Error('Failed to update player');
      toast.success('Lojtari u përditësua me sukses');
      setPlayerDialogOpen(false);
      setEditingPlayer(null);
      resetPlayerForm();
      fetchPlayers();
      fetchStats();
    } catch {
      toast.error('Përditësimi i lojtarit dështoi');
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm('A jeni të sigurt që doni të fshini këtë lojtar? Të gjitha pagesat e tij do të fshiren gjithashtu.')) return;
    try {
      const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete player');
      toast.success('Lojtari u fshi me sukses');
      fetchPlayers();
      fetchStats();
    } catch {
      toast.error('Fshirja e lojtarit dështoi');
    }
  };

  // Payment CRUD operations
  const handleCreatePayment = async () => {
    try {
      const payload = editingPayment
        ? {
          month: paymentForm.month,
          year: paymentForm.year,
          amount: paymentForm.amount,
          status: paymentForm.status,
          notes: paymentForm.notes,
        }
        : {
          playerId: paymentForm.playerId,
          paymentType: paymentForm.paymentType,
          totalAmount: paymentForm.totalAmount,
          startDate: paymentForm.startDate,
          endDate: paymentForm.endDate,
          installments: paymentForm.installments,
          status: paymentForm.status,
          notes: paymentForm.notes,
        };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment');

      const count = data.count ?? 1;
      const totalPlanned = data.totalPlanned;
      if (totalPlanned && totalPlanned > 1) {
        toast.success(`Plani u krijua: fatura e parë u shtua (${totalPlanned} fatura gjithsej)`);
      } else {
        toast.success(`${count} faturë u shtua me sukses`);
      }
      setPaymentDialogOpen(false);
      resetPaymentForm();
      fetchPayments();
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Shtimi i pagesës dështoi';
      toast.error(message);
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      });
      if (!res.ok) throw new Error('Failed to update payment');
      toast.success('Pagesa u përditësua me sukses');
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      resetPaymentForm();
      fetchPayments();
      fetchStats();
    } catch {
      toast.error('Përditësimi i pagesës dështoi');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('A jeni të sigurt që doni të fshini këtë pagesë?')) return;
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete payment');
      toast.success('Pagesa u fshi me sukses');
      fetchPayments();
      fetchStats();
    } catch {
      toast.error('Fshirja e pagesës dështoi');
    }
  };

  // Mark payment as paid
  const handleMarkAsPaid = async (payment: Payment) => {
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payment, status: 'paid' }),
      });
      if (!res.ok) throw new Error('Failed to update payment');
      toast.success('Pagesa u shënua si e paguar');
      fetchPayments();
      fetchStats();
    } catch {
      toast.error('Përditësimi i pagesës dështoi');
    }
  };

  // Reset forms
  const resetPlayerForm = () => {
    setPlayerForm({
      name: '',
      email: '',
      phone: '',
      position: '',
      jerseyNumber: '',
      joinDate: new Date().toISOString().split('T')[0],
      active: true,
    });
    setPlayerPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      playerId: '',
      paymentType: 'monthly',
      totalAmount: '5000',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      installments: '3',
      status: 'pending',
      notes: '',
      month: (new Date().getMonth() + 1).toString(),
      year: new Date().getFullYear().toString(),
      amount: '5000',
    });
  };

  // Open edit dialogs
  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({
      name: player.name,
      email: player.email || '',
      phone: player.phone || '',
      position: player.position || '',
      jerseyNumber: player.jerseyNumber?.toString() || '',
      joinDate: new Date(player.joinDate).toISOString().split('T')[0],
      active: player.active,
    });
    setPlayerPhoto(player.photo);
    setPlayerDialogOpen(true);
  };

  const openEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentForm({
      playerId: payment.playerId,
      paymentType: payment.paymentType || 'monthly',
      totalAmount: payment.amount.toString(),
      startDate: payment.dueDate
        ? new Date(payment.dueDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      endDate: payment.planEndDate
        ? new Date(payment.planEndDate).toISOString().split('T')[0]
        : '',
      installments: payment.totalInstallments?.toString() || '3',
      status: payment.status,
      notes: payment.notes || '',
      month: payment.month.toString(),
      year: payment.year.toString(),
      amount: payment.amount.toString(),
    });
    setPaymentDialogOpen(true);
  };

  // Filter players
  const filteredPlayers = (players || []).filter(player =>
    player?.name?.toLowerCase().includes(playerSearch.toLowerCase()) ||
    player?.email?.toLowerCase().includes(playerSearch.toLowerCase()) ||
    player?.position?.toLowerCase().includes(playerSearch.toLowerCase())
  );

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Paguar</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Në pritje</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500 hover:bg-red-600"><AlertCircle className="w-3 h-3 mr-1" />Vonë</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
          <Volleyball className="w-16 h-16 mx-auto animate-bounce text-orange-500" />
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Po ngarkohet...</p>
        </div>
      </div>
    );
  }

  // Login page
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <Volleyball className="w-10 h-10 text-orange-500" />
            </div>
            <CardTitle className="text-2xl">Club Albania Manager Portal</CardTitle>
            <CardDescription>Hyni për të menaxhuar ekipin tuaj</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Përdoruesi</Label>
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
                <Label htmlFor="password">Fjalëkalimi</Label>
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
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Duke hyrë...
                  </>
                ) : (
                  'Hyr'
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
          <Volleyball className="w-16 h-16 mx-auto animate-bounce text-orange-500" />
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Po ngarkohet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volleyball className="w-10 h-10 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Club Albania Manager Portal</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Mirë se vini, {admin?.name || admin?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Shto Lojtar
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Dil
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard">
              <TrendingUp className="w-4 h-4 mr-2" />
              Përgjithësi
            </TabsTrigger>
            <TabsTrigger value="players">
              <Users className="w-4 h-4 mr-2" />
              Lojtarët
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="w-4 h-4 mr-2" />
              Pagesat
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Totali i Lojtarëve</CardTitle>
                  <Users className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalPlayers || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">Anëtarë aktivë të ekipit</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Norma e Arkëtimit</CardTitle>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.currentMonth.collectionRate.toFixed(0) || 0}%
                  </div>
                  <Progress value={stats?.currentMonth.collectionRate || 0} className="mt-2 h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Këtë Muaj</CardTitle>
                  <Calendar className="w-5 h-5 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats?.currentMonth.paid || 0}/{stats?.currentMonth.totalExpected || 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pagesa të arkëtuara</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Shuma e Arkëtuar</CardTitle>
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats?.currentMonth.amountCollected || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Këtë muaj</p>
                </CardContent>
              </Card>
            </div>

            {/* Current Month Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Statusi i Pagesave - {MONTHS[(stats?.currentMonth.month || 1) - 1]} {stats?.currentMonth.year}
                </CardTitle>
                <CardDescription>Përmbledhje e arkëtimit të pagesave këtë muaj</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.currentMonth.paid || 0}</div>
                    <div className="text-sm text-gray-500">Paguar</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <Clock className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.currentMonth.pending || 0}</div>
                    <div className="text-sm text-gray-500">Në pritje</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{(stats?.currentMonth.totalExpected || 0) - (stats?.currentMonth.paid || 0) - (stats?.currentMonth.pending || 0)}</div>
                    <div className="text-sm text-gray-500">Pa filluar</div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                                {MONTHS[payment.month - 1]} {payment.year}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">{formatCurrency(payment.amount)}</div>
                            <div className="text-xs text-gray-500">
                              {payment.paidDate ? new Date(payment.paidDate).toLocaleDateString('sq-AL') : ''}
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
                  <CardDescription>Lojtarët që nuk kanë paguar këtë muaj</CardDescription>
                </CardHeader>
                <CardContent>
                  {!stats?.playersNotPaidThisMonth || stats.playersNotPaidThisMonth.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                      <p className="text-gray-500">Të gjithë lojtarët kanë paguar këtë muaj!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.playersNotPaidThisMonth.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getPlayerAvatar(player, 'md')}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{player.name}</div>
                              <div className="text-sm text-gray-500">{player.position || 'Pa pozicion'}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentForm({
                                ...paymentForm,
                                playerId: player.id,
                                startDate: new Date().toISOString().split('T')[0],
                              });
                              setEditingPayment(null);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Shto Pagesë
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
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Kërko lojtarë..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Lojtar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPlayers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">Nuk u gjetën lojtarë</p>
                    <Button onClick={() => { resetPlayerForm(); setEditingPlayer(null); setPlayerDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Lojtarin e Parë
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Foto</TableHead>
                          <TableHead>Emri</TableHead>
                          <TableHead>Pozicioni</TableHead>
                          <TableHead>Numri</TableHead>
                          <TableHead>Kontakti</TableHead>
                          <TableHead>Statusi</TableHead>
                          <TableHead className="text-right">Veprimet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPlayers.map((player) => (
                          <TableRow key={player.id}>
                            <TableCell>
                              {getPlayerAvatar(player, 'md')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {player.name}
                            </TableCell>
                            <TableCell>{player.position || '-'}</TableCell>
                            <TableCell>{player.jerseyNumber || '-'}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{player.email || '-'}</div>
                                <div className="text-gray-500">{player.phone || ''}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={player.active ? 'default' : 'secondary'}>
                                {player.active ? 'Aktiv' : 'Joaktiv'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewingPlayer(player)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditPlayer(player)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => handleDeletePlayer(player.id)}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Regjistri i Pagesave</CardTitle>
                    <CardDescription>Ndjekni statusin e pagesave mujore</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={paymentMonthFilter} onValueChange={setPaymentMonthFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Muaji" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Të gjithë</SelectItem>
                        {MONTHS.map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={paymentYearFilter} onValueChange={setPaymentYearFilter}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Viti" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Të gjithë</SelectItem>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Statusi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Të gjithë</SelectItem>
                        <SelectItem value="paid">Paguar</SelectItem>
                        <SelectItem value="pending">Në pritje</SelectItem>
                        <SelectItem value="overdue">Vonë</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => { resetPaymentForm(); setEditingPayment(null); setPaymentDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Pagesë
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/payments/generate-due', { method: 'POST' });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          toast.success(data.message || 'Faturat u gjeneruan');
                          fetchPayments();
                          fetchStats();
                        } catch {
                          toast.error('Gjenerimi i faturave dështoi');
                        }
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Gjeneroni Faturat
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">Nuk u gjetën regjistrime pagesash</p>
                    <Button onClick={() => { resetPaymentForm(); setEditingPayment(null); setPaymentDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Shto Pagesën e Parë
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lojtari</TableHead>
                          <TableHead>Periudha</TableHead>
                          <TableHead>Lloji</TableHead>
                          <TableHead>Shuma</TableHead>
                          <TableHead>Statusi</TableHead>
                          <TableHead>Afati</TableHead>
                          <TableHead className="text-right">Veprimet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {getPlayerAvatar(payment.player, 'sm')}
                                {payment.player?.name || 'I panjohur'}
                              </div>
                            </TableCell>
                            <TableCell>{MONTHS[payment.month - 1]} {payment.year}</TableCell>
                            <TableCell>
                              {payment.paymentType === 'installment' ? (
                                <div>
                                  <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">
                                    Këst {payment.installmentNumber}/{payment.totalInstallments}
                                  </Badge>
                                </div>
                              ) : payment.paymentType === 'monthly' && payment.planId ? (
                                <div>
                                  <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                                    Mujore {payment.installmentNumber}/{payment.totalInstallments}
                                  </Badge>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Mujore
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell>
                              {payment.dueDate
                                ? new Date(payment.dueDate).toLocaleDateString('sq-AL')
                                : payment.paidDate
                                  ? new Date(payment.paidDate).toLocaleDateString('sq-AL')
                                  : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {payment.status !== 'paid' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleMarkAsPaid(payment)}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Shëno Paguar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditPayment(payment)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => handleDeletePayment(payment.id)}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Player Dialog */}
      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
                      className="w-20 h-20 rounded-full object-cover border-2 border-orange-300"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
                      onClick={removePhoto}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 border-2 border-dashed border-gray-300 dark:border-gray-600"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {playerPhoto ? 'Ndrysho Foton' : 'Ngarko Foto'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">Maksimumi 2MB, JPG/PNG</p>
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Pozicioni</Label>
                <Select value={playerForm.position} onValueChange={(value) => setPlayerForm({ ...playerForm, position: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Zgjidhni pozicionin" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>{pos}</SelectItem>
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
            <div className="grid grid-cols-2 gap-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPlayerDialogOpen(false); setEditingPlayer(null); resetPlayerForm(); }}>
              Anulo
            </Button>
            <Button onClick={editingPlayer ? handleUpdatePlayer : handleCreatePlayer}>
              {editingPlayer ? 'Përditëso' : 'Shto'} Lojtarin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) { setEditingPayment(null); resetPaymentForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Përditëso Faturën' : 'Shto Pagesë të Re'}</DialogTitle>
            <DialogDescription>
              {editingPayment
                ? 'Përditësoni shumën, statusin ose shënimet e kësaj fature'
                : 'Zgjidhni llojin e pagesës dhe periudhën'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">

            {/* ── EDIT MODE: simple per-invoice fields ── */}
            {editingPayment ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount">Shuma (ALL) *</Label>
                    <Input
                      id="edit-amount"
                      type="number"
                      step="100"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Statusi</Label>
                    <Select value={paymentForm.status} onValueChange={(value) => setPaymentForm({ ...paymentForm, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Në pritje</SelectItem>
                        <SelectItem value="paid">Paguar</SelectItem>
                        <SelectItem value="overdue">Vonë</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Shënime</Label>
                  <Input
                    id="edit-notes"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Shënime opsionale"
                  />
                </div>
              </>
            ) : (
              <>
                {/* ── CREATE MODE ── */}

                {/* Player selector */}
                <div className="space-y-2">
                  <Label htmlFor="playerId">Lojtari *</Label>
                  <Select value={paymentForm.playerId} onValueChange={(value) => setPaymentForm({ ...paymentForm, playerId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Zgjidhni lojtarin" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.filter(p => p.active).map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} {player.jerseyNumber ? `(#${player.jerseyNumber})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment type toggle */}
                <div className="space-y-2">
                  <Label>Lloji i Pagesës *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, paymentType: 'monthly' })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${paymentForm.paymentType === 'monthly'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                    >
                      <Calendar className="w-4 h-4" />
                      Mujore
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, paymentType: 'installment' })}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${paymentForm.paymentType === 'installment'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Me Këste
                    </button>
                  </div>
                </div>

                {/* Start & End Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data e Fillimit *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={paymentForm.startDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">
                      {paymentForm.paymentType === 'installment' ? 'Data e Mbarimit (opsionale)' : 'Data e Mbarimit *'}
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={paymentForm.endDate}
                      min={paymentForm.startDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, endDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Installment count (only for installment type) */}
                {paymentForm.paymentType === 'installment' && (
                  <div className="space-y-2">
                    <Label htmlFor="installments">Numri i Kësteve *</Label>
                    <Input
                      id="installments"
                      type="number"
                      min="1"
                      max="60"
                      value={paymentForm.installments}
                      onChange={(e) => setPaymentForm({ ...paymentForm, installments: e.target.value })}
                      placeholder="3"
                    />
                  </div>
                )}

                {/* Total amount + per-invoice preview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Shuma Totale (ALL) *</Label>
                    <Input
                      id="totalAmount"
                      type="number"
                      step="100"
                      value={paymentForm.totalAmount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, totalAmount: e.target.value })}
                      placeholder="15000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-status">Statusi Fillestar</Label>
                    <Select value={paymentForm.status} onValueChange={(value) => setPaymentForm({ ...paymentForm, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Në pritje</SelectItem>
                        <SelectItem value="paid">Paguar</SelectItem>
                        <SelectItem value="overdue">Vonë</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Invoice preview badge */}
                {(() => {
                  let invoiceCount = 0;
                  let perInvoice = 0;
                  let previewNote = '';

                  if (paymentForm.paymentType === 'installment') {
                    invoiceCount = parseInt(paymentForm.installments) || 0;
                    perInvoice = invoiceCount > 0 ? Math.round((parseFloat(paymentForm.totalAmount) / invoiceCount) * 100) / 100 : 0;
                    previewNote = invoiceCount > 0 ? `Të gjitha ${invoiceCount} faturat krijohen menjëherë` : '';
                  } else if (paymentForm.startDate && paymentForm.endDate) {
                    const start = new Date(paymentForm.startDate);
                    const end = new Date(paymentForm.endDate);
                    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                    invoiceCount = Math.max(0, months);
                    perInvoice = parseFloat(paymentForm.totalAmount) || 0;
                    previewNote = invoiceCount > 1 ? `Vetëm fatura e parë krijohet tani, të tjerat çdo muaj` : '';
                  }

                  if (invoiceCount <= 0 || !paymentForm.totalAmount) return null;

                  return (
                    <div className={`flex items-start gap-3 p-3 rounded-lg ${paymentForm.paymentType === 'installment'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800'
                      }`}>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${paymentForm.paymentType === 'installment' ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                          Do të krijohen {invoiceCount} fatura
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(perInvoice)} / faturë · {previewNote}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <Label htmlFor="notes">Shënime</Label>
                  <Input
                    id="notes"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Shënime opsionale"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaymentDialogOpen(false); setEditingPayment(null); resetPaymentForm(); }}>
              Anulo
            </Button>
            <Button onClick={editingPayment ? handleUpdatePayment : handleCreatePayment}>
              {editingPayment ? 'Përditëso' : 'Shto'} Pagesën
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Player View Dialog */}
      <Dialog open={!!viewingPlayer} onOpenChange={() => setViewingPlayer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detajet e Lojtarit</DialogTitle>
          </DialogHeader>
          {viewingPlayer && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {getPlayerAvatar(viewingPlayer, 'lg')}
                <div>
                  <h3 className="text-xl font-semibold">{viewingPlayer.name}</h3>
                  <p className="text-gray-500">{viewingPlayer.position || 'Pa pozicion të caktuar'}</p>
                  {viewingPlayer.jerseyNumber && (
                    <Badge className="mt-1">#{viewingPlayer.jerseyNumber}</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p className="font-medium">{viewingPlayer.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Telefoni</Label>
                  <p className="font-medium">{viewingPlayer.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Data e Bashkimit</Label>
                  <p className="font-medium">{new Date(viewingPlayer.joinDate).toLocaleDateString('sq-AL')}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Statusi</Label>
                  <Badge variant={viewingPlayer.active ? 'default' : 'secondary'}>
                    {viewingPlayer.active ? 'Aktiv' : 'Joaktiv'}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-gray-500">Historia e Pagesave</Label>
                {viewingPlayer.payments && viewingPlayer.payments.length > 0 ? (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {viewingPlayer.payments.slice(0, 5).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm">{MONTHS[payment.month - 1]} {payment.year}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(payment.amount)}</span>
                          {getStatusBadge(payment.status)}
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
