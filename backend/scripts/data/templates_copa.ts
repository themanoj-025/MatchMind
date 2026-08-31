/** COPA player templates. */

/** Player templates per tournament (star players). */

import type { PlayerRecord } from '../types'
import { PlayerTemplate, section } from './utils'

// ─── Copa America 2028 (~25 players) ─────────────────

const COPA_GK = section([
  { name: 'Emiliano Martinez', club: 'Aston Villa', nationality: 'AR', position: 'GK', basePrice: 52 },
  { name: 'Alisson Becker', club: 'Liverpool', nationality: 'BR', position: 'GK', basePrice: 68 },
  { name: 'Ederson', club: 'Manchester City', nationality: 'BR', position: 'GK', basePrice: 62 },
  { name: 'David Ospina', club: 'Al Nassr', nationality: 'CO', position: 'GK', basePrice: 26 },
  { name: 'Sergio Rochet', club: 'Internacional', nationality: 'UY', position: 'GK', basePrice: 24 },
  { name: 'Franco Armani', club: 'River Plate', nationality: 'AR', position: 'GK', basePrice: 22 },
])

const COPA_DEF = section([
  { name: 'Cristian Romero', club: 'Tottenham', nationality: 'AR', position: 'DEF', basePrice: 32 },
  { name: 'Lisandro Martinez', club: 'Manchester United', nationality: 'AR', position: 'DEF', basePrice: 44 },
  { name: 'Nahuel Molina', club: 'Atletico Madrid', nationality: 'AR', position: 'DEF', basePrice: 28 },
  { name: 'Ronald Araujo', club: 'Barcelona', nationality: 'UY', position: 'DEF', basePrice: 38 },
  { name: 'Jose Maria Gimenez', club: 'Atletico Madrid', nationality: 'UY', position: 'DEF', basePrice: 36 },
  { name: 'Bremer', club: 'Juventus', nationality: 'BR', position: 'DEF', basePrice: 32 },
  { name: 'Eder Militao', club: 'Real Madrid', nationality: 'BR', position: 'DEF', basePrice: 38 },
  { name: 'Gabriel Magalhaes', club: 'Arsenal', nationality: 'BR', position: 'DEF', basePrice: 36 },
  { name: 'Pervis Estupinan', club: 'Brighton', nationality: 'EC', position: 'DEF', basePrice: 22 },
  { name: 'William Saliba', club: 'Arsenal', nationality: 'FR', position: 'DEF', basePrice: 44 },
])

const COPA_MID = section([
  { name: 'Rodrigo De Paul', club: 'Atletico Madrid', nationality: 'AR', position: 'MID', basePrice: 30 },
  { name: 'Alexis Mac Allister', club: 'Liverpool', nationality: 'AR', position: 'MID', basePrice: 38 },
  { name: 'Enzo Fernandez', club: 'Chelsea', nationality: 'AR', position: 'MID', basePrice: 40 },
  { name: 'Federico Valverde', club: 'Real Madrid', nationality: 'UY', position: 'MID', basePrice: 54 },
  { name: 'Bruno Guimaraes', club: 'Newcastle', nationality: 'BR', position: 'MID', basePrice: 30 },
  { name: 'Douglas Luiz', club: 'Juventus', nationality: 'BR', position: 'MID', basePrice: 28 },
  { name: 'Moises Caicedo', club: 'Chelsea', nationality: 'EC', position: 'MID', basePrice: 36 },
  { name: 'Manuel Ugarte', club: 'Paris Saint-Germain', nationality: 'UY', position: 'MID', basePrice: 24 },
  { name: 'Luis Diaz', club: 'Liverpool', nationality: 'CO', position: 'MID', basePrice: 36 },
  { name: 'Gonzalo Montiel', club: 'Sevilla', nationality: 'AR', position: 'MID', basePrice: 22 },
])

const COPA_FWD = section([
  {
    name: 'Lionel Messi',
    club: 'Inter Miami',
    nationality: 'AR',
    position: 'FWD',
    basePrice: 78,
    isEligibleForIcon: true,
  },
  {
    name: 'Vinicius Jr.',
    club: 'Real Madrid',
    nationality: 'BR',
    position: 'FWD',
    basePrice: 75,
    isEligibleForIcon: true,
  },
  { name: 'Lautaro Martinez', club: 'Inter Milan', nationality: 'AR', position: 'FWD', basePrice: 52 },
  { name: 'Julian Alvarez', club: 'Atletico Madrid', nationality: 'AR', position: 'FWD', basePrice: 40 },
  { name: 'Rodrygo', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 54 },
  { name: 'Raphinha', club: 'Barcelona', nationality: 'BR', position: 'FWD', basePrice: 46 },
  { name: 'Gabriel Martinelli', club: 'Arsenal', nationality: 'BR', position: 'FWD', basePrice: 42 },
  { name: 'Darwin Nunez', club: 'Liverpool', nationality: 'UY', position: 'FWD', basePrice: 36 },
  { name: 'Alexis Sanchez', club: 'Udinese', nationality: 'CL', position: 'FWD', basePrice: 24 },
  { name: 'Eduardo Vargas', club: 'Nacional', nationality: 'CL', position: 'FWD', basePrice: 20 },
])

const COPA_PLAYERS: PlayerTemplate[] = [...COPA_GK, ...COPA_DEF, ...COPA_MID, ...COPA_FWD]
