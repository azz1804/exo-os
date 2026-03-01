"use client";

import { useState, useEffect } from 'react';
import { Settings, Save, Smartphone, Globe, Code2, AlertTriangle, CheckCircle2, Search, Users, Loader2 } from 'lucide-react';

type Config = {
  enabled: boolean;
  permissions: any;
};

type Configs = {
  whatsapp: Config | null;
  comet: Config | null;
  dev: Config | null;
};

export default function Hyperconfigurator() {
  const [configs, setConfigs] = useState<Configs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Nouveaux states dédiés au chargement de contacts WhatsApp
  const [contacts, setContacts] = useState<any[] | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setConfigs(data))
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async (source: keyof Configs) => {
    if (!configs || !configs[source]) return;

    setSaving(source);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, config: configs[source] }),
      });

      if (res.ok) {
        setMessage({ text: `${source} configuration saved!`, type: 'success' });
      } else {
        setMessage({ text: `Failed to save ${source}`, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: `Error connecting to server`, type: 'error' });
    }
    setSaving(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (data.contacts) {
        setContacts(data.contacts);
        updatePermission('whatsapp', 'contacts', data.authorized);
      }
    } catch (e) {
      console.error(e);
      setMessage({ text: `Failed to load contacts`, type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    }
    setLoadingContacts(false);
  };

  const updatePermission = (source: keyof Configs, key: string, value: any) => {
    setConfigs(prev => {
      if (!prev || !prev[source]) return prev;
      return {
        ...prev,
        [source]: {
          ...prev[source]!,
          permissions: {
            ...prev[source]!.permissions,
            [key]: value
          }
        }
      };
    });
  };

  const updateEnabled = (source: keyof Configs, value: boolean) => {
    setConfigs(prev => {
      if (!prev || !prev[source]) return prev;
      return {
        ...prev,
        [source]: {
          ...prev[source]!,
          enabled: value
        }
      };
    });
  };

  if (!configs) return <div className="flex h-screen items-center justify-center text-white/50">Loading Core Data...</div>;

  return (
    <div className="min-h-screen p-8 text-white/90 selection:bg-purple-500/30">
      <div className="max-w-5xl mx-auto space-y-8">

        <header className="flex items-center justify-between pb-8 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
              <Settings className="w-8 h-8 opacity-80" />
              Exo OS <span className="font-semibold">Hyperconfigurator</span>
            </h1>
            <p className="text-white/50 mt-2 text-sm">Contrôlez les nerfs optiques de vos modules MCP localement, sans code.</p>
          </div>
          {message && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* WhatsApp Card */}
          {configs.whatsapp && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500 opacity-50" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-medium">WhatsApp MCP</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={configs.whatsapp.enabled} onChange={(e) => updateEnabled('whatsapp', e.target.checked)} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-white/50 mb-1">Contacts autorisés</label>
                  {!contacts ? (
                    <button onClick={loadContacts} disabled={loadingContacts} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                      {loadingContacts ? <Loader2 className="w-4 h-4 animate-spin text-white/50" /> : <Users className="w-4 h-4" />}
                      {loadingContacts ? 'Chargement...' : 'Charger mes contacts'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-white/30" />
                        <input type="text" placeholder="Rechercher un contact..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="flex justify-between items-center text-xs text-white/50 px-1">
                        <span>{contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)).length} contacts</span>
                        <button onClick={() => {
                          const currentAuth = configs.whatsapp?.permissions?.contacts || ["all"];
                          const isAll = currentAuth.includes("all") || currentAuth.length === contacts.length;
                          updatePermission('whatsapp', 'contacts', isAll ? [] : ["all"]);
                        }} className="hover:text-emerald-400">
                          Tout {configs.whatsapp?.permissions?.contacts?.includes("all") ? 'désélectionner' : 'sélectionner'}
                        </button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                        {contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)).map(c => {
                          const currentAuth = configs.whatsapp?.permissions?.contacts || ["all"];
                          const isChecked = currentAuth.includes("all") || currentAuth.includes(c.phone);
                          return (
                            <label key={c.jid} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer">
                              <input type="checkbox" checked={isChecked} onChange={(e) => {
                                let current = [...currentAuth];
                                if (current.includes("all")) current = contacts.map(ct => ct.phone);

                                if (e.target.checked) {
                                  current.push(c.phone);
                                  // Dédupliquer par sécurité
                                  current = Array.from(new Set(current));
                                  if (current.length === contacts.length) current = ["all"];
                                } else {
                                  current = current.filter(p => p !== c.phone);
                                }
                                updatePermission('whatsapp', 'contacts', current);
                              }} className="w-4 h-4 accent-emerald-500 bg-black/50 border-white/20 rounded" />
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-white text-sm truncate">{c.name}</span>
                                <span className="text-white/30 text-xs">{c.phone}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-white/50 mb-1">Max Messages</label>
                  <input type="number" value={configs.whatsapp.permissions.max_messages} onChange={(e) => updatePermission('whatsapp', 'max_messages', parseInt(e.target.value) || 0)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-white/50 mb-1">Max Age (Hours)</label>
                  <input type="number" value={configs.whatsapp.permissions.max_age_hours} onChange={(e) => updatePermission('whatsapp', 'max_age_hours', parseInt(e.target.value) || 0)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/70">Include Groups</span>
                  <input type="checkbox" checked={configs.whatsapp.permissions.include_group_chats} onChange={(e) => updatePermission('whatsapp', 'include_group_chats', e.target.checked)} className="w-4 h-4 accent-emerald-500 bg-black/50 border-white/20 rounded" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/70">Include Media</span>
                  <input type="checkbox" checked={configs.whatsapp.permissions.include_media_captions} onChange={(e) => updatePermission('whatsapp', 'include_media_captions', e.target.checked)} className="w-4 h-4 accent-emerald-500 bg-black/50 border-white/20 rounded" />
                </div>
              </div>

              <button onClick={() => handleSave('whatsapp')} disabled={saving === 'whatsapp'} className="mt-8 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 border border-white/5 rounded-xl py-2.5 transition-all text-sm font-medium cursor-pointer">
                <Save className="w-4 h-4" />
                {saving === 'whatsapp' ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          )}

          {/* Comet Card */}
          {configs.comet && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-50" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-medium">Comet MCP</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={configs.comet.enabled} onChange={(e) => updateEnabled('comet', e.target.checked)} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-white/50 mb-1">Max Entries</label>
                  <input type="number" value={configs.comet.permissions.max_entries} onChange={(e) => updatePermission('comet', 'max_entries', parseInt(e.target.value) || 0)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-white/50 mb-1">Max Age (Hours)</label>
                  <input type="number" value={configs.comet.permissions.max_age_hours} onChange={(e) => updatePermission('comet', 'max_age_hours', parseInt(e.target.value) || 0)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/70">Search Engines Only</span>
                  <input type="checkbox" checked={configs.comet.permissions.search_engines_only} onChange={(e) => updatePermission('comet', 'search_engines_only', e.target.checked)} className="w-4 h-4 accent-blue-500 bg-black/50 border-white/20 rounded" />
                </div>
                <div>
                  <label className="block text-white/50 mb-1">Excluded Domains (csv)</label>
                  <input type="text" value={configs.comet.permissions.exclude_domains?.join(', ') || ''} onChange={(e) => updatePermission('comet', 'exclude_domains', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors" placeholder="facebook.com, twitter.com" />
                </div>
              </div>

              <button onClick={() => handleSave('comet')} disabled={saving === 'comet'} className="mt-8 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-blue-500/20 hover:text-blue-400 border border-white/5 rounded-xl py-2.5 transition-all text-sm font-medium cursor-pointer">
                <Save className="w-4 h-4" />
                {saving === 'comet' ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          )}

          {/* Dev Card */}
          {configs.dev && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-500 opacity-50" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-medium">Dev MCP</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={configs.dev.enabled} onChange={(e) => updateEnabled('dev', e.target.checked)} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-white/50 mb-1">Max Commits</label>
                  <input type="number" value={configs.dev.permissions.max_commits} onChange={(e) => updatePermission('dev', 'max_commits', parseInt(e.target.value) || 0)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-white/50 mb-1">Allowed Repos (csv)</label>
                  <input type="text" value={configs.dev.permissions.repos?.join(', ') || ''} onChange={(e) => updatePermission('dev', 'repos', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 transition-colors" placeholder="Laissez vide pour tous" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/70">Fetch Git Diffs</span>
                  <input type="checkbox" checked={configs.dev.permissions.include_diffs} onChange={(e) => updatePermission('dev', 'include_diffs', e.target.checked)} className="w-4 h-4 accent-purple-500 bg-black/50 border-white/20 rounded" />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/70">Include TODO/FIXME</span>
                  <input type="checkbox" checked={configs.dev.permissions.include_todos} onChange={(e) => updatePermission('dev', 'include_todos', e.target.checked)} className="w-4 h-4 accent-purple-500 bg-black/50 border-white/20 rounded" />
                </div>
              </div>

              <button onClick={() => handleSave('dev')} disabled={saving === 'dev'} className="mt-8 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-purple-500/20 hover:text-purple-400 border border-white/5 rounded-xl py-2.5 transition-all text-sm font-medium cursor-pointer">
                <Save className="w-4 h-4" />
                {saving === 'dev' ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
