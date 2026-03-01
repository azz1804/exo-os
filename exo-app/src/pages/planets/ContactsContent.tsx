import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageSquare, Phone, ChevronDown, ChevronRight, Clock, X } from "lucide-react";
import { useState } from "react";
import { useExoStore, DEFAULT_CONTACT_CATEGORIES, type ContactCategory } from "../../lib/store";

// === Types ===

interface HourlyLog {
  time: string;
  source: string;
  summary: string;
}

interface DailyRecap {
  date: string;
  summary: string;
}

interface Contact {
  id: number;
  name: string;
  category: string; // famille, amis, proches, clients
  source: string;
  lastSeen: string;
  interactions: number;
  hourlyLogs: HourlyLog[];
  dailyRecaps: DailyRecap[];
  latestSummary: string;
}

// === Mock Data ===

const MOCK_CONTACTS: Contact[] = [
  {
    id: 1, name: "Maman", category: "famille", source: "whatsapp", lastSeen: "Il y a 30min", interactions: 156,
    latestSummary: "Discussion sur le week-end prochain, elle vient samedi avec papa.",
    hourlyLogs: [
      { time: "20h", source: "whatsapp", summary: "Confirmation du dîner de samedi, elle apporte le dessert. Question sur le cadeau d'anniversaire de papa." },
      { time: "14h", source: "whatsapp", summary: "Photo du jardin, les tulipes commencent à pousser. Rappel RDV dentiste jeudi." },
    ],
    dailyRecaps: [
      { date: "24 Fév", summary: "Échanges sur l'organisation du week-end familial. Maman arrive samedi 11h. Planification anniversaire papa (60 ans le 15 mars). Elle a vu le médecin, tout va bien." },
    ],
  },
  {
    id: 2, name: "Papa", category: "famille", source: "imessage", lastSeen: "Il y a 3h", interactions: 42,
    latestSummary: "Envoi du lien pour la réservation du restaurant.",
    hourlyLogs: [
      { time: "17h", source: "imessage", summary: "Confirmation du restaurant pour samedi soir, 8 personnes. Il s'occupe de la résa." },
    ],
    dailyRecaps: [],
  },
  {
    id: 3, name: "Grégoire", category: "proches", source: "whatsapp", lastSeen: "Il y a 1h", interactions: 234,
    latestSummary: "Discussion sur Prepster — le bouton d'appui est validé. Il s'occupe du backend demain.",
    hourlyLogs: [
      { time: "21h", source: "whatsapp", summary: "Retour sur le call investisseur de cet aprem, bons signaux. Discussion Prepster : le flow d'onboarding est quasi fini, il push le backend auth demain matin. Mention d'ExoOS — il trouve le concept de constellation cool." },
      { time: "16h", source: "whatsapp", summary: "Partage d'un article sur les tendances IA. Planification d'un co-working jeudi chez lui." },
    ],
    dailyRecaps: [
      { date: "24 Fév", summary: "Session de travail intense sur Prepster. Grégoire a fini l'API d'auth, reste le flow de paiement. Call investisseur positif — next step: envoyer le deck mis à jour. Co-working prévu jeudi." },
    ],
  },
  {
    id: 4, name: "Léa", category: "proches", source: "whatsapp", lastSeen: "Il y a 4h", interactions: 189,
    latestSummary: "Dîner prévu vendredi soir, elle réserve le restau.",
    hourlyLogs: [
      { time: "18h", source: "whatsapp", summary: "Confirmation du dîner vendredi 20h. Discussion sur le voyage à Lisbonne en avril. Elle a trouvé un Airbnb sympa." },
    ],
    dailyRecaps: [],
  },
  {
    id: 5, name: "Marc Lefèvre", category: "clients", source: "fathom", lastSeen: "Il y a 1j", interactions: 23,
    latestSummary: "Weekly sync — validation du scope Q2, lancement phase 2 lundi.",
    hourlyLogs: [],
    dailyRecaps: [
      { date: "24 Fév", summary: "Call weekly sync : les KPIs du pilote sont au-dessus des attentes (+30% rétention). Go pour la phase 2 avec budget élargi. Marc envoie le brief technique d'ici vendredi. Prochaine étape : recruter un dev front." },
    ],
  },
  {
    id: 6, name: "Sophie Martin", category: "clients", source: "imessage", lastSeen: "Il y a 2j", interactions: 15,
    latestSummary: "Attente des maquettes V2, envoi prévu demain.",
    hourlyLogs: [],
    dailyRecaps: [
      { date: "23 Fév", summary: "Sophie finalise les maquettes du site. Design validé pour la home et la page pricing. Reste la page about. Livraison complète prévue mercredi." },
    ],
  },
  {
    id: 7, name: "Lucas", category: "amis", source: "whatsapp", lastSeen: "Il y a 5h", interactions: 67,
    latestSummary: "Partage des mockups du dashboard, feedback positif.",
    hourlyLogs: [
      { time: "15h", source: "whatsapp", summary: "Lucas envoie les mockups du dashboard. Feedback : le header est trop chargé, simplifier. Proposition de foot dimanche." },
    ],
    dailyRecaps: [],
  },
  {
    id: 8, name: "Camille", category: "amis", source: "imessage", lastSeen: "Il y a 2j", interactions: 31,
    latestSummary: "Discussion ciné ce week-end.",
    hourlyLogs: [],
    dailyRecaps: [],
  },
];

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  imessage: "#5AC8FA",
  fathom: "#8B5CF6",
};

// === Contact Detail Panel ===

