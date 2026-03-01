import { useState, useEffect } from 'react';
import { MessageSquareText, Loader2, CheckCircle, XCircle, Link2 } from 'lucide-react';

export default function ExtractConversation() {
    const [contacts, setContacts] = useState([]);
    const [contactJid, setContactJid] = useState('');
    const [contactName, setContactName] = useState('');
    const [since, setSince] = useState('');
    const [until, setUntil] = useState('');
    const [keyword, setKeyword] = useState('');
    const [includeLinks, setIncludeLinks] = useState(true);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/extract/contacts')
            .then(r => r.json())
            .then(setContacts)
            .catch(() => { });
    }, []);

    const handleContactChange = (e) => {
        const jid = e.target.value;
        setContactJid(jid);
        const contact = contacts.find(c => c.jid === jid);
        setContactName(contact?.name || '');
        setResult(null);
        setError(null);
    };

    const handleExtract = async () => {
        if (!contactJid) return;
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const res = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_jid: contactJid,
                    contact_name: contactName,
                    since: since || undefined,
                    until: until || undefined,
                    keyword: keyword || undefined,
                    include_links: includeLinks
                })
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Erreur inconnue');
            } else if (data.messageCount === 0) {
                setError('Aucun message trouvé avec ces filtres');
            } else {
                setResult(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
                <MessageSquareText className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-white/40">Extraire une conversation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact */}
                <div>
                    <label className="block text-xs text-white/30 mb-1.5">Contact</label>
                    <select
                        value={contactJid}
                        onChange={handleContactChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-500/50"
                    >
                        <option value="">Choisir un contact...</option>
                        {contacts.map(c => (
                            <option key={c.jid} value={c.jid}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Keyword */}
                <div>
                    <label className="block text-xs text-white/30 mb-1.5">Mot-clé (optionnel)</label>
                    <input
                        type="text"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        placeholder="bug, site, problème..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/50"
                    />
                </div>

                {/* Since */}
                <div>
                    <label className="block text-xs text-white/30 mb-1.5">Depuis</label>
                    <input
                        type="date"
                        value={since}
                        onChange={e => setSince(e.target.value)}
                        max={today}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-500/50"
                    />
                </div>

                {/* Until */}
                <div>
                    <label className="block text-xs text-white/30 mb-1.5">Jusqu'au</label>
                    <input
                        type="date"
                        value={until}
                        onChange={e => setUntil(e.target.value)}
                        max={today}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-purple-500/50"
                    />
                </div>
            </div>

            {/* Options + Bouton */}
            <div className="flex items-center justify-between mt-4">
                <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={includeLinks}
                        onChange={e => setIncludeLinks(e.target.checked)}
                        className="accent-purple-500"
                    />
                    <Link2 className="w-3.5 h-3.5" />
                    Inclure les liens
                </label>

                <button
                    onClick={handleExtract}
                    disabled={!contactJid || loading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${!contactJid || loading
                            ? 'bg-white/5 text-white/30 cursor-not-allowed'
                            : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-[0.98]'
                        }`}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareText className="w-4 h-4" />}
                    {loading ? 'Extraction...' : 'Extraire vers Notion'}
                </button>
            </div>

            {/* Résultat */}
            {result && (
                <div className="mt-4 flex items-start gap-2 text-green-400 text-xs bg-green-500/5 rounded-xl p-3 border border-green-500/10">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">{result.messageCount} messages envoyés vers Notion</p>
                        <p className="text-white/40 mt-1">{result.pageTitle}</p>
                        {result.notionUrl && (
                            <a
                                href={result.notionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 underline mt-1 inline-block"
                            >
                                Ouvrir dans Notion
                            </a>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
