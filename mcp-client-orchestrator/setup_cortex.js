require("dotenv").config();
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const INBOX_DB_ID = process.env.NOTION_DB_INBOX;
const PARENT_PAGE_ID = process.env.CORTEX_PARENT_PAGE_ID;

if (!INBOX_DB_ID || !PARENT_PAGE_ID) {
    console.error("ERREUR: Veuillez définir CORTEX_PARENT_PAGE_ID (l'ID de la page Notion qui contiendra les nouvelles bases) dans votre fichier .env.");
    console.log("Exemple : CORTEX_PARENT_PAGE_ID=1234567890abcdef1234567890abcdef");
    process.exit(1);
}

async function main() {
    console.log("🚀 Création du Cortex V2 dans Notion...\n");

    try {
        // --- 1. CREATION DES BASES DE DONNÉES ---
        console.log("📦 Création de la base 'Contacts Exo OS'...");
        const contactsDb = await notion.databases.create({
            parent: { type: "page_id", page_id: PARENT_PAGE_ID },
            title: [{ text: { content: "Contacts Exo OS" } }],
            properties: {
                "Nom": { title: {} },
                "Identifiant": { rich_text: {} },
                "Relation": { select: { options: [{ name: "ami", color: "blue" }, { name: "famille", color: "pink" }, { name: "client", color: "green" }, { name: "prospect", color: "yellow" }, { name: "collègue", color: "gray" }, { name: "mentor", color: "purple" }, { name: "autre", color: "default" }] } },
                "Pilier principal": { select: { options: [{ name: "Business" }, { name: "Famille" }, { name: "Amis" }, { name: "Spiritualité" }, { name: "Santé" }] } },
                "Dernière interaction": { date: {} },
                "Nombre d'interactions": { number: { format: "number" } },
                "Sujets récurrents": { multi_select: {} },
                "Sentiment général": { select: { options: [{ name: "Positif", color: "green" }, { name: "Neutre", color: "gray" }, { name: "Tendu", color: "orange" }, { name: "Froid", color: "blue" }] } },
                "Résumé relationnel": { rich_text: {} },
                "Anniversaire": { date: {} },
                "Action en attente": { checkbox: {} },
                "Détail action": { rich_text: {} }
            }
        });
        const contactsId = contactsDb.id;
        console.log(`   -> Créée avec ID : ${contactsId}`);

        console.log("📦 Création de la base 'Événements Exo OS'...");
        const eventsDb = await notion.databases.create({
            parent: { type: "page_id", page_id: PARENT_PAGE_ID },
            title: [{ text: { content: "Événements Exo OS" } }],
            properties: {
                "Titre": { title: {} },
                "Date & Heure": { date: {} },
                "Type": { select: { options: [{ name: "rdv" }, { name: "deadline" }, { name: "rappel" }, { name: "social" }, { name: "médical" }, { name: "pro" }] } },
                "Pilier": { select: { options: [{ name: "Business" }, { name: "Spiritualité" }, { name: "Santé" }, { name: "Famille" }, { name: "Amis" }] } },
                "Lieu": { rich_text: {} },
                "Source": { select: { options: [{ name: "whatsapp" }, { name: "comet" }, { name: "mail" }, { name: "manuel" }] } },
                "Statut": { select: { options: [{ name: "À venir", color: "blue" }, { name: "Passé", color: "default" }, { name: "Annulé", color: "red" }] } },
                "Notes": { rich_text: {} }
            }
        });
        const eventsId = eventsDb.id;
        console.log(`   -> Créée avec ID : ${eventsId}`);

        console.log("📦 Création de la base 'Projets & Dossiers Exo OS'...");
        const projectsDb = await notion.databases.create({
            parent: { type: "page_id", page_id: PARENT_PAGE_ID },
            title: [{ text: { content: "Projets & Dossiers Exo OS" } }],
            properties: {
                "Nom du projet": { title: {} },
                "Pilier": { select: { options: [{ name: "Business" }, { name: "Spiritualité" }, { name: "Santé" }, { name: "Famille" }, { name: "Amis" }] } },
                "Statut": { select: { options: [{ name: "Actif", color: "green" }, { name: "En pause", color: "yellow" }, { name: "Terminé", color: "default" }, { name: "Abandonné", color: "red" }] } },
                "Résumé évolutif": { rich_text: {} },
                "Dernière activité": { date: {} },
                "Priorité": { select: { options: [{ name: "Haute", color: "red" }, { name: "Moyenne", color: "yellow" }, { name: "Basse", color: "blue" }] } },
                "Score momentum": { number: { format: "number" } }
            }
        });
        const projectsId = projectsDb.id;
        console.log(`   -> Créée avec ID : ${projectsId}`);

        console.log("📦 Création de la base 'Journal Exo OS'...");
        const journalDb = await notion.databases.create({
            parent: { type: "page_id", page_id: PARENT_PAGE_ID },
            title: [{ text: { content: "Journal Exo OS" } }],
            properties: {
                "Date": { title: {} },
                "Résumé du jour": { rich_text: {} },
                "Tâches générées": { number: { format: "number" } },
                "Humeur détectée": { select: { options: [{ name: "Productif", color: "blue" }, { name: "Neutre", color: "gray" }, { name: "Stressé", color: "red" }, { name: "Détendu", color: "green" }, { name: "Social", color: "yellow" }] } },
                "Ce que j'ai appris": { rich_text: {} },
                "Sources actives": { multi_select: { options: [{ name: "whatsapp" }, { name: "comet" }, { name: "dev" }, { name: "mail" }] } }
            }
        });
        const journalId = journalDb.id;
        console.log(`   -> Créée avec ID : ${journalId}`);

        // --- 2. CONFIGURATION DES RELATIONS ---
        console.log("\n🔗 Configuration des relations croisées (Cortex)...");

        console.log("-> Mise à jour de 'Contacts Exo OS'");
        await notion.databases.update({
            database_id: contactsId,
            properties: {
                "Événements liés": { relation: { database_id: eventsId, single_property: {} } },
                "Projets liés": { relation: { database_id: projectsId, single_property: {} } },
                "Interactions (Inbox)": { relation: { database_id: INBOX_DB_ID, single_property: {} } }
            }
        });

        console.log("-> Mise à jour de 'Événements Exo OS'");
        await notion.databases.update({
            database_id: eventsId,
            properties: {
                "Avec": { relation: { database_id: contactsId, single_property: {} } },
                "Entrée source (Inbox)": { relation: { database_id: INBOX_DB_ID, single_property: {} } }
            }
        });

        console.log("-> Mise à jour de 'Projets & Dossiers Exo OS'");
        await notion.databases.update({
            database_id: projectsId,
            properties: {
                "Personnes impliquées": { relation: { database_id: contactsId, single_property: {} } },
                "Événements liés": { relation: { database_id: eventsId, single_property: {} } },
                "Entrées liées (Inbox)": { relation: { database_id: INBOX_DB_ID, single_property: {} } }
            }
        });

        console.log("-> Mise à jour de 'Journal Exo OS'");
        await notion.databases.update({
            database_id: journalId,
            properties: {
                "Personnes contactées": { relation: { database_id: contactsId, single_property: {} } },
                "Événements du jour": { relation: { database_id: eventsId, single_property: {} } }
            }
        });

        console.log("-> Mise à jour de 'Inbox Exo OS' (Votre base d'origine)");
        await notion.databases.update({
            database_id: INBOX_DB_ID,
            properties: {
                "Date": { date: {} },
                "Personnes détectées": { relation: { database_id: contactsId, single_property: {} } },
                "Intentions détectées": { multi_select: { options: [{ name: "rdv" }, { name: "tâche" }, { name: "info" }, { name: "question" }, { name: "achat" }, { name: "recherche" }, { name: "rappel" }] } },
                "Pilier": { select: { options: [{ name: "Business" }, { name: "Spiritualité" }, { name: "Santé" }, { name: "Famille" }, { name: "Amis" }, { name: "Non classé" }] } }
            }
        });

        console.log("\n✅ TERMINÉ ! Le Cortex V2 a été déployé avec succès sur Notion !");
        console.log("⚠️ REMARQUE : L'API Notion ne permet pas de générer informatiquement les 'Vues' (Timeline, Filtres, Tris). Il faudra les créer manuellement dans l'interface en suivant les instructions.");

    } catch (error) {
        console.error("\n❌ Erreur API Notion :", error.body ? JSON.stringify(JSON.parse(error.body), null, 2) : error.message);
    }
}

main();
