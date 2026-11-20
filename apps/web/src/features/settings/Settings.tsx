import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ApiKeyMeta, User } from '../../types';
import { Key, Plus, Trash2, Copy, Check, Shield, AlertTriangle, RefreshCw } from 'lucide-react';

interface SettingsProps {
  user: User;
}

export const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [apiKeys, setApiKeys] = useState<ApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sourceSystem, setSourceSystem] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchKeys = async () => {
    if (user.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const keys = await api.getApiKeys();
      setApiKeys(keys);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceSystem.trim()) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(sourceSystem.trim());
      setGeneratedKey(res.rawKey);
      setSourceSystem('');
      fetchKeys();
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Sending systems using it will be blocked.')) {
      return;
    }
    try {
      await api.revokeApiKey(keyId);
      fetchKeys();
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const copyGeneratedKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Settings & Administration</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage API keys for external financial systems and review prototype security controls.
        </p>
      </div>

      {/* User Information Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-600" /> Current Authenticated Session
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono bg-slate-50 p-3.5 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">User</span>
            <span className="font-semibold text-slate-900">{user.displayName}</span>
            <span className="text-slate-500 block text-[11px]">{user.email}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Role</span>
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
              {user.role}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Tenant Scope</span>
            <span className="font-semibold text-slate-900">{user.tenantId}</span>
          </div>
        </div>
      </div>

      {/* API Keys Management (Admin only) */}
      {user.role === 'ADMIN' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" /> External Ingestion API Keys
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Keys used by external loan/core banking engines to push events to <code className="bg-slate-100 px-1 py-0.5 rounded">POST /api/v1/events</code>.
              </p>
            </div>
            <button
              onClick={fetchKeys}
              className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg shadow-sm"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Generated Key Modal/Alert */}
          {generatedKey && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Save this API key immediately!
              </div>
              <p className="text-amber-800">
                For security reasons, this raw key will <strong>never be shown again</strong>. Only its SHA-256 hash is stored.
              </p>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200 font-mono text-slate-900 break-all">
                <span className="flex-1 font-semibold">{generatedKey}</span>
                <button
                  onClick={copyGeneratedKey}
                  className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs hover:bg-slate-800 flex items-center gap-1 shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'Copied' : 'Copy Key'}
                </button>
              </div>
            </div>
          )}

          {/* Create Key Form */}
          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              required
              value={sourceSystem}
              onChange={(e) => setSourceSystem(e.target.value)}
              placeholder="Source system name (e.g. demo-loan-engine, fraud-sentinel)..."
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {creating ? 'Generating...' : 'Create API Key'}
            </button>
          </form>

          {/* Keys List */}
          {loading ? (
            <div className="py-6 text-center text-slate-400 text-xs">Loading keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No API keys configured. Create one above to allow sending systems to ingest events.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {apiKeys.map((k) => (
                <div key={k._id} className="p-3.5 flex items-center justify-between text-xs bg-white hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{k.sourceSystem}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                        prefix: {k.keyPrefix}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          k.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {k.isActive ? 'ACTIVE' : 'REVOKED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Created: {new Date(k.createdAt).toLocaleDateString()} • Scopes: {k.scopes.join(', ')}
                    </div>
                  </div>

                  {k.isActive && (
                    <button
                      onClick={() => handleRevokeKey(k._id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Revoke API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Role Notice</p>
          <p className="mt-1">
            API key administration is restricted to users with the <code className="font-bold">ADMIN</code> role. Your current role is <code className="font-bold">{user.role}</code>.
          </p>
        </div>
      )}

      {/* Security Principles & Limitations */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Prototype Cryptographic Boundaries</h2>
        <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5 leading-relaxed">
          <li>
            <strong>Tamper-Evident, Not Magical:</strong> Hash chains detect alterations, deletions, and inserts when verified. They do not alter physical database permissions.
          </li>
          <li>
            <strong>HMAC Key Scope:</strong> Local prototype checkpoints are signed with an HMAC secret. In enterprise production, signing keys should be KMS/HSM-backed.
          </li>
          <li>
            <strong>Data Minimisation:</strong> The permanent audit ledger contains pseudonymous <code className="font-mono">subjectRef</code> identifiers rather than direct customer PII.
          </li>
        </ul>
      </div>
    </div>
  );
};
