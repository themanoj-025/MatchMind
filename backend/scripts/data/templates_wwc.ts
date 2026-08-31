/** WWC player templates. */

/** Player templates per tournament (star players). */

import type { PlayerRecord } from '../types'
import { PlayerTemplate, section } from './utils'

// ─── FIFA Women's World Cup 2027 (~30 players) ─────────

const WWC_GK = section([
  { name: 'Mary Earps', club: 'Paris Saint-Germain', nationality: 'GB', position: 'GK', basePrice: 36 },
  { name: 'Ellie Roebuck', club: 'Barcelona', nationality: 'GB', position: 'GK', basePrice: 30 },
  { name: 'Alyssa Naeher', club: 'Chicago Red Stars', nationality: 'US', position: 'GK', basePrice: 32 },
  { name: 'Sandra Panos', club: 'Barcelona', nationality: 'ES', position: 'GK', basePrice: 28 },
  { name: 'Lena Schuller', club: 'Wolfsburg', nationality: 'NO', position: 'GK', basePrice: 28 },
  { name: 'Cata Coll', club: 'Barcelona', nationality: 'ES', position: 'GK', basePrice: 26 },
  { name: 'Lorena', club: 'Gremio', nationality: 'BR', position: 'GK', basePrice: 24 },
  { name: 'Mackenzie Arnold', club: 'West Ham', nationality: 'AU', position: 'GK', basePrice: 22 },
])

const WWC_DEF = section([
  { name: 'Lucy Bronze', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 28 },
  { name: 'Irene Paredes', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 26 },
  { name: 'Millie Bright', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 24 },
  { name: 'Leah Williamson', club: 'Arsenal', nationality: 'GB', position: 'DEF', basePrice: 26 },
  { name: 'Mapi Leon', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Selma Bacha', club: 'Lyon', nationality: 'FR', position: 'DEF', basePrice: 22 },
  { name: 'Naomi Girma', club: 'San Diego Wave', nationality: 'US', position: 'DEF', basePrice: 24 },
  { name: 'Ellie Carpenter', club: 'Lyon', nationality: 'AU', position: 'DEF', basePrice: 24 },
  { name: 'Wendie Renard', club: 'Lyon', nationality: 'FR', position: 'DEF', basePrice: 28 },
  { name: 'Kadeisha Buchanan', club: 'Chelsea', nationality: 'CA', position: 'DEF', basePrice: 20 },
  { name: 'Ona Batlle', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Rafaelle Souza', club: 'Corinthians', nationality: 'BR', position: 'DEF', basePrice: 20 },
])

const WWC_MID = section([
  {
    name: 'Alexia Putellas',
    club: 'Barcelona',
    nationality: 'ES',
    position: 'MID',
    basePrice: 42,
    isEligibleForIcon: true,
  },
  {
    name: 'Aitana Bonmati',
    club: 'Barcelona',
    nationality: 'ES',
    position: 'MID',
    basePrice: 40,
    isEligibleForIcon: true,
  },
  { name: 'Keira Walsh', club: 'Barcelona', nationality: 'GB', position: 'MID', basePrice: 28 },
  { name: 'Georgia Stanway', club: 'Bayern Munich', nationality: 'GB', position: 'MID', basePrice: 26 },
  { name: 'Lena Oberdorf', club: 'Wolfsburg', nationality: 'DE', position: 'MID', basePrice: 24 },
  { name: 'Lindsay Horan', club: 'Lyon', nationality: 'US', position: 'MID', basePrice: 26 },
  { name: 'Rose Lavelle', club: 'OL Reign', nationality: 'US', position: 'MID', basePrice: 24 },
  { name: 'Caroline Graham Hansen', club: 'Barcelona', nationality: 'NO', position: 'MID', basePrice: 28 },
  { name: 'Debinha', club: 'Kansas City Current', nationality: 'BR', position: 'MID', basePrice: 24 },
  { name: 'Vivianne Miedema', club: 'Manchester City', nationality: 'NL', position: 'MID', basePrice: 30 },
  { name: 'Sakina Karchaoui', club: 'Paris Saint-Germain', nationality: 'FR', position: 'MID', basePrice: 22 },
  { name: 'Sara Dabritz', club: 'Lyon', nationality: 'DE', position: 'MID', basePrice: 22 },
])

const WWC_FWD = section([
  { name: 'Marta', club: 'Orlando Pride', nationality: 'BR', position: 'FWD', basePrice: 32, isEligibleForIcon: true },
  { name: 'Sam Kerr', club: 'Chelsea', nationality: 'AU', position: 'FWD', basePrice: 34, isEligibleForIcon: true },
  { name: 'Ada Hegerberg', club: 'Lyon', nationality: 'NO', position: 'FWD', basePrice: 30, isEligibleForIcon: true },
  { name: 'Trinity Rodman', club: 'Washington Spirit', nationality: 'US', position: 'FWD', basePrice: 28 },
  { name: 'Mallory Swanson', club: 'Chicago Red Stars', nationality: 'US', position: 'FWD', basePrice: 26 },
  { name: 'Salma Paralluelo', club: 'Barcelona', nationality: 'ES', position: 'FWD', basePrice: 28 },
  { name: 'Guro Reiten', club: 'Chelsea', nationality: 'NO', position: 'FWD', basePrice: 26 },
  { name: 'Khadija Shaw', club: 'Manchester City', nationality: 'JM', position: 'FWD', basePrice: 26 },
  { name: 'Fridolina Rolfo', club: 'Barcelona', nationality: 'SE', position: 'FWD', basePrice: 24 },
  { name: 'Alex Morgan', club: 'San Diego Wave', nationality: 'US', position: 'FWD', basePrice: 24 },
])

const WWC_PLAYERS: PlayerTemplate[] = [...WWC_GK, ...WWC_DEF, ...WWC_MID, ...WWC_FWD]
