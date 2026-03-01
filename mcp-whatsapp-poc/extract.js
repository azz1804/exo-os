const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ChatStorage_copy.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
        return;
    }
});

// ZMESSAGEDATE est en Core Data timestamp (secondes depuis 1er Janvier 2001)
// On ajoute l'offset (31 ans) pour retomber sur le timestamp Unix 1970
const query = `
SELECT 
    ZTEXT,
    ZISFROMME,
    datetime(ZMESSAGEDATE + 978307200, 'unixepoch', 'localtime') as date,
    ZFROMJID,
    ZTOJID
FROM ZWAMESSAGE 
WHERE ZTEXT IS NOT NULL 
AND ZTEXT != ''
ORDER BY ZMESSAGEDATE DESC 
LIMIT 20;
`;

db.all(query, [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log("=== DERNIERS MESSAGES WHATSAPP ===");
    rows.forEach((row) => {
        const io = row.ZISFROMME === 1 ? 'Moi' : 'Autre';
        const contact = row.ZISFROMME === 1 ? row.ZTOJID : row.ZFROMJID;
        console.log(`[${row.date}] ${io} (vers/de: ${contact}): ${row.ZTEXT}`);
    });
});

db.close();
