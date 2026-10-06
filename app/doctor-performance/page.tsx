'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';

type RangePreset = 'week' | 'month' | 'custom';

interface DoctorPerformanceRow {
  doctor_id: string;
  doctor_name: string;
  department: string | null;
  active: boolean;
  total: number;
  booked: number;
  attended: number;
  missed: number;
  cancelled: number;
  noShowRate: number;
}

interface PerformanceTotals {
  total: number;
  booked: number;
  attended: number;
  missed: number;
  cancelled: number;
  noShowRate: number;
}

// ------------------------- date helpers (browser-local time) -------------------------
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function dayEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeekMonday(d: Date): Date {
  const base = dayStart(d);
  const day = base.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffSinceMonday = (day + 6) % 7;
  base.setDate(base.getDate() - diffSinceMonday);
  return base;
}

function resolveRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string
): { from: Date; to: Date } {
  const now = new Date();

  if (preset === 'week') {
    const start = startOfWeekMonday(now);
    const end = dayEnd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return { from: start, to: end };
  }

  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = dayEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { from: start, to: end };
  }

  // Custom range (falls back sensibly when a picker is empty)
  let from = customFrom
    ? dayStart(new Date(`${customFrom}T00:00:00`))
    : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  let to = customTo
    ? dayEnd(new Date(`${customTo}T00:00:00`))
    : dayEnd(now);

  if (from.getTime() > to.getTime()) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

function StatCard({
  label,
  value,
  valueClass,
  dotClass,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  valueClass: string;
  dotClass: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`w-2 h-2 rounded-full ${dotClass}`}></span>
      </div>
      {loading ? (
        <div className="h-8 w-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
      ) : (
        <p className={`text-2xl font-extrabold mt-1 ${valueClass}`}>{value}</p>
      )}
    </div>
  );
}

export default function DoctorPerformancePage() {
  const { clinic } = useAuth();

  const now = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<RangePreset>('month');
  const [customFrom, setCustomFrom] = useState(() =>
    toDateInput(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [customTo, setCustomTo] = useState(() => toDateInput(now));

  const [rows, setRows] = useState<DoctorPerformanceRow[]>([]);
  const [totals, setTotals] = useState<PerformanceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      try {
        setError(null);
        const fromIso = range.from.toISOString();
        const toIso = range.to.toISOString();
        const res = await fetch(
          `/api/doctor-performance?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load doctor performance');
        }
        const data = await res.json();
        if (!cancelled) {
          setRows(data.rows || []);
          setTotals(data.totals || null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading doctor performance');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPerformance();

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, refreshCount]);

  const handlePresetChange = (newPreset: RangePreset) => {
    setPreset(newPreset);
    setLoading(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
    setLoading(true);
  };

  const handleCustomToChange = (val: string) => {
    setCustomTo(val);
    setLoading(true);
  };

  // Busiest doctors first, then alphabetically
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.doctor_name.localeCompare(b.doctor_name);
    });
  }, [rows]);

  const rangeLabel = `${range.from.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} – ${range.to.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const noShowTone = (rate: number) => {
    if (rate >= 25) return 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300';
    if (rate >= 10) return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300';
  };

  const presets: { key: RangePreset; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header + range controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
                Staff Only
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Clinic: <strong className="text-slate-700 dark:text-slate-200">{clinic?.name || 'Your Clinic'}</strong>
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Doctor Performance</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Appointment breakdown and no-show rates per doctor for the selected period.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePresetChange(p.key)}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    preset === p.key
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => handleCustomFromChange(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 bg-white dark:bg-slate-800"
                />
                <span className="text-slate-400 dark:text-slate-500">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => handleCustomToChange(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 bg-white dark:bg-slate-800"
                />
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 -mt-3">Selected range: {rangeLabel}</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Appointments"
            value={totals?.total ?? 0}
            valueClass="text-slate-900 dark:text-white"
            dotClass="bg-slate-400"
            loading={loading}
          />
          <StatCard
            label="Attended"
            value={totals?.attended ?? 0}
            valueClass="text-emerald-700 dark:text-emerald-400"
            dotClass="bg-emerald-500"
            loading={loading}
          />
          <StatCard
            label="Missed"
            value={totals?.missed ?? 0}
            valueClass="text-amber-700 dark:text-amber-400"
            dotClass="bg-amber-500"
            loading={loading}
          />
          <StatCard
            label="Cancelled"
            value={totals?.cancelled ?? 0}
            valueClass="text-rose-700 dark:text-rose-400"
            dotClass="bg-rose-500"
            loading={loading}
          />
          <StatCard
            label="No-show Rate"
            value={`${totals?.noShowRate ?? 0}%`}
            valueClass="text-slate-900 dark:text-white"
            dotClass="bg-blue-500"
            loading={loading}
          />
        </div>

        {/* Per-doctor table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Per-Doctor Breakdown</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No-show rate percentage = missed &divide; total booked appointments.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-sky-700 dark:hover:text-sky-400 transition disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.07 9A7.5 7.5 0 0118.93 9M18.93 15A7.5 7.5 0 015.07 15" />
              </svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="overflow-x-auto animate-pulse">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Doctor</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 text-center">Total Booked</th>
                    <th className="py-3.5 px-4 text-center">Attended</th>
                    <th className="py-3.5 px-4 text-center">Missed</th>
                    <th className="py-3.5 px-4 text-center">Cancelled</th>
                    <th className="py-3.5 px-4 text-center">No-show Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                          <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="h-4 w-8 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="h-4 w-8 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="h-4 w-8 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="h-4 w-8 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="h-6 w-14 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : error ? (
            <div className="py-16 text-center px-4">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Could not load performance data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 transition"
              >
                Try again
              </button>
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No doctors found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Add doctors to your clinic to see their performance here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Doctor</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 text-center">Total Booked</th>
                    <th className="py-3.5 px-4 text-center">Attended</th>
                    <th className="py-3.5 px-4 text-center">Missed</th>
                    <th className="py-3.5 px-4 text-center">Cancelled</th>
                    <th className="py-3.5 px-4 text-center">No-show Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedRows.map((row) => (
                    <tr key={row.doctor_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {row.doctor_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {row.doctor_name}
                            </p>
                            {!row.active && (
                              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {row.department || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm font-bold text-slate-900 dark:text-white">
                        {row.total}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        {row.attended}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {row.missed}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm font-semibold text-rose-700 dark:text-rose-400">
                        {row.cancelled}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${noShowTone(
                            row.noShowRate
                          )}`}
                        >
                          {row.noShowRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white">
                      <td className="py-3.5 px-4 sm:px-6 text-sm" colSpan={2}>
                        Clinic Totals
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm">
                        {totals.total}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm text-emerald-700 dark:text-emerald-400">
                        {totals.attended}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm text-amber-700 dark:text-amber-400">
                        {totals.missed}
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm text-rose-700 dark:text-rose-400">
                        {totals.cancelled}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${noShowTone(
                            totals.noShowRate
                          )}`}
                        >
                          {totals.noShowRate}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              <p className="px-5 py-3 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                Total Booked includes all appointments in the range. Doctors with no appointments in the period are displayed with zero counts.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
