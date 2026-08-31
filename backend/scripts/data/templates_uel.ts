/** UEL player templates. */

/** Player templates per tournament (star players). */

import type { PlayerRecord } from '../types'
import { PlayerTemplate, section } from './utils'

// ─── UEFA Europa League 2026/27 (~30 players) ────────────

const UEL_GK = section([
  { name: 'Mile Svilar', club: 'Roma', nationality: 'RS', position: 'GK', basePrice: 18 },
  { name: 'Lucas Chevalier', club: 'Lille', nationality: 'FR', position: 'GK', basePrice: 32 },
  { name: 'Marco Carnesecchi', club: 'Atalanta', nationality: 'IT', position: 'GK', basePrice: 30 },
  { name: 'Kevin Trapp', club: 'Eintracht Frankfurt', nationality: 'DE', position: 'GK', basePrice: 28 },
  { name: 'Pau Lopez', club: 'Marseille', nationality: 'ES', position: 'GK', basePrice: 24 },
  { name: 'Anatoliy Trubin', club: 'Benfica', nationality: 'UA', position: 'GK', basePrice: 34 },
])

const UEL_DEF = section([
  { name: 'Mats Hummels', club: 'Roma', nationality: 'DE', position: 'DEF', basePrice: 24 },
  { name: 'Mario Hermoso', club: 'Roma', nationality: 'ES', position: 'DEF', basePrice: 18 },
  { name: 'Benjamin Pavard', club: 'Inter Milan', nationality: 'FR', position: 'DEF', basePrice: 34 },
  { name: 'Edmond Tapsoba', club: 'Bayer Leverkusen', nationality: 'BF', position: 'DEF', basePrice: 28 },
  { name: 'Jonathan Tah', club: 'Bayer Leverkusen', nationality: 'DE', position: 'DEF', basePrice: 30 },
  { name: 'Nico Tagliafico', club: 'Lyon', nationality: 'AR', position: 'DEF', basePrice: 22 },
  { name: 'Jorrel Hato', club: 'Ajax', nationality: 'NL', position: 'DEF', basePrice: 20 },
  { name: 'David Hancko', club: 'Feyenoord', nationality: 'SK', position: 'DEF', basePrice: 18 },
  { name: 'Lukas Klostermann', club: 'RB Leipzig', nationality: 'DE', position: 'DEF', basePrice: 20 },
  { name: 'Willi Orban', club: 'RB Leipzig', nationality: 'HU', position: 'DEF', basePrice: 28 },
  { name: 'Milan Skriniar', club: 'Paris Saint-Germain', nationality: 'SK', position: 'DEF', basePrice: 30 },
  { name: 'Alessandro Buongiorno', club: 'Napoli', nationality: 'IT', position: 'DEF', basePrice: 24 },
])

const UEL_MID = section([
  { name: 'Henrikh Mkhitaryan', club: 'Inter Milan', nationality: 'AM', position: 'MID', basePrice: 24 },
  { name: 'Davide Frattesi', club: 'Inter Milan', nationality: 'IT', position: 'MID', basePrice: 28 },
  { name: 'Granit Xhaka', club: 'Bayer Leverkusen', nationality: 'CH', position: 'MID', basePrice: 26 },
  { name: 'Exequiel Palacios', club: 'Bayer Leverkusen', nationality: 'AR', position: 'MID', basePrice: 26 },
  { name: 'Julian Brandt', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 28 },
  { name: 'Marcel Sabitzer', club: 'Borussia Dortmund', nationality: 'AT', position: 'MID', basePrice: 24 },
  { name: 'Scott McTominay', club: 'Napoli', nationality: 'GB', position: 'MID', basePrice: 20 },
  { name: 'Amadou Onana', club: 'Aston Villa', nationality: 'BE', position: 'MID', basePrice: 22 },
  { name: 'Jordan Veretout', club: 'Marseille', nationality: 'FR', position: 'MID', basePrice: 18 },
  { name: 'Pierre-Emile Hojbjerg', club: 'Tottenham', nationality: 'DK', position: 'MID', basePrice: 20 },
  { name: 'Davy Klaassen', club: 'Inter Milan', nationality: 'NL', position: 'MID', basePrice: 16 },
  { name: 'Tijjani Reijnders', club: 'AC Milan', nationality: 'NL', position: 'MID', basePrice: 28 },
])

const UEL_FWD = section([
  { name: 'Romelu Lukaku', club: 'Napoli', nationality: 'BE', position: 'FWD', basePrice: 34 },
  { name: 'Tammy Abraham', club: 'AC Milan', nationality: 'GB', position: 'FWD', basePrice: 26 },
  { name: 'Victor Boniface', club: 'Bayer Leverkusen', nationality: 'NG', position: 'FWD', basePrice: 30 },
  { name: 'Serhou Guirassy', club: 'Borussia Dortmund', nationality: 'GN', position: 'FWD', basePrice: 32 },
  { name: 'Donyell Malen', club: 'Borussia Dortmund', nationality: 'NL', position: 'FWD', basePrice: 26 },
  { name: 'Mason Greenwood', club: 'Marseille', nationality: 'GB', position: 'FWD', basePrice: 28 },
  { name: 'Ciro Immobile', club: 'Besiktas', nationality: 'IT', position: 'FWD', basePrice: 24 },
  { name: 'Alvaro Morata', club: 'AC Milan', nationality: 'ES', position: 'FWD', basePrice: 30 },
  { name: 'Youssef En-Nesyri', club: 'Fenerbahce', nationality: 'MA', position: 'FWD', basePrice: 26 },
  { name: 'Federico Chiesa', club: 'Liverpool', nationality: 'IT', position: 'FWD', basePrice: 30 },
])

const UEL_PLAYERS: PlayerTemplate[] = [...UEL_GK, ...UEL_DEF, ...UEL_MID, ...UEL_FWD]
