# Commandes de Diagnostic à Exécuter

Depuis le conteneur Docker (`/app/build #`), exécutez les commandes suivantes :

## 1. Vérifier les logs de l'application

Si vous utilisez PM2 :
```bash
pm2 logs --lines 50
```

Ou si l'application tourne directement :
```bash
# Sortir du conteneur et vérifier les logs Docker
exit
docker logs <nom-du-conteneur> --tail 50
```

## 2. Tester la connexion à la base de données depuis l'application

Depuis `/app/build`, créez un fichier de test :

```bash
cat > test-db.js << 'EOF'
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

client.connect()
  .then(() => {
    console.log('✅ Connexion réussie avec DB_USER:', process.env.DB_USER);
    return client.query('SELECT * FROM lessons LIMIT 1');
  })
  .then(res => {
    console.log('✅ Requête réussie, colonnes:', Object.keys(res.rows[0] || {}));
    client.end();
  })
  .catch(err => {
    console.error('❌ Erreur:', err.message);
    client.end();
  });
EOF

node test-db.js
```

## 3. Vérifier les variables d'environnement utilisées

```bash
echo "DB_USER: $DB_USER"
echo "DB_HOST: $DB_HOST"
echo "DATABASE_URL: $DATABASE_URL"
```

## 4. Vérifier le fichier de configuration de la base de données

```bash
cat config/database.js | grep -A 20 "pg:"
```
