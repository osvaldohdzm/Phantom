'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  KeyRound,
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Save,
  Check,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Globe,
  Database,
  FileCode,
  Lock,
  History,
  Info,
  Laptop
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  listVaultCredentials,
  createVaultCredential,
  updateVaultCredential,
  revealVaultCredential,
  deleteVaultCredential,
  getVaultCredentialAudit,
  listAssets,
  type VaultCredential,
  type VaultAuditLog,
  type CredentialType,
  type SecopsAsset
} from '@/lib/secops-api';
import { useUiT } from '@/lib/use-ui-locale';

type Props = {
  engagementId: string | null;
};

const CRED_TYPES: { value: CredentialType; label: string; icon: any }[] = [
  { value: 'ssh', label: 'SSH Key / Password', icon: Terminal },
  { value: 'rdp', label: 'RDP Credential', icon: Laptop },
  { value: 'web', label: 'Web Login', icon: Globe },
  { value: 'database', label: 'Database Credentials', icon: Database },
  { value: 'api_key', label: 'API Key', icon: FileCode },
  { value: 'certificate', label: 'Certificate / Private Key', icon: KeyRound },
];

export function AccessVaultPanel({ engagementId }: Props) {
  const { t } = useUiT();
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [selectedCred, setSelectedCred] = useState<VaultCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [label, setLabel] = useState('');
  const [credType, setCredType] = useState<CredentialType>('ssh');
  const [assetId, setAssetId] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [servicePort, setServicePort] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Reveal / decrypted state
  const [decrypted, setDecrypted] = useState<{ username?: string; secret?: string; notes?: string | null } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Lists
  const [assets, setAssets] = useState<SecopsAsset[]>([]);
  const [auditLogs, setAuditLogs] = useState<VaultAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CredentialType | 'all'>('all');

  // Copy success indicator
  const [copiedField, setCopiedField] = useState<'username' | 'secret' | 'notes' | null>(null);

  // Password Generator state
  const [genLength, setGenLength] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [credsList, assetsList] = await Promise.all([
        listVaultCredentials({ engagement_id: engagementId || undefined }),
        listAssets({ limit: 1000, engagement_id: engagementId || undefined }),
      ]);
      setCredentials(credsList);
      setAssets(assetsList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar las credenciales del vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    setSelectedCred(null);
    setIsEditing(false);
    setIsNew(false);
  }, [engagementId]);

  // Load audit logs when a credential is selected
  useEffect(() => {
    if (selectedCred && !isNew) {
      const loadAudit = async () => {
        setLoadingAudit(true);
        try {
          const logs = await getVaultCredentialAudit(selectedCred.id);
          setAuditLogs(logs);
        } catch {
          // Ignore audit loading errors
        } finally {
          setLoadingAudit(false);
        }
      };
      void loadAudit();
    } else {
      setAuditLogs([]);
    }
  }, [selectedCred, isNew]);

  const handleSelect = async (cred: VaultCredential) => {
    setSelectedCred(cred);
    setIsEditing(false);
    setIsNew(false);
    setDecrypted(null);
    setShowSecret(false);

    setLabel(cred.label);
    setCredType(cred.credential_type);
    setAssetId(cred.asset_id || '');
    setUsername('');
    setSecret('');
    setServicePort(cred.service_port || '');
    setNotes('');
  };

  const handleReveal = async () => {
    if (showSecret) {
      setShowSecret(false);
      return;
    }
    if (decrypted) {
      setShowSecret(true);
      return;
    }

    if (!selectedCred) return;
    setRevealing(true);
    try {
      const revealed = await revealVaultCredential(selectedCred.id);
      setDecrypted(revealed);
      setUsername(revealed.username);
      setSecret(revealed.secret);
      setNotes(revealed.notes || '');
      setShowSecret(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al revelar credencial');
    } finally {
      setRevealing(false);
    }
  };

  const handleNew = () => {
    setSelectedCred(null);
    setIsNew(true);
    setIsEditing(true);
    setDecrypted(null);
    setShowSecret(true);

    setLabel('');
    setCredType('ssh');
    setAssetId('');
    setUsername('');
    setSecret('');
    setServicePort('');
    setNotes('');
    setGeneratedPassword('');
  };

  const handleEdit = async () => {
    if (isNew) return;
    if (!selectedCred) return;
    if (isEditing) {
      setIsEditing(false);
      return;
    }

    setRevealing(true);
    try {
      const revealed = await revealVaultCredential(selectedCred.id);
      setDecrypted(revealed);
      setUsername(revealed.username);
      setSecret(revealed.secret);
      setNotes(revealed.notes || '');
      setIsEditing(true);
      setShowSecret(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar credenciales para edición');
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !username.trim() || !secret.trim()) {
      setError('Por favor, ingresa etiqueta, usuario y contraseña');
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const payload = {
        engagement_id: engagementId || null,
        asset_id: assetId || null,
        label: label.trim(),
        credential_type: credType,
        username: username.trim(),
        secret: secret.trim(),
        service_port: servicePort === '' ? null : Number(servicePort),
        notes: notes.trim() || null,
      };

      if (isNew) {
        const created = await createVaultCredential(payload);
        setSuccess('Credencial creada exitosamente');
        await loadData();
        setSelectedCred(created);
        setIsNew(false);
        setIsEditing(false);
        setDecrypted({ username: payload.username, secret: payload.secret, notes: payload.notes });
        setShowSecret(false);
      } else if (selectedCred) {
        const updated = await updateVaultCredential(selectedCred.id, payload);
        setSuccess('Credencial actualizada exitosamente');
        await loadData();
        setSelectedCred(updated);
        setIsEditing(false);
        setDecrypted({ username: payload.username, secret: payload.secret, notes: payload.notes });
        setShowSecret(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar la credencial');
    }
  };

  const handleDelete = async () => {
    if (!selectedCred) return;
    if (!confirm(`¿Estás seguro de eliminar la credencial "${selectedCred.label}"?`)) return;

    setError(null);
    setSuccess(null);
    try {
      await deleteVaultCredential(selectedCred.id);
      setSuccess('Credencial eliminada exitosamente');
      setSelectedCred(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar credencial');
    }
  };

  const handleCopy = (val: string, field: 'username' | 'secret' | 'notes') => {
    void navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Password Generator
  const generatePassword = () => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let allowed = '';
    if (genUpper) allowed += uppercaseChars;
    if (genLower) allowed += lowercaseChars;
    if (genNumbers) allowed += numberChars;
    if (genSymbols) allowed += symbolChars;

    if (!allowed) {
      setGeneratedPassword('');
      return;
    }

    let result = '';
    for (let i = 0; i < genLength; i++) {
      const rndIndex = Math.floor(Math.random() * allowed.length);
      result += allowed[rndIndex];
    }
    setGeneratedPassword(result);
  };

  useEffect(() => {
    if (isEditing) {
      generatePassword();
    }
  }, [genLength, genUpper, genLower, genNumbers, genSymbols, isEditing]);

  const applyGeneratedPassword = () => {
    if (generatedPassword) {
      setSecret(generatedPassword);
      setShowSecret(true);
    }
  };

  // Password strength visual indicator
  const passwordStrength = useMemo(() => {
    if (!secret) return { score: 0, label: 'Vacía', color: 'bg-muted' };
    let score = 0;
    if (secret.length >= 8) score += 1;
    if (secret.length >= 14) score += 1;
    if (/[A-Z]/.test(secret)) score += 1;
    if (/[0-9]/.test(secret)) score += 1;
    if (/[^A-Za-z0-9]/.test(secret)) score += 1;

    if (score <= 2) return { score, label: 'Débil', color: 'bg-rose-500', icon: ShieldAlert };
    if (score <= 4) return { score, label: 'Media', color: 'bg-amber-500', icon: Shield };
    return { score, label: 'Fuerte', color: 'bg-emerald-500', icon: ShieldCheck };
  }, [secret]);

  const filteredCredentials = useMemo(() => {
    return credentials.filter((c) => {
      const matchesSearch =
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || c.credential_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [credentials, search, typeFilter]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[500px]">
      {/* Sidebar List */}
      <div className="md:col-span-4 bg-muted/20 border border-border/40 rounded-xl p-4 flex flex-col space-y-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <Lock className="size-4 text-cyan-500" />
            Acceso / Vault
          </h2>
          <Button
            type="button"
            size="sm"
            onClick={handleNew}
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
          >
            <Plus className="size-3.5 mr-1" />
            Nueva
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar credencial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
        </div>

        {/* Filter Type Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-border/40 pb-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              typeFilter === 'all'
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Todas
          </button>
          {CRED_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                typeFilter === t.value
                  ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] scrollbar-thin">
          {loading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">Cargando...</div>
          ) : filteredCredentials.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">No se encontraron credenciales</div>
          ) : (
            filteredCredentials.map((c) => {
              const typeInfo = CRED_TYPES.find((t) => t.value === c.credential_type);
              const Icon = typeInfo ? typeInfo.icon : KeyRound;
              const linkedAsset = assets.find((a) => a.id === c.asset_id);
              const isSelected = selectedCred?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => void handleSelect(c)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:bg-muted/30 ${
                    isSelected
                      ? 'border-cyan-500/50 bg-cyan-500/5 dark:bg-cyan-500/10 shadow-sm'
                      : 'border-border/40 bg-background/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded bg-muted/60 text-muted-foreground mt-0.5">
                      <Icon className="size-4 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {typeInfo?.label}
                      </p>
                      {linkedAsset && (
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-cyan-600 dark:text-cyan-400 font-mono truncate">
                          <Laptop className="size-2.5" />
                          {linkedAsset.nombre}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel Details */}
      <div className="md:col-span-8 bg-background/50 border border-border/40 rounded-xl p-6 shadow-md backdrop-blur-md relative">
        {/* Status indicators */}
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-600 text-xs flex items-center gap-2">
            <ShieldAlert className="size-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs flex items-center gap-2">
            <Check className="size-4" />
            {success}
          </div>
        )}

        {!selectedCred && !isNew ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <KeyRound className="size-16 text-muted-foreground/30 stroke-1 animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground mt-4">Acceso a Credenciales & Llaves</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm">
              Selecciona una credencial del vault en la barra lateral o crea una nueva para gestionar accesos de forma cifrada (AES-256).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-border/40 pb-4">
              <div>
                <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase">
                  {isNew ? 'Nueva Credencial Cifrada' : 'Detalles del Vault'}
                </span>
                <h1 className="text-base font-bold text-foreground mt-1">
                  {isNew ? 'Agregar Credencial' : label || selectedCred?.label}
                </h1>
              </div>

              <div className="flex gap-2">
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground border-border/60 hover:bg-muted/40 font-medium"
                    onClick={handleReveal}
                    disabled={revealing}
                  >
                    {showSecret ? <EyeOff className="size-3.5 mr-1" /> : <Eye className="size-3.5 mr-1" />}
                    {showSecret ? 'Ocultar' : 'Revelar'}
                  </Button>
                )}
                {!isNew && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 text-xs font-medium border-border/60 ${
                      isEditing ? 'bg-amber-600/10 text-amber-700 dark:text-amber-400' : 'hover:bg-muted/40 text-muted-foreground'
                    }`}
                    onClick={handleEdit}
                    disabled={revealing}
                  >
                    {isEditing ? 'Modo Lectura' : 'Editar'}
                  </Button>
                )}
                {!isNew && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-rose-600 border-rose-500/20 hover:bg-rose-500/5 font-medium"
                    onClick={handleDelete}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Etiqueta / Nombre
                <input
                  type="text"
                  placeholder="ej. Servidor Producción SSH"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={!isEditing}
                  className="h-9 px-3 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75"
                />
              </label>

              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Tipo de Acceso
                <select
                  value={credType}
                  onChange={(e) => setCredType(e.target.value as CredentialType)}
                  disabled={!isEditing}
                  className="h-9 px-2 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75"
                >
                  {CRED_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Usuario / Login
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ej. root, admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!isEditing}
                    className="w-full h-9 pl-3 pr-10 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75 font-mono"
                  />
                  {username && (
                    <button
                      type="button"
                      onClick={() => handleCopy(username, 'username')}
                      className="absolute right-2 top-2 p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Copiar usuario"
                    >
                      {copiedField === 'username' ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </label>

              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Contraseña / Llave Privada / Secret
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    disabled={!isEditing}
                    className="w-full h-9 pl-3 pr-10 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75 font-mono"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {secret && (
                      <button
                        type="button"
                        onClick={() => handleCopy(secret, 'secret')}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Copiar contraseña"
                      >
                        {copiedField === 'secret' ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </label>

              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Puerto del Servicio
                <input
                  type="number"
                  placeholder="ej. 22, 3389, 443"
                  value={servicePort}
                  onChange={(e) => setServicePort(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={!isEditing}
                  className="h-9 px-3 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75 font-mono"
                />
              </label>

              <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
                Vincular a Activo (Host / App)
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  disabled={!isEditing}
                  className="h-9 px-2 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75"
                >
                  <option value="">Sin activo vinculado</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.ip_privada || a.ip_publica || a.fqdn || 'Sin IP'})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Password strength & generator - only visible when editing */}
            {isEditing && (
              <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/30 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="size-4 text-cyan-500" />
                    <span className="font-semibold text-foreground">Generador de Contraseñas Seguras</span>
                  </div>
                  {secret && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Seguridad: {passwordStrength.label}</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="flex flex-col space-y-1 text-xs text-muted-foreground">
                      Longitud ({genLength} caracteres)
                      <input
                        type="range"
                        min="8"
                        max="32"
                        value={genLength}
                        onChange={(e) => setGenLength(Number(e.target.value))}
                        className="h-6 accent-cyan-500 cursor-pointer"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={genUpper}
                          onChange={(e) => setGenUpper(e.target.checked)}
                          className="rounded border-input text-cyan-500 accent-cyan-500"
                        />
                        A-Z
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={genLower}
                          onChange={(e) => setGenLower(e.target.checked)}
                          className="rounded border-input text-cyan-500 accent-cyan-500"
                        />
                        a-z
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={genNumbers}
                          onChange={(e) => setGenNumbers(e.target.checked)}
                          className="rounded border-input text-cyan-500 accent-cyan-500"
                        />
                        0-9
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={genSymbols}
                          onChange={(e) => setGenSymbols(e.target.checked)}
                          className="rounded border-input text-cyan-500 accent-cyan-500"
                        />
                        Símbolos
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedPassword}
                        className="flex-1 h-9 px-3 rounded-lg border border-input bg-background/60 text-xs font-mono select-all focus:outline-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generatePassword}
                        className="h-9 px-3 text-xs border-border/60 hover:bg-muted/40 font-medium"
                      >
                        Generar
                      </Button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyGeneratedPassword}
                      disabled={!generatedPassword}
                      className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
                    >
                      <Check className="size-3.5 mr-1" />
                      Utilizar esta contraseña
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes textarea */}
            <label className="flex flex-col space-y-1.5 text-xs text-muted-foreground font-medium">
              Notas / Descripción / Llaves SSH Completas
              <div className="relative">
                <textarea
                  rows={4}
                  placeholder="Detalles adicionales o llaves SSH cifradas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!isEditing}
                  className="w-full p-3 rounded-lg border border-input bg-background/40 focus:ring-1 focus:ring-cyan-500 focus:outline-none disabled:opacity-75 font-mono text-xs"
                />
                {notes && (
                  <button
                    type="button"
                    onClick={() => handleCopy(notes, 'notes')}
                    className="absolute right-3 top-3 p-1 rounded hover:bg-muted text-muted-foreground"
                    title="Copiar notas"
                  >
                    {copiedField === 'notes' ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            </label>

            {/* Action buttons */}
            {isEditing && (
              <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs text-muted-foreground border-border/60 font-medium"
                  onClick={() => {
                    setIsEditing(false);
                    setIsNew(false);
                    setSuccess(null);
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
                >
                  <Save className="size-3.5 mr-1" />
                  Guardar Credencial
                </Button>
              </div>
            )}

            {/* Audit Logs Trail */}
            {!isNew && (
              <div className="border-t border-border/40 pt-6">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
                  <History className="size-4 text-cyan-500" />
                  Historial de Accesos y Auditoría
                </h3>

                {loadingAudit ? (
                  <div className="text-[10px] text-muted-foreground">Cargando bitácora de auditoría...</div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground italic">Sin eventos registrados</div>
                ) : (
                  <div className="bg-muted/10 border border-border/40 rounded-lg overflow-hidden max-h-[160px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-[10px] border-collapse text-left">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border/30">
                        <tr>
                          <th className="px-3 py-1.5 text-muted-foreground">Acción</th>
                          <th className="px-3 py-1.5 text-muted-foreground">Actor</th>
                          <th className="px-3 py-1.5 text-muted-foreground">Dirección IP</th>
                          <th className="px-3 py-1.5 text-muted-foreground">Fecha / Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/30 border-b border-border/20 last:border-0">
                            <td className="px-3 py-1.5 font-semibold capitalize text-foreground">{log.action}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{log.actor}</td>
                            <td className="px-3 py-1.5 text-muted-foreground font-mono">{log.ip_address || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
