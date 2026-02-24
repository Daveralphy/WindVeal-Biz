import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface TierMeta { value: string; label: string; monthlyPrice: number; aiChatLimit: number; features: string[] }
interface RoleMeta { value: string; label: string }
interface AITypeMeta { value: string; label: string }
interface FeatureMeta { key: string; label: string }

export interface AdminMetadata {
  tiers: TierMeta[];
  roles: RoleMeta[];
  aiUsageTypes: AITypeMeta[];
  featureKeys: FeatureMeta[];
}

// Tailwind-safe color presets — all classes written out so they survive purging
const BADGE_PRESETS = [
  { badge: 'text-gray-400 bg-gray-500/10 border-gray-500/20', bar: 'bg-gray-500' },
  { badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20', bar: 'bg-blue-500' },
  { badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', bar: 'bg-purple-500' },
  { badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500' },
  { badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', bar: 'bg-amber-500' },
  { badge: 'text-teal-400 bg-teal-500/10 border-teal-500/20', bar: 'bg-teal-500' },
  { badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20', bar: 'bg-rose-500' },
  { badge: 'text-red-400 bg-red-500/10 border-red-500/20', bar: 'bg-red-500' },
];

const FEATURE_BAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-purple-500', 'bg-teal-500', 'bg-rose-500',
];

// Module-level cache so multiple pages share one fetch
let cachedMetadata: AdminMetadata | null = null;
let cachePromise: Promise<AdminMetadata> | null = null;

function fetchMetadata(): Promise<AdminMetadata> {
  if (cachedMetadata) return Promise.resolve(cachedMetadata);
  if (cachePromise) return cachePromise;

  cachePromise = api.get('/admin/metadata').then((res) => {
    cachedMetadata = res.data;
    return res.data as AdminMetadata;
  }).catch((err) => {
    cachePromise = null;
    throw err;
  });

  return cachePromise;
}

export function useAdminMetadata() {
  const [metadata, setMetadata] = useState<AdminMetadata | null>(cachedMetadata);
  const [loading, setLoading] = useState(!cachedMetadata);

  useEffect(() => {
    if (cachedMetadata) {
      setMetadata(cachedMetadata);
      setLoading(false);
      return;
    }
    fetchMetadata()
      .then((data) => { setMetadata(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tierBadge = (tier: string) => {
    const idx = metadata?.tiers.findIndex((t) => t.value === tier) ?? 0;
    return BADGE_PRESETS[Math.max(0, idx) % BADGE_PRESETS.length].badge;
  };

  const tierColor = (tier: string) => {
    const idx = metadata?.tiers.findIndex((t) => t.value === tier) ?? 0;
    return BADGE_PRESETS[Math.max(0, idx) % BADGE_PRESETS.length].bar;
  };

  const tierLabel = (tier: string) =>
    metadata?.tiers.find((t) => t.value === tier)?.label ?? tier;

  const roleBadge = (role: string) => {
    const idx = metadata?.roles.findIndex((r) => r.value === role) ?? 0;
    return BADGE_PRESETS[Math.max(0, idx) % BADGE_PRESETS.length].badge;
  };

  const roleLabel = (role: string) =>
    metadata?.roles.find((r) => r.value === role)?.label ?? role.replace('_', ' ');

  const aiTypeLabel = (type: string) =>
    metadata?.aiUsageTypes.find((t) => t.value === type)?.label ?? type;

  const featureLabel = (key: string) =>
    metadata?.featureKeys.find((f) => f.key === key)?.label ?? key;

  const featureColor = (key: string) => {
    const idx = metadata?.featureKeys.findIndex((f) => f.key === key) ?? 0;
    return FEATURE_BAR_COLORS[Math.max(0, idx) % FEATURE_BAR_COLORS.length];
  };

  return {
    metadata,
    loading,
    tierBadge,
    tierColor,
    tierLabel,
    roleBadge,
    roleLabel,
    aiTypeLabel,
    featureLabel,
    featureColor,
    tiers: metadata?.tiers ?? [],
    roles: metadata?.roles ?? [],
    aiUsageTypes: metadata?.aiUsageTypes ?? [],
    featureKeys: metadata?.featureKeys ?? [],
  };
}
