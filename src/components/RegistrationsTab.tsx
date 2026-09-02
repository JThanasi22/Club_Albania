'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getRegistrationsLang } from '@/lang/registrations';
import type { Registration } from '@/lib/registrations';

type RegistrationsTabProps = {
  active: boolean;
  refreshToken: number;
  onCreateFromRegistration: (registration: Registration) => void;
};

const L = getRegistrationsLang('sq');

function formatDateDisplay(val: string | Date | null | undefined): string {
  if (val == null) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy');
}

function contactLabel(value: string): string {
  if (value === 'whatsapp') return L.contactWhatsapp;
  if (value === 'email') return L.contactEmail;
  return L.contactPhone;
}

function avatar(name: string, photo: string | null) {
  if (photo) {
    return <img src={photo} alt={name} className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
      <span className="font-semibold text-orange-600 dark:text-orange-400">
        {(name || '?').charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function RegistrationsTab({ active, refreshToken, onCreateFromRegistration }: RegistrationsTabProps) {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);

  const removeRow = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || L.toastDeleteError);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success(L.toastDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : L.toastDeleteError);
    }
  };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/registrations');
        const data = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching registrations:', error);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, refreshToken]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(term) ||
        (r.email || '').toLowerCase().includes(term) ||
        (r.phone || '').toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{L.pageTitle}</CardTitle>
            <CardDescription>{L.pageDescription}</CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={L.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{L.loading}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">{rows.length === 0 ? L.empty : L.emptyFilter}</p>
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {filtered.map((row) => {
                const converted = Boolean(row.playerId || row.convertedAt);
                return (
                  <div
                    key={row.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {avatar(row.name, row.photo)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{row.name}</h3>
                          <Badge variant={converted ? 'default' : 'secondary'}>
                            {converted ? L.statusConverted : L.statusPending}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                          {row.email ? <p className="truncate">{row.email}</p> : null}
                          {row.phone ? <p>{row.phone}</p> : null}
                          {row.dateOfBirth ? <p>{formatDateDisplay(row.dateOfBirth)}</p> : null}
                          <p>{contactLabel(row.preferredContact)}</p>
                          <p>{formatDateDisplay(row.submittedAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      {converted ? (
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1 mr-auto">
                          <Users className="w-4 h-4" />
                          {L.alreadyPlayer}
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => onCreateFromRegistration(row)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          {L.addAsPlayer}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(row)} title={L.deleteButton}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:block">
              <Table stickyHorizontalScroll>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L.colPhoto}</TableHead>
                    <TableHead>{L.colName}</TableHead>
                    <TableHead>{L.colEmail}</TableHead>
                    <TableHead>{L.colPhone}</TableHead>
                    <TableHead>{L.colBirthDate}</TableHead>
                    <TableHead>{L.colContact}</TableHead>
                    <TableHead>{L.colSubmitted}</TableHead>
                    <TableHead>{L.colStatus}</TableHead>
                    <TableHead className="text-right">{L.colActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const converted = Boolean(row.playerId || row.convertedAt);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{avatar(row.name, row.photo)}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.email || '-'}</TableCell>
                        <TableCell>{row.phone || '-'}</TableCell>
                        <TableCell>{row.dateOfBirth ? formatDateDisplay(row.dateOfBirth) : '-'}</TableCell>
                        <TableCell>{contactLabel(row.preferredContact)}</TableCell>
                        <TableCell>{formatDateDisplay(row.submittedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={converted ? 'default' : 'secondary'}>
                            {converted ? L.statusConverted : L.statusPending}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {converted ? (
                              <span className="text-sm text-muted-foreground">{L.alreadyPlayer}</span>
                            ) : (
                              <Button size="sm" onClick={() => onCreateFromRegistration(row)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                {L.addAsPlayer}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(row)} title={L.deleteButton}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={L.deleteTitle}
        description={deleteTarget ? L.deleteDescription(deleteTarget.name) : ''}
        confirmText={L.deleteButton}
        onConfirm={() => {
          void removeRow();
        }}
        variant="destructive"
      />
    </Card>
  );
}
