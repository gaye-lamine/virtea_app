
export default class AcademicSuggestionsService {
    static async getSuggestions(payload: { country?: string; university?: string }): Promise<string[]> {
        const { country, university } = payload

        if (!country) {
            return []
        }

        // Normalisation pour la comparaison (minuscules, sans accents basiques si besoin, mais ici simple)
        const normalizedCountry = country.trim().toLowerCase()

        if (normalizedCountry === 'sénégal' || normalizedCountry === 'senegal') {
            if (!university) {
                // Retourner la liste des universités
                return [
                    'Université Cheikh Anta Diop (UCAD)',
                    'Université Gaston Berger (UGB)',
                    'Université Assane Seck de Ziguinchor (UASZ)',
                    'Université Alioune Diop de Bambey (UADB)',
                    'Université de Thiès (UT)',
                    'Université du Sine Saloum El-Hâdj Ibrahima NIASS (USSEIN)',
                    'Université Amadou Mahtar MBOW (UAM)',
                    'Université Virtuelle du Sénégal (UVS)',
                    'École Supérieure Polytechnique (ESP)',
                    'Institut Supérieur d\'Entrepreneurship et de Gestion (ISEG)',
                    'Institut Africain de Management (IAM)',
                    'SupDeCo',
                    'BEM Management School',
                ]
            } else {
                // Retourner la liste des facultés/filières si une université est sélectionnée
                // Pour l'instant, on retourne un ensemble générique + spécifique si possible
                // Idéalement, on aurait une map { "UCAD": [...] }

                const normalizedUni = university.trim().toLowerCase()

                if (normalizedUni.includes('ucad') || normalizedUni.includes('cheikh anta diop')) {
                    return [
                        'Faculté des Sciences et Techniques (FST)',
                        'Faculté de Médecine, de Pharmacie et d\'Odonto-Stomatologie (FMPOS)',
                        'Faculté des Lettres et Sciences Humaines (FLSH)',
                        'Faculté des Sciences Juridiques et Politiques (FSJP)',
                        'Faculté des Sciences Économiques et de Gestion (FASEG)',
                        'Faculté des Sciences et Technologies de l\'Éducation et de la Formation (FASTEF)',
                        'Ecole Supérieure Polytechnique (ESP)',
                        'Institut de Population, Développement et Santé de la Reproduction (IPDSR)',
                    ]
                }

                if (normalizedUni.includes('ugb') || normalizedUni.includes('gaston berger')) {
                    return [
                        'UFR Sciences Appliquées et Technologie (SAT)',
                        'UFR Sciences de la Santé (2S)',
                        'UFR Lettres et Sciences Humaines (LSH)',
                        'UFR Sciences Juridiques et Politiques (SJP)',
                        'UFR Sciences Économiques et de Gestion (SEG)',
                        'UFR Sciences Agronomiques, de l\'Aquaculture et des Technologies Alimentaires (S2ATA)',
                        'UFR Sciences de l\'Éducation, de la Formation et du Sport (SEFS)',
                        'UFR Civilisations, Religions, Arts et Communication (CRAC)',
                    ]
                }

                // Fallback générique
                return [
                    'Droit',
                    'Médecine',
                    'Informatique',
                    'Gestion',
                    'Economie',
                    'Lettres Modernes',
                    'Sociologie',
                    'Anglais',
                    'Mathématiques',
                    'Physique-Chimie',
                    'Biologie',
                    'Géographie',
                    'Histoire',
                ]
            }
        }

        // Exemple pour la France
        if (normalizedCountry === 'france') {
            if (!university) {
                return [
                    'Sorbonne Université',
                    'Université Paris-Saclay',
                    'Université Paris Cité',
                    'Université de Bordeaux',
                    'Aix-Marseille Université',
                    'Université de Lyon',
                    'Université de Strasbourg',
                ]
            }
            return [
                'Droit',
                'Médecine',
                'Informatique',
                'Sciences',
                'Lettres',
            ]
        }

        return []
    }
}
