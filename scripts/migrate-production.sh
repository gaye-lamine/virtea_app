#!/bin/bash

# Script pour exécuter les migrations en production
# Ce script doit être exécuté sur le serveur de production

echo "==================================="
echo "Migration Device ID - Production"
echo "==================================="
echo ""

# Étape 1: Vérifier l'état des migrations
echo "Étape 1: Vérification de l'état des migrations..."
node ace migration:status

echo ""
echo "==================================="
echo "Appuyez sur ENTER pour continuer avec l'exécution des migrations..."
read

# Étape 2: Exécuter les migrations
echo "Étape 2: Exécution des migrations..."
node ace migration:run

echo ""
echo "==================================="
echo "Étape 3: Vérification du schéma de la table lessons..."
echo "Connexion à la base de données..."

# Vérifier la structure de la table
PGPASSWORD="5423488@Ag" psql -h virtea-hdv5qf -U lamine_virtea -d virtea_db -c "\d lessons"

echo ""
echo "==================================="
echo "Migration terminée !"
echo "==================================="