function ContactDetail({ contact, category, onClose }: { contact: Contact; category: ContactCategory; onClose: () => void }) {
  const [showHourly, setShowHourly] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute inset-0 bg-void/95 z-10 overflow-y-auto"
    >
      <div className="px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold"
              style={{
                background: `linear-gradient(135deg, ${category.color}30, ${category.color}10)`,
                color: category.color,
                border: `1px solid ${category.color}20`,
              }}
            >
              {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-star-white">{contact.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: `${category.color}18`, color: category.color }}>
                  {category.emoji} {category.name}
                </span>
                <span className="text-[11px] text-dust-dark">{contact.interactions} interactions</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-dust-dark hover:text-dust transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Last summary */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[contact.source] }} />
            <span className="text-[11px] text-dust-dark">{contact.lastSeen}</span>
          </div>
          <p className="text-[13px] text-dust leading-relaxed">{contact.latestSummary}</p>
        </div>

        {/* Hourly logs */}
        {contact.hourlyLogs.length > 0 && (
          <div>
            <button
              onClick={() => setShowHourly(!showHourly)}
              className="flex items-center gap-2 mb-3 text-xs text-dust-dark uppercase tracking-wider font-medium hover:text-dust transition-colors"
            >
              <Clock size={11} />
              Logs horaires ({contact.hourlyLogs.length})
              <ChevronDown size={11} className={`transition-transform ${showHourly ? "rotate-180" : ""}`} />
            </button>
            {showHourly && (
              <div className="space-y-2 border-l-2 pl-4 ml-1" style={{ borderColor: `${category.color}30` }}>
                {contact.hourlyLogs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative"
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full"
                      style={{ background: SOURCE_COLORS[log.source] || category.color }}
                    />
                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-dust-dark">{log.time}</span>
                        <span className="h-1 w-1 rounded-full bg-white/10" />
                        <span className="text-[10px] capitalize" style={{ color: SOURCE_COLORS[log.source] }}>{log.source}</span>
                      </div>
                      <p className="text-[12px] text-dust leading-relaxed">{log.summary}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Daily recaps */}
        {contact.dailyRecaps.length > 0 && (
          <div>
            <h3 className="text-xs text-dust-dark uppercase tracking-wider font-medium mb-3">Récaps journalières</h3>
            <div className="space-y-2">
              {contact.dailyRecaps.map((recap, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-[11px] font-medium mb-2" style={{ color: category.color }}>{recap.date}</div>
                  <p className="text-[12px] text-dust leading-relaxed">{recap.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// === Contact Card ===

function ContactCard({ contact, categoryColor, onClick, index }: {
  contact: Contact;
  categoryColor: string;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-3.5 hover:bg-white/[0.035] hover:border-white/[0.1] transition-all cursor-pointer group"
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold"
        style={{
          background: `linear-gradient(135deg, ${categoryColor}25, ${categoryColor}08)`,
          color: categoryColor,
          border: `1px solid ${categoryColor}15`,
        }}
      >
        {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-star-white truncate">{contact.name}</span>
          {contact.hourlyLogs.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-500/20 px-1 text-[9px] font-bold text-electric-400">
              {contact.hourlyLogs.length}
            </span>
          )}
        </div>
        <p className="text-[11px] text-dust-dark truncate mt-0.5">{contact.latestSummary}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-dust-dark">{contact.lastSeen}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_COLORS[contact.source] }} />
      </div>
    </motion.div>
  );
}

// === Category Section ===

function CategorySection({ category, contacts, onSelectContact }: {
  category: ContactCategory;
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (contacts.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Category header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full group"
      >
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5"
          style={{ background: `${category.color}10` }}
        >
          <span className="text-sm">{category.emoji}</span>
          <span className="text-[12px] font-semibold" style={{ color: category.color }}>{category.name}</span>
          <span className="text-[11px] text-dust-dark ml-1">{contacts.length}</span>
        </div>
        <div className="flex-1 h-px" style={{ background: `${category.color}15` }} />
        <ChevronDown
          size={12}
          className={`text-dust-dark transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {/* Contacts */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-1.5 overflow-hidden"
          >
            {contacts.map((contact, i) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                categoryColor={category.color}
                onClick={() => onSelectContact(contact)}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// === Main Content ===

export function ContactsContent() {
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const constellation = useExoStore((s) => s.constellation);
  const categories = constellation?.contactCategories || DEFAULT_CONTACT_CATEGORIES;

  const filtered = search
    ? MOCK_CONTACTS.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : MOCK_CONTACTS;

  const selectedCategory = selectedContact
    ? categories.find((cat) => cat.id === selectedContact.category) || categories[0]
    : null;

  return (
    <div className="relative h-full">
      <AnimatePresence>
        {selectedContact && selectedCategory && (
          <ContactDetail
            contact={selectedContact}
            category={selectedCategory}
            onClose={() => setSelectedContact(null)}
          />
        )}
      </AnimatePresence>

      <div className="px-6 pb-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dust-dark" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un contact..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-star-white placeholder-dust-dark outline-none focus:border-white/[0.12] transition-colors"
          />
        </div>

        {/* Stats overview */}
        <div className="flex items-center gap-3 flex-wrap">
          {categories.map((cat) => {
            const count = filtered.filter((c) => c.category === cat.id).length;
            return (
              <span
                key={cat.id}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
                style={{ background: `${cat.color}0a`, color: cat.color }}
              >
                <span>{cat.emoji}</span>
                <span className="font-medium">{count}</span>
              </span>
            );
          })}
          <span className="text-[11px] text-dust-dark ml-auto">
            {filtered.length} contacts total
          </span>
        </div>

        {/* Categories */}
        <div className="space-y-5">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              contacts={filtered.filter((c) => c.category === category.id)}
              onSelectContact={setSelectedContact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
