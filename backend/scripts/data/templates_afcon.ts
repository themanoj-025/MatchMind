/** AFCON player templates. */

/** Player templates per tournament (star players). */

import type { PlayerRecord } from '../types'
import { PlayerTemplate, section } from './utils'

// ─── CAF Africa Cup of Nations 2027 (~25 players) ─────

const AFCON_GK = section([
  { name: 'Edouard Mendy', club: 'Al Ahli', nationality: 'SN', position: 'GK', basePrice: 30 },
  { name: 'Andre Onana', club: 'Manchester United', nationality: 'CM', position: 'GK', basePrice: 38 },
  { name: 'Yassine Bounou', club: 'Al Hilal', nationality: 'MA', position: 'GK', basePrice: 30 },
  { name: 'Yahia Fofana', club: 'Angers', nationality: 'CI', position: 'GK', basePrice: 20 },
  { name: 'Mohamed El Shenawy', club: 'Al Ahly', nationality: 'EG', position: 'GK', basePrice: 26 },
])

const AFCON_DEF = section([
  { name: 'Achraf Hakimi', club: 'Paris Saint-Germain', nationality: 'MA', position: 'DEF', basePrice: 42 },
  { name: 'Edmond Tapsoba', club: 'Bayer Leverkusen', nationality: 'BF', position: 'DEF', basePrice: 28 },
  { name: 'Odilon Kossounou', club: 'Bayer Leverkusen', nationality: 'CI', position: 'DEF', basePrice: 24 },
  { name: 'Kalidou Koulibaly', club: 'Al Hilal', nationality: 'SN', position: 'DEF', basePrice: 28 },
  { name: 'Gleison Bremer', club: 'Juventus', nationality: 'BR', position: 'DEF', basePrice: 32 },
  { name: 'Josko Gvardiol', club: 'Manchester City', nationality: 'HR', position: 'DEF', basePrice: 42 },
  { name: 'Nayef Aguerd', club: 'West Ham', nationality: 'MA', position: 'DEF', basePrice: 22 },
  { name: 'Jean-Clair Todibo', club: 'Nice', nationality: 'FR', position: 'DEF', basePrice: 26 },
  { name: 'Marcos Senesi', club: 'Bournemouth', nationality: 'AR', position: 'DEF', basePrice: 22 },
  { name: 'Reece James', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 26 },
])

const AFCON_MID = section([
  { name: 'Mohamed Salah', club: 'Liverpool', nationality: 'EG', position: 'MID', basePrice: 60 },
  { name: 'Riyad Mahrez', club: 'Al Ahli', nationality: 'DZ', position: 'MID', basePrice: 40 },
  { name: 'Nicolas Pepe', club: 'Villarreal', nationality: 'CI', position: 'MID', basePrice: 28 },
  { name: 'Thomas Partey', club: 'Arsenal', nationality: 'GH', position: 'MID', basePrice: 26 },
  { name: 'Mohammed Kudus', club: 'West Ham', nationality: 'GH', position: 'MID', basePrice: 32 },
  { name: 'Azzedine Ounahi', club: 'Marseille', nationality: 'MA', position: 'MID', basePrice: 24 },
  { name: 'Yves Bissouma', club: 'Tottenham', nationality: 'ML', position: 'MID', basePrice: 24 },
  { name: 'Franck Kessie', club: 'Al Ahli', nationality: 'CI', position: 'MID', basePrice: 28 },
  { name: 'Ismael Bennacer', club: 'AC Milan', nationality: 'DZ', position: 'MID', basePrice: 26 },
  { name: 'Pape Matar Sarr', club: 'Tottenham', nationality: 'SN', position: 'MID', basePrice: 28 },
])

const AFCON_FWD = section([
  { name: 'Victor Osimhen', club: 'Galatasaray', nationality: 'NG', position: 'FWD', basePrice: 44 },
  { name: 'Pierre-Emerick Aubameyang', club: 'Al Qadsiah', nationality: 'GA', position: 'FWD', basePrice: 30 },
  { name: 'Samuel Chukwueze', club: 'AC Milan', nationality: 'NG', position: 'FWD', basePrice: 24 },
  { name: 'Hakim Ziyech', club: 'Galatasaray', nationality: 'MA', position: 'FWD', basePrice: 26 },
  { name: 'Sadio Mane', club: 'Al Nassr', nationality: 'SN', position: 'FWD', basePrice: 36 },
  { name: 'Nicolas Jackson', club: 'Chelsea', nationality: 'SN', position: 'FWD', basePrice: 30 },
  { name: 'Simon Adingra', club: 'Brighton', nationality: 'CI', position: 'FWD', basePrice: 28 },
  { name: 'Taiwo Awoniyi', club: 'Nottingham Forest', nationality: 'NG', position: 'FWD', basePrice: 26 },
  { name: 'Amad Diallo', club: 'Manchester United', nationality: 'CI', position: 'FWD', basePrice: 24 },
  { name: 'Randal Kolo Muani', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 30 },
])

const AFCON_PLAYERS: PlayerTemplate[] = [...AFCON_GK, ...AFCON_DEF, ...AFCON_MID, ...AFCON_FWD]
