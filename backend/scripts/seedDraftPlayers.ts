/**
 * seedDraftPlayers.ts — MatchMind v4 §6.5
 *
 * Generates comprehensive seed player data for both LIVE tournaments
 * (fifa-wc-2026 and uefa-ucl-2026-27) to ensure the Draft Mode
 * seeding gate passes (§6.3).
 *
 * Creates ~280 players per tournament with realistic name, club,
 * nationality, position, and basePrice distributions so rarity tiers
 * are populated correctly.
 *
 * Usage:
 *   npx tsx scripts/seedDraftPlayers.ts
 *
 * This REPLACES the existing players.json with the complete seed data.
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')

interface PlayerTemplate {
  name: string
  club: string
  nationality: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  basePrice: number
  isEligibleForIcon?: boolean
}

// ─── Helper to build sections ──────────────────────────

function section(entries: PlayerTemplate[]): PlayerTemplate[] {
  return entries
}

// ─── Realistic player generator ────────────────────────
//
// Generates fictional but realistic-looking players to fill up
// to real tournament squad sizes:
//   FIFA WC 2026: 48 teams × 26 players = 1,248
//   UCL 2026/27:  32 teams × 25 players (List A) = 800
//
// Position distribution per squad: GK~3, DEF~9, MID~8, FWD~6

// First names by region
const FIRST_NAMES: Record<string, string[]> = {
  GB: ['Jack','Harry','Oliver','James','William','Thomas','George','Henry','Daniel','Samuel','Charlie','Joseph','David','Ryan','Luke','Ben','Tom','Chris','Adam','Alex','Max','Lewis','Jamie','Callum','Sam','Liam','Noah','Ethan','Mason','Lucas'],
  ES: ['Santiago','Mateo','Alejandro','Pablo','David','Javier','Carlos','Miguel','Rafael','Daniel','Manuel','Antonio','José','Francisco','Jorge','Luis','Marco','Alvaro','Sergio','Adrian','Isco','Diego','Andres','Victor','Hugo'],
  FR: ['Lucas','Hugo','Raphaël','Antoine','Mathieu','Alexandre','Pierre','Nicolas','Maxime','Clement','Baptiste','Julien','Florian','Quentin','Romain','Theo','Moussa','Yacine','Karim','Adrien'],
  DE: ['Lukas','Felix','Leon','Maximilian','Jonas','Niklas','Finn','Tim','Paul','Erik','Julian','Benedikt','Marco','Timo','Florian','Marcel','Kai','Lars','Sven','Robin','Jan'],
  IT: ['Lorenzo','Alessandro','Andrea','Matteo','Marco','Francesco','Riccardo','Federico','Giovanni','Antonio','Luca','Simone','Davide','Nicola','Giuseppe','Fabio','Paolo','Michele','Stefano','Gianluigi'],
  NL: ['Daan','Sem','Lars','Tim','Jesse','Sven','Niels','Wout','Dirk','Koen','Bram','Thijs','Rens','Thomas','Martijn','Stefan','Bart','Jasper','Quinten','Gijs'],
  PT: ['João','Miguel','Francisco','Gonçalo','Diogo','Rui','Bernardo','Tiago','André','Pedro','Rafael','Nuno','Ricardo','Bruno','Vítor','Hugo','Daniel','David','Martim','Tomás'],
  BR: ['Lucas','Gabriel','Rafael','Pedro','Felipe','Matheus','Gustavo','João','Caio','Vinicius','Bruno','Diego','Thiago','Igor','Carlos','Eduardo','André','Ricardo','Marcos','Paulo'],
  AR: ['Lautaro','Julián','Nahuel','Lucas','Exequiel','Rodrigo','Nicolás','Leandro','Pablo','Gonzalo','Juan','Emiliano','Facundo','Thiago','Cristian','Alejandro','Matías','Franco','Guido','Marcos'],
  UY: ['Federico','Facundo','Rodrigo','Nahuel','Mathías','Cristian','Nicolás','Santiago','Bruno','Diego','Agustín','Gastón','Maximiliano','Lucas','José','Emiliano','Martín','Pablo','Sergio','Sebastián'],
}

const WOMEN_FIRST_NAMES: Record<string, string[]> = {
  GB: ['Mary','Emma','Georgia','Lauren','Bethany','Rachel','Lucy','Millie','Ella','Chloe','Alice','Keira','Niamh','Sophie','Jessica','Lily','Grace','Holly','Freya','Daisy','Maya','Isla','Rose','Ivy'],
  ES: ['María','Ana','Lucía','Paula','Sandra','Irene','Aitana','Claudia','Patricia','Rosa','Carmen','Marta','Nuria','Elena','Silvia','Lara','Alba','Celia','Raquel','Cristina','Natalia','Laura','Andrea','Sara'],
  FR: ['Marie','Camille','Julie','Amandine','Wendie','Eugénie','Clara','Delphine','Kenza','Grace','Léa','Sarah','Pauline','Maëlle','Selma','Inès','Elsa','Margaux','Alice','Manon','Chloé','Sakina','Vicki','Louna'],
  DE: ['Lena','Laura','Alexandra','Svenja','Marina','Sandra','Sara','Linda','Julia','Lea','Merle','Annika','Jule','Isabella','Sophia','Nele','Kim','Amelie','Friederike','Hanna','Kathrin','Janina','Felicitas','Vivien'],
  US: ['Megan','Alex','Sophia','Mallory','Trinity','Lindsey','Crystal','Rose','Naomi','Alyssa','Julie','Catarina','Ashley','Emily','Abby','Carli','Tobin','Kelley','Samantha','Morgan','Lynn','Casey','Lindsay','Hayley'],
  BR: ['Marta','Cristiane','Ana','Beatriz','Gabi','Tamires','Debinha','Bia','Andressa','Aline','Letícia','Ludmila','Rafaelle','Rosana','Duda','Geyse','Thais','Kerolyn','Lorena','Antônia','Yasmim','Mônica','Luana','Angelina'],
  NO: ['Ada','Caroline','Guro','Frida','Maren','Tuva','Lisa','Emilie','Karina','Synne','Ingrid','Cecilie','Maria','Martine','Julie','Andrea','Rikke','Sigrid','Helene','Sara','Thea','Nora','Oda','Sofie'],
  NL: ['Vivianne','Danique','Jill','Lieke','Merel','Dominique','Damaris','Katja','Sari','Liza','Sanne','Sherida','Lynn','Anouk','Renate','Tessel','Lisanne','Stefanie','Nadine','Ashley','Jonna','Ella','Kayleigh','Esmee'],
  JP: ['Saki','Mana','Yui','Hikaru','Moeka','Riko','Fuka','Narumi','Miyabi','Tomomi','Kumi','Honoka','Minami','Risa','Miyu','Yuka','Yoshimi','Ami','Mizuho','Aya','Shinobu','Kozue','Moe','Fubuki'],
  AU: ['Sam','Ellie','Mary','Hayley','Katrina','Alanna','Emily','Clare','Tameka','Teagan','Kyah','Mackenzie','Cortnee','Charlize','Lydia','Kaitlyn','Michelle','Chloe','Sarah','Steph','Amy','Grace','Danielle','Elise'],
  SE: ['Fridolina','Kosovare','Stina','Lina','Hanna','Filippa','Johanna','Nathalie','Madelene','Olivia','Julia','Rebecca','Emma','Josefine','Loreta','Nilla','Jessica','Sofia','Elin','Mimmi'],
}

const LAST_NAMES: string[] = [
  'Silva','Santos','Rodriguez','García','Martínez','López','González','Fernández','Pérez','Sánchez','Ramírez','Torres','Rivera','Morales','Ortiz','Cruz','Reyes','Gutiérrez','Molina','Ramos','Díaz','Flores','Romero','Alvarez','Castillo','Herrera','Medina','Vargas','Castro','Ojeda',
  'Smith','Johnson','Williams','Brown','Jones','Wilson','Taylor','Davies','Evans','Thomas','Roberts','Walker','Wright','Thompson','White','Hughes','Edwards','Green','Hall','Wood','Harris','Martin','Jackson','Clarke','Turner','Hill','Scott','Adams','Baker','Mitchell',
  'Müller','Schmidt','Schneider','Fischer','Weber','Wagner','Becker','Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun','Krüger','Hofmann','Hartmann','Lange','Schmitt','Werner','Schmitz','Krause','Meier','Lehmann','Schulze',
  'Bianchi','Rizzo','Conti','Marino','Greco','Barbieri','Fontana','Rinaldi','Caruso','Moretti','Ferrari','Costa','Rossi','Esposito','Gallo','Mancini','Lombardi','Pellegrini','Fabbri','Martini','Grassi','Parisi','Testa','Bellini','Guerra','Villa','Ferrara','Carbone','Mariani','Basile',
  'Lefèvre','Moreau','Fournier','Girard','André','Mercier','DuPont','Lambert','Bonnet','François','Martinez','Legrand','Garnier','Faure','Rousseau','Blanc','Guerin','Muller','Henry','Roussel','Mathieu','Chevalier','Dupuis','Gauthier','Colin','Lemaire','Roger','Picard','Renard','Baron',
  'Berg','Bakker','van Dijk','de Jong','Visser','Smit','Meijer','de Boer','Mulder','Koster','Bos','Vos','Hofman','Hendriks','van der Heijden','Groot','Peters','Dekker','Blom','Willemsen','Evers','Kuiper','de Wit','Veenstra','Schaap','van der Wal','van der Meer','de Graaf','Koning','Prins',
]

const WC_NATIONALITIES: string[] = [
  'AR','AU','AT','BE','BR','CM','CA','CL','CO','HR','CZ','DK','EC','EG','GB','FR','DE','GH','GR','IE','IL','IT','CI','JM','JP','KR','MA','MX','NL','NG','NO','PA','PY','PE','PL','PT','QA','SN','RS','SK','SI','ZA','ES','SE','CH','TN','UA','UY','US','UZ',
]

const UCL_NATIONALITIES: string[] = [
  'GB','ES','FR','DE','IT','NL','PT','BE','CH','AT','HR','RS','DK','SE','NO','FI','PL','CZ','SK','HU','GR','TR','RU','UA','BR','AR','UY','CO','CL','EC','PE','PY','CA','US','MX','MA','DZ','SN','NG','CI','GH','CM','EG','TN','ZA','IL','JP','KR','AU','NZ','CN',
]

const UEL_NATIONALITIES: string[] = [
  'GB','ES','FR','DE','IT','NL','PT','BE','CH','AT','GR','TR','DK','SE','NO','PL','CZ','HR','RS','HU','SK','SI','RU','UA','IL','BR','AR','UY','CO','EC','PE','MA','DZ','SN','NG','CI','US','CA','JP','KR','AU','NZ',
]

const AFCON_NATIONALITIES: string[] = [
  'DZ','AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
]

const WWC_NATIONALITIES: string[] = [
  'GB','ES','FR','DE','IT','NL','NO','SE','DK','CH','BR','AR','CO','JP','AU','US','CA','MX','NG','ZA','CM','GH','MA','TN','JM','KR','NZ','CN','PH','IE','PT','CR','PA','HT','NZ','FI','PL','IS','VE','KP','TH','TP','MY','ID','IN','HK','MO',
]

const COPA_NATIONALITIES: string[] = [
  'AR','BO','BR','CL','CO','EC','PY','PE','UY','VE','US','MX','JM','CR','PA','CA','JP','QA','AU','NZ','HT','HN','SV','DO','CW',
]

const WC_CLUBS: string[] = [
  'Real Madrid','Barcelona','Atlético Madrid','Valencia','Sevilla','Real Sociedad','Athletic Bilbao','Villarreal','Real Betis','Girona','Manchester City','Manchester United','Liverpool','Arsenal','Chelsea','Tottenham','Aston Villa','Newcastle','Brighton','West Ham','Bayern Munich','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','VfB Stuttgart','Eintracht Frankfurt','Inter Milan','AC Milan','Juventus','Napoli','Roma','Lazio','Atalanta','Fiorentina','Paris Saint-Germain','Marseille','Monaco','Lille','Lyon','Nice','Benfica','Porto','Sporting CP','Braga','Ajax','Feyenoord','PSV','Club Brugge','Celtic','Rangers','Shakhtar Donetsk','Dinamo Zagreb','Olympiacos','Fenerbahçe','Galatasaray','Al Hilal','Al Nassr','Inter Miami','LA Galaxy','Cruz Azul','Monterrey','Palmeiras','Flamengo','Boca Juniors','River Plate','UANL','América','Santos Laguna','Mazatlán','León','Atlas','Chivas','Pumas','Puebla','Tijuana','Querétaro','Juárez','Necaxa','Pachuca','Toluca','Atlanta United','NYC FC','LAFC','Seattle Sounders','Austin FC','Portland Timbers','Columbus Crew','Philadelphia Union','Orlando City','Sporting KC',
]

const UCL_CLUBS: string[] = [
  'Real Madrid','Barcelona','Atlético Madrid','Sevilla','Real Sociedad','Athletic Bilbao','Girona','Manchester City','Manchester United','Liverpool','Arsenal','Chelsea','Tottenham','Newcastle','Aston Villa','Bayern Munich','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','Stuttgart','Eintracht Frankfurt','Inter Milan','AC Milan','Juventus','Napoli','Lazio','Atalanta','Paris Saint-Germain','Marseille','Monaco','Lille','Benfica','Porto','Sporting CP','Braga','Feyenoord','PSV','Ajax','Celtic','Rangers','Club Brugge','Shakhtar Donetsk','Dinamo Zagreb','Olympiacos','Galatasaray','Fenerbahçe','Young Boys','Slavia Prague','Sparta Prague','Red Star Belgrade','Malmö','Midtjylland','Copenhagen','Ferencváros','Antwerp','Union Saint-Gilloise','Sturm Graz','Molde','Bodo/Glimt','Qarabag','Ludogorets','Sheriff Tiraspol','Astana','PAOK','Partizan','Legia Warsaw','Maccabi Tel Aviv','HJK Helsinki','Zrinjski','Olimpija Ljubljana','Raków Częstochowa',
]

const UEL_CLUBS: string[] = [
  'Roma','Lazio','Atalanta','Fiorentina','Bologna','Marseille','Nice','Lyon','Lille','Monaco','Real Sociedad','Athletic Bilbao','Villarreal','Real Betis','Eintracht Frankfurt','Hoffenheim','Mainz','Werder Bremen','Freiburg','Wolfsburg','Porto','Benfica','Sporting CP','Braga','Ajax','Feyenoord','PSV','Twente','Rangers','Celtic','Slavia Prague','Sparta Prague','Fenerbahçe','Galatasaray','Besiktas','Union Saint-Gilloise','Gent','Anderlecht','PAOK','Olympiacos','AEK Athens','Dinamo Zagreb','Red Star Belgrade','Partizan','Molde','Bodo/Glimt','Ferencváros','Legia Warsaw','Maccabi Tel Aviv','Qarabag','Ludogorets','Astana','Midtjylland','Copenhagen','Malmö','Elfsborg','Sturm Graz','Austria Vienna','Hearts','Aberdeen','FCSB','Rapid Vienna','Hajduk Split','Osijek','Lugano','Servette','Basel','Young Boys','Panathinaikos','Aris Salonika','Anorthosis','Omonia','Slovan Bratislava','Spartak Trnava','Pyunik','Ararat-Armenia','Dinamo Minsk','Wisła Kraków','Raków Częstochowa',
]

const AFCON_CLUBS: string[] = [
  'Al Ahly','Zamalek','Pyramids','Esperance','Étoile du Sahel','Club Africain','Raja Casablanca','Wydad Casablanca','FAR Rabat','Mamelodi Sundowns','Kaizer Chiefs','Orlando Pirates','Simba','Young Africans','TP Mazembe','ASEC Mimosas','Hearts of Oak','Kotoko','Enyimba','Rivers United','JS Kabylie','CR Belouizdad','ESS Sétif','Horoya','Stade Malien','Coton Sport','Al Hilal Omdurman','Al Merrikh','Zesco United','Green Buffaloes','Ferroviário da Beira','USM Alger','MC Alger','ASC Diaraf','Génération Foot','Ahli Tripoli','Al Ahli Benghazi','Saint-Étienne','Lens','Toulouse','Le Havre','Metz','Angers','Brest','Nantes','Montpellier','Reims','Lorient','Auxerre','Al Nassr','Al Hilal','Al Ittihad','Al Shabab','Olympiacos','PAOK','AEK Athens','Panathinaikos','Basaksehir','Trabzonspor','Sivasspor','Fiorentina','Torino','Udinese','Empoli','Lecce','Genoa','Getafe','Osasuna','Celta Vigo','Rayo Vallecano','Mallorca','Las Palmas','Alavés',
]

const WWC_CLUBS: string[] = [
  'Lyon','Barcelona','Chelsea','Arsenal','Manchester City','Bayern Munich','Paris Saint-Germain','Wolfsburg','Roma','Juventus','AC Milan','Inter Milan','Real Madrid','Atlético Madrid','Levante','Benfica','Sporting CP','Ajax','Twente','PSV','Rosengård','Hammarby','BK Häcken','Linköping','Brann','Rosenborg','Lillestrøm','Vålerenga','Slavia Prague','Sparta Prague','St. Pölten','Glasgow City','Celtic','Rangers','HB Køge','Nordsjælland','Fleury','Montpellier','Bordeaux','Portland Thorns','OL Reign','San Diego Wave','Angel City','Chicago Red Stars','Houston Dash','Kansas City Current','NJ/NY Gotham','North Carolina Courage','Orlando Pride','Racing Louisville','Washington Spirit','Western United','Melbourne City','Sydney FC','Brisbane Roar','Canberra United','Tokyo Verdy Beleza','Urawa Reds','INAC Kobe','Mynavi Sendai','Hwacheon KSPO','Suwon FC','Alajuelense','Saprissa','Independiente Santa Fe','América de Cali','Corinthians','Palmeiras','Santos','Ferroviária','Internacional','Grêmio','Boca Juniors','River Plate','UAI Urquiza','San Lorenzo','Colo-Colo','Santiago Morning','Universidad de Chile','Maccabi Kiryat Gat','Ramat Hasharon','Hapoel Petah Tikva','Minsk','Dinamo Minsk','Apollon Limassol','PAOK','BIIK Kazygurt','SFK 2000','Spartak Moscow','CSKA Moscow','Zenit','Lokomotiv Moscow',
]

const COPA_CLUBS: string[] = [
  'Flamengo','Palmeiras','São Paulo','Santos','Corinthians','Grêmio','Internacional','Cruzeiro','Atlético Mineiro','Fluminense','Botafogo','Vasco da Gama','Bahia','Fortaleza','Athletico Paranaense','Boca Juniors','River Plate','Independiente','Racing Club','San Lorenzo','Vélez Sarsfield','Estudiantes','Newell Old Boys','Rosario Central','Talleres','Defensa y Justicia','Lanús','Nacional','Peñarol','Defensor Sporting','Liverpool Montevideo','Cerro Porteño','Olimpia','Libertad','Colo-Colo','Universidad de Chile','Universidad Católica','Palestino','LDU Quito','Barcelona SC','Independiente del Valle','Emelec','El Nacional','Aucas','Alianza Lima','Universitario','Sporting Cristal','Melgar','Cienciano','Millonarios','América de Cali','Atlético Nacional','Deportivo Cali','Junior','Independiente Medellín','Santa Fe','Deportes Tolima','Once Caldas','Deportivo Pasto','Deportivo Pereira','La Equidad','River Plate Asunción','Guaraní','Nacional Asunción','Sol de América','Sportivo Luqueño','Aurora','Bolívar','The Strongest','Always Ready','Wilstermann','Real Santa Cruz','Fluminense','Grêmio','Internacional','Criciúma','Cuiabá','Juventude','Red Bull Bragantino','Coritiba','Goiás','Sport Recife',
]
function pick<T>(arr: T[], exclude?: Set<T>): T {
  const pool = exclude ? arr.filter((x) => !exclude.has(x)) : arr
  return pool[Math.floor(Math.random() * pool.length)]
}

// Generate first name based on nationality (fallback to a generic list)
function firstName(nationality: string): string {
  const names = FIRST_NAMES[nationality]
  if (names) return names[Math.floor(Math.random() * names.length)]
  const allNames = Object.values(FIRST_NAMES).flat()
  return allNames[Math.floor(Math.random() * allNames.length)]
}

function womenFirstName(nationality: string): string {
  const names = WOMEN_FIRST_NAMES[nationality]
  if (names) return names[Math.floor(Math.random() * names.length)]
  const allNames = Object.values(WOMEN_FIRST_NAMES).flat()
  return allNames[Math.floor(Math.random() * allNames.length)]
}

function generateFillerPlayers(
  existing: PlayerTemplate[],
  targetCount: number,
  nationalities: string[],
  clubs: string[],
  womenNames?: boolean,
): PlayerTemplate[] {
  if (existing.length >= targetCount) return []

  const fillers: PlayerTemplate[] = []
  const existingNames = new Set(existing.map((p) => p.name))
  const usedNames = new Set<string>()
  const needed = targetCount - existing.length

  // Position distribution: GK~12%, DEF~34%, MID~30%, FWD~24%
  const posTargets = {
    GK: Math.round(needed * 0.12),
    DEF: Math.round(needed * 0.34),
    MID: Math.round(needed * 0.30),
    FWD: Math.round(needed * 0.24),
  }

  // Price tiers per position (ensure good distribution)
  // We need a mix of low/med/high prices so rarity tiers compute correctly
  const positionPriceRanges: Record<string, [number, number][]> = {
    GK: [[8, 20], [22, 35], [36, 50], [52, 68]],
    DEF: [[8, 18], [20, 30], [32, 44], [46, 55]],
    MID: [[8, 18], [20, 30], [32, 44], [46, 65]],
    FWD: [[8, 18], [20, 30], [32, 44], [46, 70]],
  }

  // Shuffle nationalities array for better distribution
  const shuffledNat = [...nationalities].sort(() => Math.random() - 0.5)

  for (const [pos, count] of Object.entries(posTargets) as [string, number][]) {
    const ranges = positionPriceRanges[pos]
    for (let i = 0; i < count; i++) {
      // Pick nationality with round-robin distribution
      const nat = shuffledNat[i % shuffledNat.length]
      const club = pick(clubs)

      // Generate unique name
      let name = ''
      for (let attempt = 0; attempt < 50; attempt++) {
        const first = womenNames ? womenFirstName(nat) : firstName(nat)
        const last = pick(LAST_NAMES)
        const candidate = `${first} ${last}`
        if (!existingNames.has(candidate) && !usedNames.has(candidate)) {
          name = candidate
          usedNames.add(candidate)
          break
        }
      }
      if (!name) continue // Skip if we can't find a unique name

      // Distribute prices across the 4 buckets (roughly 25% each)
      const bucketIdx = i % 4
      const [minP, maxP] = ranges[bucketIdx]
      const price = minP + Math.round(Math.random() * (maxP - minP))

      fillers.push({ name, club, nationality: nat, position: pos as 'GK' | 'DEF' | 'MID' | 'FWD', basePrice: price })
    }
  }

  // Shuffle for variety
  return fillers.sort(() => Math.random() - 0.5)
}

// ─── FIFA World Cup 2026 (~275 players) ─────────────────

const WC_GK = section([
  { name: 'Thibaut Courtois', club: 'Real Madrid', nationality: 'BE', position: 'GK', basePrice: 72 },
  { name: 'Alisson Becker', club: 'Liverpool', nationality: 'BR', position: 'GK', basePrice: 68 },
  { name: 'Ederson', club: 'Manchester City', nationality: 'BR', position: 'GK', basePrice: 62 },
  { name: 'Mike Maignan', club: 'AC Milan', nationality: 'FR', position: 'GK', basePrice: 60 },
  { name: 'Gianluigi Donnarumma', club: 'Paris Saint-Germain', nationality: 'IT', position: 'GK', basePrice: 58 },
  { name: 'Marc-André ter Stegen', club: 'Barcelona', nationality: 'DE', position: 'GK', basePrice: 56 },
  { name: 'Jan Oblak', club: 'Atlético Madrid', nationality: 'SI', position: 'GK', basePrice: 54 },
  { name: 'Emiliano Martínez', club: 'Aston Villa', nationality: 'AR', position: 'GK', basePrice: 52 },
  { name: 'Manuel Neuer', club: 'Bayern Munich', nationality: 'DE', position: 'GK', basePrice: 48 },
  { name: 'David Raya', club: 'Arsenal', nationality: 'ES', position: 'GK', basePrice: 46 },
  { name: 'Gregor Kobel', club: 'Borussia Dortmund', nationality: 'CH', position: 'GK', basePrice: 42 },
  { name: 'Diogo Costa', club: 'FC Porto', nationality: 'PT', position: 'GK', basePrice: 40 },
  { name: 'André Onana', club: 'Manchester United', nationality: 'CM', position: 'GK', basePrice: 38 },
  { name: 'Unai Simón', club: 'Athletic Bilbao', nationality: 'ES', position: 'GK', basePrice: 36 },
  { name: 'Jordan Pickford', club: 'Everton', nationality: 'GB', position: 'GK', basePrice: 34 },
  { name: 'Giorgi Mamardashvili', club: 'Valencia', nationality: 'GE', position: 'GK', basePrice: 32 },
  { name: 'Yassine Bounou', club: 'Al Hilal', nationality: 'MA', position: 'GK', basePrice: 30 },
  { name: 'Alex Remiro', club: 'Real Sociedad', nationality: 'ES', position: 'GK', basePrice: 28 },
  { name: 'Lunin Andriy', club: 'Real Madrid', nationality: 'UA', position: 'GK', basePrice: 26 },
  { name: 'Robert Sánchez', club: 'Chelsea', nationality: 'ES', position: 'GK', basePrice: 24 },
  { name: 'Alphonse Areola', club: 'West Ham', nationality: 'FR', position: 'GK', basePrice: 20 },
  { name: 'Mark Flekken', club: 'Brentford', nationality: 'NL', position: 'GK', basePrice: 16 },
  { name: 'Koen Casteels', club: 'Al Qadsiah', nationality: 'BE', position: 'GK', basePrice: 14 },
  { name: 'Mathew Ryan', club: 'AZ Alkmaar', nationality: 'AU', position: 'GK', basePrice: 10 },
  { name: 'Carlos Acevedo', club: 'Santos Laguna', nationality: 'MX', position: 'GK', basePrice: 48 },
  { name: 'Guillermo Ochoa', club: 'Salernitana', nationality: 'MX', position: 'GK', basePrice: 34 },
  { name: 'Caoimhín Kelleher', club: 'Liverpool', nationality: 'IE', position: 'GK', basePrice: 28 },
  { name: 'Lucas Chevalier', club: 'Lille', nationality: 'FR', position: 'GK', basePrice: 32 },
  { name: 'Marco Carnesecchi', club: 'Atalanta', nationality: 'IT', position: 'GK', basePrice: 30 },
  { name: 'Wojciech Szczęsny', club: 'Barcelona', nationality: 'PL', position: 'GK', basePrice: 36 },
  { name: 'Guglielmo Vicario', club: 'Tottenham', nationality: 'IT', position: 'GK', basePrice: 32 },
  { name: 'Dominik Livaković', club: 'Fenerbahçe', nationality: 'HR', position: 'GK', basePrice: 30 },
  { name: 'Ivan Provedel', club: 'Lazio', nationality: 'IT', position: 'GK', basePrice: 28 },
])

const WC_DEF = section([
  { name: 'Virgil van Dijk', club: 'Liverpool', nationality: 'NL', position: 'DEF', basePrice: 55 },
  { name: 'Rúben Dias', club: 'Manchester City', nationality: 'PT', position: 'DEF', basePrice: 50 },
  { name: 'William Saliba', club: 'Arsenal', nationality: 'FR', position: 'DEF', basePrice: 45 },
  { name: 'Theo Hernández', club: 'AC Milan', nationality: 'FR', position: 'DEF', basePrice: 40 },
  { name: 'Achraf Hakimi', club: 'Paris Saint-Germain', nationality: 'MA', position: 'DEF', basePrice: 42 },
  { name: 'Antonio Rüdiger', club: 'Real Madrid', nationality: 'DE', position: 'DEF', basePrice: 44 },
  { name: 'Jules Koundé', club: 'Barcelona', nationality: 'FR', position: 'DEF', basePrice: 40 },
  { name: 'Daniel Carvajal', club: 'Real Madrid', nationality: 'ES', position: 'DEF', basePrice: 38 },
  { name: 'Josko Gvardiol', club: 'Manchester City', nationality: 'HR', position: 'DEF', basePrice: 43 },
  { name: 'Dayot Upamecano', club: 'Bayern Munich', nationality: 'FR', position: 'DEF', basePrice: 38 },
  { name: 'John Stones', club: 'Manchester City', nationality: 'GB', position: 'DEF', basePrice: 36 },
  { name: 'Ronald Araújo', club: 'Barcelona', nationality: 'UY', position: 'DEF', basePrice: 37 },
  { name: 'Trent Alexander-Arnold', club: 'Liverpool', nationality: 'GB', position: 'DEF', basePrice: 42 },
  { name: 'Kyle Walker', club: 'Manchester City', nationality: 'GB', position: 'DEF', basePrice: 34 },
  { name: 'Alphonso Davies', club: 'Bayern Munich', nationality: 'CA', position: 'DEF', basePrice: 39 },
  { name: 'Gabriel Magalhães', club: 'Arsenal', nationality: 'BR', position: 'DEF', basePrice: 35 },
  { name: 'Eder Militão', club: 'Real Madrid', nationality: 'BR', position: 'DEF', basePrice: 36 },
  { name: 'Micky van de Ven', club: 'Tottenham', nationality: 'NL', position: 'DEF', basePrice: 32 },
  { name: 'João Cancelo', club: 'Barcelona', nationality: 'PT', position: 'DEF', basePrice: 34 },
  { name: 'Alejandro Balde', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 30 },
  { name: 'Nico Schlotterbeck', club: 'Borussia Dortmund', nationality: 'DE', position: 'DEF', basePrice: 30 },
  { name: 'Jonathan Tah', club: 'Bayer Leverkusen', nationality: 'DE', position: 'DEF', basePrice: 29 },
  { name: 'Pau Torres', club: 'Aston Villa', nationality: 'ES', position: 'DEF', basePrice: 28 },
  { name: 'Jurriën Timber', club: 'Arsenal', nationality: 'NL', position: 'DEF', basePrice: 27 },
  { name: 'Cristian Romero', club: 'Tottenham', nationality: 'AR', position: 'DEF', basePrice: 31 },
  { name: 'Lisandro Martínez', club: 'Manchester United', nationality: 'AR', position: 'DEF', basePrice: 44 },
  { name: 'Marcos Marquinhos', club: 'Paris Saint-Germain', nationality: 'BR', position: 'DEF', basePrice: 48 },
  { name: 'Andrew Robertson', club: 'Liverpool', nationality: 'GB', position: 'DEF', basePrice: 48 },
  { name: 'Ibrahima Konaté', club: 'Liverpool', nationality: 'FR', position: 'DEF', basePrice: 44 },
  { name: 'Kieran Trippier', club: 'Newcastle', nationality: 'GB', position: 'DEF', basePrice: 46 },
  { name: 'Ben White', club: 'Arsenal', nationality: 'GB', position: 'DEF', basePrice: 44 },
  { name: 'Jeremie Frimpong', club: 'Bayer Leverkusen', nationality: 'NL', position: 'DEF', basePrice: 44 },
  { name: 'Malo Gusto', club: 'Chelsea', nationality: 'FR', position: 'DEF', basePrice: 42 },
  { name: 'Pedro Porro', club: 'Tottenham', nationality: 'ES', position: 'DEF', basePrice: 42 },
  { name: 'José María Giménez', club: 'Atlético Madrid', nationality: 'UY', position: 'DEF', basePrice: 38 },
  { name: 'Nuno Mendes', club: 'Paris Saint-Germain', nationality: 'PT', position: 'DEF', basePrice: 40 },
  { name: 'Alex Grimaldo', club: 'Bayer Leverkusen', nationality: 'ES', position: 'DEF', basePrice: 42 },
  { name: 'Federico Dimarco', club: 'Inter Milan', nationality: 'IT', position: 'DEF', basePrice: 40 },
  { name: 'Alessandro Bastoni', club: 'Inter Milan', nationality: 'IT', position: 'DEF', basePrice: 42 },
  { name: 'Destiny Udogie', club: 'Tottenham', nationality: 'IT', position: 'DEF', basePrice: 40 },
  { name: 'Reece James', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 26 },
  { name: 'Levi Colwill', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 34 },
  { name: 'Noussair Mazraoui', club: 'Manchester United', nationality: 'MA', position: 'DEF', basePrice: 24 },
  { name: 'Luke Shaw', club: 'Manchester United', nationality: 'GB', position: 'DEF', basePrice: 24 },
  { name: 'Ben Chilwell', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 28 },
  { name: 'César Azpilicueta', club: 'Atlético Madrid', nationality: 'ES', position: 'DEF', basePrice: 22 },
  { name: 'Fikayo Tomori', club: 'AC Milan', nationality: 'GB', position: 'DEF', basePrice: 25 },
  { name: 'David Alaba', club: 'Real Madrid', nationality: 'AT', position: 'DEF', basePrice: 26 },
  { name: 'Kim Min-jae', club: 'Bayern Munich', nationality: 'KR', position: 'DEF', basePrice: 23 },
  { name: 'Pervis Estupiñán', club: 'Brighton', nationality: 'EC', position: 'DEF', basePrice: 20 },
  { name: 'Nathan Aké', club: 'Manchester City', nationality: 'NL', position: 'DEF', basePrice: 22 },
  { name: 'Marc Cucurella', club: 'Chelsea', nationality: 'ES', position: 'DEF', basePrice: 18 },
  { name: 'Emerson Royal', club: 'Tottenham', nationality: 'BR', position: 'DEF', basePrice: 18 },
  { name: 'Jarrad Branthwaite', club: 'Everton', nationality: 'GB', position: 'DEF', basePrice: 14 },
  { name: 'Mario Hermoso', club: 'Roma', nationality: 'ES', position: 'DEF', basePrice: 15 },
  { name: 'Romain Saïss', club: 'Al Shabab', nationality: 'MA', position: 'DEF', basePrice: 10 },
  { name: 'Eric Dier', club: 'Bayern Munich', nationality: 'GB', position: 'DEF', basePrice: 13 },
  { name: 'Sven Botman', club: 'Newcastle', nationality: 'NL', position: 'DEF', basePrice: 28 },
  { name: 'Fabian Schär', club: 'Newcastle', nationality: 'CH', position: 'DEF', basePrice: 24 },
  { name: 'Pau Cubarsí', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 30 },
  { name: 'Raphaël Varane', club: 'Como', nationality: 'FR', position: 'DEF', basePrice: 26 },
  { name: 'Sergio Ramos', club: 'Sevilla', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Jordi Alba', club: 'Inter Miami', nationality: 'ES', position: 'DEF', basePrice: 22 },
  { name: 'Mats Hummels', club: 'Roma', nationality: 'DE', position: 'DEF', basePrice: 20 },
  { name: 'Nahuel Molina', club: 'Atlético Madrid', nationality: 'AR', position: 'DEF', basePrice: 30 },
  { name: 'Riccardo Calafiori', club: 'Bologna', nationality: 'IT', position: 'DEF', basePrice: 16 },
  { name: 'Tino Livramento', club: 'Newcastle', nationality: 'GB', position: 'DEF', basePrice: 20 },
  { name: 'Jarrad Branthwaite', club: 'Everton', nationality: 'GB', position: 'DEF', basePrice: 48 },
  { name: 'Nico Tagliafico', club: 'Lyon', nationality: 'AR', position: 'DEF', basePrice: 22 },
  { name: 'Noussair Mazraoui', club: 'Manchester United', nationality: 'MA', position: 'DEF', basePrice: 46 },
  { name: 'Jan Paul van Hecke', club: 'Brighton', nationality: 'NL', position: 'DEF', basePrice: 44 },
  { name: 'Joško Gvardiol', club: 'Manchester City', nationality: 'HR', position: 'DEF', basePrice: 48 },
  { name: 'Matías Viña', club: 'Flamengo', nationality: 'UY', position: 'DEF', basePrice: 18 },
  { name: 'Trevoh Chalobah', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 52 },
  { name: 'Ousmane Diomande', club: 'Sporting CP', nationality: 'CI', position: 'DEF', basePrice: 52 },
  { name: 'Gonçalo Inácio', club: 'Sporting CP', nationality: 'PT', position: 'DEF', basePrice: 50 },
  { name: 'Jarrad Branthwaite', club: 'Everton', nationality: 'GB', position: 'DEF', basePrice: 50 },
  { name: 'Maxence Lacroix', club: 'Crystal Palace', nationality: 'FR', position: 'DEF', basePrice: 50 },
  { name: 'Lucas Beraldo', club: 'Paris Saint-Germain', nationality: 'BR', position: 'DEF', basePrice: 48 },
  { name: 'Jan Paul van Hecke', club: 'Brighton', nationality: 'GB', position: 'DEF', basePrice: 48 },
  { name: 'Cristian Romero', club: 'Tottenham', nationality: 'AR', position: 'DEF', basePrice: 48 },
  { name: 'Nico Tagliafico', club: 'Lyon', nationality: 'AR', position: 'DEF', basePrice: 46 },
  { name: 'Lewis Hall', club: 'Newcastle', nationality: 'GB', position: 'DEF', basePrice: 16 },
  { name: 'Héctor Fort', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 16 },
  { name: 'Inigo Martínez', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Benoît Badiashile', club: 'Chelsea', nationality: 'FR', position: 'DEF', basePrice: 24 },
  { name: 'Konrad Laimer', club: 'Bayern Munich', nationality: 'AT', position: 'DEF', basePrice: 22 },
  { name: 'Raphaël Guerreiro', club: 'Bayern Munich', nationality: 'PT', position: 'DEF', basePrice: 22 },
  { name: 'Edmond Tapsoba', club: 'Bayer Leverkusen', nationality: 'BF', position: 'DEF', basePrice: 28 },
  { name: 'Odilon Kossounou', club: 'Bayer Leverkusen', nationality: 'CI', position: 'DEF', basePrice: 24 },
])

const WC_MID = section([
  { name: 'Jude Bellingham', club: 'Real Madrid', nationality: 'GB', position: 'MID', basePrice: 80 },
  { name: 'Rodri', club: 'Manchester City', nationality: 'ES', position: 'MID', basePrice: 70 },
  { name: 'Declan Rice', club: 'Arsenal', nationality: 'GB', position: 'MID', basePrice: 55 },
  { name: 'Phil Foden', club: 'Manchester City', nationality: 'GB', position: 'MID', basePrice: 60 },
  { name: 'Jamal Musiala', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 65 },
  { name: 'Florian Wirtz', club: 'Bayer Leverkusen', nationality: 'DE', position: 'MID', basePrice: 60 },
  { name: 'Martin Ødegaard', club: 'Arsenal', nationality: 'NO', position: 'MID', basePrice: 55 },
  { name: 'Federico Valverde', club: 'Real Madrid', nationality: 'UY', position: 'MID', basePrice: 54 },
  { name: 'Eduardo Camavinga', club: 'Real Madrid', nationality: 'FR', position: 'MID', basePrice: 48 },
  { name: 'Aurélien Tchouaméni', club: 'Real Madrid', nationality: 'FR', position: 'MID', basePrice: 46 },
  { name: 'Pedri', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 52 },
  { name: 'Gavi', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 48 },
  { name: 'Ilkay Gündogan', club: 'Manchester City', nationality: 'DE', position: 'MID', basePrice: 42 },
  { name: 'Kevin De Bruyne', club: 'Manchester City', nationality: 'BE', position: 'MID', basePrice: 58 },
  { name: 'Bruno Fernandes', club: 'Manchester United', nationality: 'PT', position: 'MID', basePrice: 44 },
  { name: 'Cole Palmer', club: 'Chelsea', nationality: 'GB', position: 'MID', basePrice: 50 },
  { name: 'James Maddison', club: 'Tottenham', nationality: 'GB', position: 'MID', basePrice: 38 },
  { name: 'Enzo Fernández', club: 'Chelsea', nationality: 'AR', position: 'MID', basePrice: 40 },
  { name: 'Moises Caicedo', club: 'Chelsea', nationality: 'EC', position: 'MID', basePrice: 36 },
  { name: 'Alexis Mac Allister', club: 'Liverpool', nationality: 'AR', position: 'MID', basePrice: 39 },
  { name: 'Dominik Szoboszlai', club: 'Liverpool', nationality: 'HU', position: 'MID', basePrice: 37 },
  { name: 'Ryan Gravenberch', club: 'Liverpool', nationality: 'NL', position: 'MID', basePrice: 30 },
  { name: 'Bernardo Silva', club: 'Manchester City', nationality: 'PT', position: 'MID', basePrice: 45 },
  { name: 'Frenkie de Jong', club: 'Barcelona', nationality: 'NL', position: 'MID', basePrice: 40 },
  { name: 'Dani Olmo', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 35 },
  { name: 'Warren Zaïre-Emery', club: 'Paris Saint-Germain', nationality: 'FR', position: 'MID', basePrice: 32 },
  { name: 'Vitinha', club: 'Paris Saint-Germain', nationality: 'PT', position: 'MID', basePrice: 30 },
  { name: 'Hakan Çalhanoğlu', club: 'Inter Milan', nationality: 'TR', position: 'MID', basePrice: 32 },
  { name: 'Nicolo Barella', club: 'Inter Milan', nationality: 'IT', position: 'MID', basePrice: 35 },
  { name: 'Joshua Kimmich', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 38 },
  { name: 'Leon Goretzka', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 30 },
  { name: 'Julian Brandt', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 24 },
  { name: 'Marcel Sabitzer', club: 'Borussia Dortmund', nationality: 'AT', position: 'MID', basePrice: 22 },
  { name: 'Exequiel Palacios', club: 'Bayer Leverkusen', nationality: 'AR', position: 'MID', basePrice: 25 },
  { name: 'Granit Xhaka', club: 'Bayer Leverkusen', nationality: 'CH', position: 'MID', basePrice: 24 },
  { name: 'Amadou Onana', club: 'Aston Villa', nationality: 'BE', position: 'MID', basePrice: 22 },
  { name: 'Youri Tielemans', club: 'Aston Villa', nationality: 'BE', position: 'MID', basePrice: 20 },
  { name: 'Kobbie Mainoo', club: 'Manchester United', nationality: 'GB', position: 'MID', basePrice: 34 },
  { name: 'Sandro Tonali', club: 'Newcastle', nationality: 'IT', position: 'MID', basePrice: 28 },
  { name: 'Bruno Guimarães', club: 'Newcastle', nationality: 'BR', position: 'MID', basePrice: 30 },
  { name: 'Conor Gallagher', club: 'Atlético Madrid', nationality: 'GB', position: 'MID', basePrice: 20 },
  { name: 'Scott McTominay', club: 'Napoli', nationality: 'GB', position: 'MID', basePrice: 18 },
  { name: 'Arda Güler', club: 'Real Madrid', nationality: 'TR', position: 'MID', basePrice: 28 },
  { name: 'Luka Modrić', club: 'Real Madrid', nationality: 'HR', position: 'MID', basePrice: 30 },
  { name: 'Toni Kroos', club: 'Real Madrid', nationality: 'DE', position: 'MID', basePrice: 30 },
  { name: 'Harvey Elliott', club: 'Brighton', nationality: 'GB', position: 'MID', basePrice: 24 },
  { name: 'Curtis Jones', club: 'Liverpool', nationality: 'GB', position: 'MID', basePrice: 26 },
  { name: 'Pape Matar Sarr', club: 'Tottenham', nationality: 'SN', position: 'MID', basePrice: 28 },
  { name: 'Yves Bissouma', club: 'Tottenham', nationality: 'ML', position: 'MID', basePrice: 24 },
  { name: 'Aleksandar Pavlović', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 28 },
  { name: 'João Palhinha', club: 'Bayern Munich', nationality: 'PT', position: 'MID', basePrice: 30 },
  { name: 'Dani Ceballos', club: 'Real Madrid', nationality: 'ES', position: 'MID', basePrice: 20 },
  { name: 'Sergio Busquets', club: 'Inter Miami', nationality: 'ES', position: 'MID', basePrice: 22 },
  { name: 'Fermín López', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 28 },
  { name: 'Romeo Lavia', club: 'Chelsea', nationality: 'BE', position: 'MID', basePrice: 24 },
  { name: 'Pascal Groß', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 26 },
  { name: 'Felix Nmecha', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 22 },
  { name: 'Rodrigo De Paul', club: 'Atlético Madrid', nationality: 'AR', position: 'MID', basePrice: 30 },
  { name: 'Christian Pulisic', club: 'AC Milan', nationality: 'US', position: 'MID', basePrice: 30 },
  { name: 'Tijjani Reijnders', club: 'AC Milan', nationality: 'NL', position: 'MID', basePrice: 28 },
  { name: 'Ismaël Bennacer', club: 'AC Milan', nationality: 'DZ', position: 'MID', basePrice: 26 },
  { name: 'Alejandro Garnacho', club: 'Manchester United', nationality: 'AR', position: 'MID', basePrice: 34 },
  { name: 'Mason Mount', club: 'Manchester United', nationality: 'GB', position: 'MID', basePrice: 26 },
])

const WC_FWD = section([
  { name: 'Kylian Mbappé', club: 'Real Madrid', nationality: 'FR', position: 'FWD', basePrice: 85, isEligibleForIcon: true },
  { name: 'Erling Haaland', club: 'Manchester City', nationality: 'NO', position: 'FWD', basePrice: 90, isEligibleForIcon: true },
  { name: 'Vinícius Jr.', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 75, isEligibleForIcon: true },
  { name: 'Bukayo Saka', club: 'Arsenal', nationality: 'GB', position: 'FWD', basePrice: 65, isEligibleForIcon: true },
  { name: 'Lamine Yamal', club: 'Barcelona', nationality: 'ES', position: 'FWD', basePrice: 70, isEligibleForIcon: true },
  { name: 'Harry Kane', club: 'Bayern Munich', nationality: 'GB', position: 'FWD', basePrice: 58 },
  { name: 'Mohamed Salah', club: 'Liverpool', nationality: 'EG', position: 'FWD', basePrice: 60 },
  { name: 'Rodrygo', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 55 },
  { name: 'Lautaro Martínez', club: 'Inter Milan', nationality: 'AR', position: 'FWD', basePrice: 52 },
  { name: 'Antoine Griezmann', club: 'Atlético Madrid', nationality: 'FR', position: 'FWD', basePrice: 50 },
  { name: 'Ousmane Dembélé', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 48 },
  { name: 'Victor Osimhen', club: 'Galatasaray', nationality: 'NG', position: 'FWD', basePrice: 44 },
  { name: 'Raphinha', club: 'Barcelona', nationality: 'BR', position: 'FWD', basePrice: 46 },
  { name: 'Gabriel Martinelli', club: 'Arsenal', nationality: 'BR', position: 'FWD', basePrice: 42 },
  { name: 'Julian Álvarez', club: 'Atlético Madrid', nationality: 'AR', position: 'FWD', basePrice: 40 },
  { name: 'Kingsley Coman', club: 'Bayern Munich', nationality: 'FR', position: 'FWD', basePrice: 38 },
  { name: 'Leroy Sané', club: 'Bayern Munich', nationality: 'DE', position: 'FWD', basePrice: 40 },
  { name: 'Khvicha Kvaratskhelia', club: 'Napoli', nationality: 'GE', position: 'FWD', basePrice: 38 },
  { name: 'Luis Díaz', club: 'Liverpool', nationality: 'CO', position: 'FWD', basePrice: 37 },
  { name: 'Marcus Rashford', club: 'Manchester United', nationality: 'GB', position: 'FWD', basePrice: 36 },
  { name: 'Darwin Núñez', club: 'Liverpool', nationality: 'UY', position: 'FWD', basePrice: 35 },
  { name: 'Christopher Nkunku', club: 'Chelsea', nationality: 'FR', position: 'FWD', basePrice: 34 },
  { name: 'Cody Gakpo', club: 'Liverpool', nationality: 'NL', position: 'FWD', basePrice: 33 },
  { name: 'Rasmus Højlund', club: 'Manchester United', nationality: 'DK', position: 'FWD', basePrice: 32 },
  { name: 'Nico Williams', club: 'Athletic Bilbao', nationality: 'ES', position: 'FWD', basePrice: 32 },
  { name: 'Nicolas Jackson', club: 'Chelsea', nationality: 'SN', position: 'FWD', basePrice: 30 },
  { name: 'Jack Grealish', club: 'Manchester City', nationality: 'GB', position: 'FWD', basePrice: 30 },
  { name: 'Álvaro Morata', club: 'AC Milan', nationality: 'ES', position: 'FWD', basePrice: 30 },
  { name: 'Gonçalo Ramos', club: 'Paris Saint-Germain', nationality: 'PT', position: 'FWD', basePrice: 30 },
  { name: 'Karim Adeyemi', club: 'Borussia Dortmund', nationality: 'DE', position: 'FWD', basePrice: 28 },
  { name: 'Raheem Sterling', club: 'Chelsea', nationality: 'GB', position: 'FWD', basePrice: 28 },
  { name: 'Dejan Kulusevski', club: 'Tottenham', nationality: 'SE', position: 'FWD', basePrice: 28 },
  { name: 'Jadon Sancho', club: 'Chelsea', nationality: 'GB', position: 'FWD', basePrice: 28 },
  { name: 'Donyell Malen', club: 'Borussia Dortmund', nationality: 'NL', position: 'FWD', basePrice: 26 },
  { name: 'Aleksander Mitrović', club: 'Al Hilal', nationality: 'RS', position: 'FWD', basePrice: 25 },
  { name: 'Olivier Giroud', club: 'Los Angeles FC', nationality: 'FR', position: 'FWD', basePrice: 24 },
  { name: 'Richarlison', club: 'Tottenham', nationality: 'BR', position: 'FWD', basePrice: 24 },
  { name: 'Hugo Ekitiké', club: 'Eintracht Frankfurt', nationality: 'FR', position: 'FWD', basePrice: 24 },
  { name: 'Takefusa Kubo', club: 'Real Sociedad', nationality: 'JP', position: 'FWD', basePrice: 22 },
  { name: 'Leon Bailey', club: 'Aston Villa', nationality: 'JM', position: 'FWD', basePrice: 22 },
  { name: 'Kaoru Mitoma', club: 'Brighton', nationality: 'JP', position: 'FWD', basePrice: 34 },
  { name: 'João Pedro', club: 'Brighton', nationality: 'BR', position: 'FWD', basePrice: 32 },
  { name: 'Diogo Jota', club: 'Liverpool', nationality: 'PT', position: 'FWD', basePrice: 38 },
  { name: 'Jérémy Doku', club: 'Manchester City', nationality: 'BE', position: 'FWD', basePrice: 34 },
  { name: 'Evan Ferguson', club: 'Brighton', nationality: 'IE', position: 'FWD', basePrice: 28 },
  { name: 'Pedro Neto', club: 'Chelsea', nationality: 'PT', position: 'FWD', basePrice: 30 },
  { name: 'Mason Greenwood', club: 'Marseille', nationality: 'GB', position: 'FWD', basePrice: 30 },
  { name: 'Endrick', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 28 },
  { name: 'Khadija Shaw', club: 'Manchester City', nationality: 'JM', position: 'FWD', basePrice: 28 },
  { name: 'Bradley Barcola', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 34 },
  { name: 'Randal Kolo Muani', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 30 },
])

const WC_PLAYERS: PlayerTemplate[] = [
  ...WC_GK,
  ...WC_DEF,
  ...WC_MID,
  ...WC_FWD,
]

// ─── UEFA Champions League 2026/27 (~280 players) ──────

const UCL_GK = section([
  { name: 'Thibaut Courtois', club: 'Real Madrid', nationality: 'BE', position: 'GK', basePrice: 72 },
  { name: 'Alisson Becker', club: 'Liverpool', nationality: 'BR', position: 'GK', basePrice: 66 },
  { name: 'Ederson', club: 'Manchester City', nationality: 'BR', position: 'GK', basePrice: 60 },
  { name: 'Mike Maignan', club: 'AC Milan', nationality: 'FR', position: 'GK', basePrice: 58 },
  { name: 'Gianluigi Donnarumma', club: 'Paris Saint-Germain', nationality: 'IT', position: 'GK', basePrice: 56 },
  { name: 'Marc-André ter Stegen', club: 'Barcelona', nationality: 'DE', position: 'GK', basePrice: 54 },
  { name: 'Jan Oblak', club: 'Atlético Madrid', nationality: 'SI', position: 'GK', basePrice: 52 },
  { name: 'Manuel Neuer', club: 'Bayern Munich', nationality: 'DE', position: 'GK', basePrice: 50 },
  { name: 'David Raya', club: 'Arsenal', nationality: 'ES', position: 'GK', basePrice: 46 },
  { name: 'Gregor Kobel', club: 'Borussia Dortmund', nationality: 'CH', position: 'GK', basePrice: 42 },
  { name: 'Diogo Costa', club: 'FC Porto', nationality: 'PT', position: 'GK', basePrice: 40 },
  { name: 'André Onana', club: 'Manchester United', nationality: 'CM', position: 'GK', basePrice: 38 },
  { name: 'Unai Simón', club: 'Athletic Bilbao', nationality: 'ES', position: 'GK', basePrice: 36 },
  { name: 'Giorgi Mamardashvili', club: 'Valencia', nationality: 'GE', position: 'GK', basePrice: 34 },
  { name: 'Yann Sommer', club: 'Inter Milan', nationality: 'CH', position: 'GK', basePrice: 32 },
  { name: 'Lukáš Hrádecký', club: 'Bayer Leverkusen', nationality: 'FI', position: 'GK', basePrice: 30 },
  { name: 'Kepa Arrizabalaga', club: 'Bournemouth', nationality: 'ES', position: 'GK', basePrice: 26 },
  { name: 'Alex Meret', club: 'Napoli', nationality: 'IT', position: 'GK', basePrice: 24 },
  { name: 'Rui Patrício', club: 'Roma', nationality: 'PT', position: 'GK', basePrice: 22 },
  { name: 'Bart Verbruggen', club: 'Brighton', nationality: 'NL', position: 'GK', basePrice: 22 },
  { name: 'Péter Gulácsi', club: 'RB Leipzig', nationality: 'HU', position: 'GK', basePrice: 20 },
  { name: 'Marco Sportiello', club: 'AC Milan', nationality: 'IT', position: 'GK', basePrice: 18 },
  { name: 'Alexander Nübel', club: 'Stuttgart', nationality: 'DE', position: 'GK', basePrice: 16 },
  { name: 'Mile Svilar', club: 'Roma', nationality: 'RS', position: 'GK', basePrice: 14 },
  { name: 'Lucas Chevalier', club: 'Lille', nationality: 'FR', position: 'GK', basePrice: 34 },
  { name: 'Marco Carnesecchi', club: 'Atalanta', nationality: 'IT', position: 'GK', basePrice: 32 },
  { name: 'Dominik Livaković', club: 'Fenerbahçe', nationality: 'HR', position: 'GK', basePrice: 30 },
  { name: 'Ivan Provedel', club: 'Lazio', nationality: 'IT', position: 'GK', basePrice: 28 },
  { name: 'Wojciech Szczęsny', club: 'Barcelona', nationality: 'PL', position: 'GK', basePrice: 36 },
  { name: 'Guglielmo Vicario', club: 'Tottenham', nationality: 'IT', position: 'GK', basePrice: 32 },
  { name: 'Caoimhín Kelleher', club: 'Liverpool', nationality: 'IE', position: 'GK', basePrice: 28 },
  { name: 'Michał Míškovský', club: 'Slavia Prague', nationality: 'CZ', position: 'GK', basePrice: 22 },
  { name: 'Matvey Safonov', club: 'Paris Saint-Germain', nationality: 'RU', position: 'GK', basePrice: 26 },
  { name: 'Yassine Bounou', club: 'Al Hilal', nationality: 'MA', position: 'GK', basePrice: 30 },
  { name: 'Koen Casteels', club: 'Al Qadsiah', nationality: 'BE', position: 'GK', basePrice: 26 },
  { name: 'Jordan Pickford', club: 'Everton', nationality: 'GB', position: 'GK', basePrice: 34 },
  { name: 'Mark Flekken', club: 'Brentford', nationality: 'NL', position: 'GK', basePrice: 28 },
  { name: 'Alex Meret', club: 'Napoli', nationality: 'IT', position: 'GK', basePrice: 26 },
  { name: 'Mathew Ryan', club: 'AZ Alkmaar', nationality: 'AU', position: 'GK', basePrice: 16 },
  { name: 'Anatoliy Trubin', club: 'Benfica', nationality: 'UA', position: 'GK', basePrice: 38 },
  { name: 'Kevin Trapp', club: 'Eintracht Frankfurt', nationality: 'DE', position: 'GK', basePrice: 34 },
  { name: 'Robin Zentner', club: 'Mainz', nationality: 'DE', position: 'GK', basePrice: 32 },
  { name: 'Jesper Lindstrøm', club: 'Napoli', nationality: 'DK', position: 'GK', basePrice: 28 },
])

const UCL_DEF = section([
  { name: 'Virgil van Dijk', club: 'Liverpool', nationality: 'NL', position: 'DEF', basePrice: 52 },
  { name: 'Rúben Dias', club: 'Manchester City', nationality: 'PT', position: 'DEF', basePrice: 50 },
  { name: 'William Saliba', club: 'Arsenal', nationality: 'FR', position: 'DEF', basePrice: 46 },
  { name: 'Antonio Rüdiger', club: 'Real Madrid', nationality: 'DE', position: 'DEF', basePrice: 45 },
  { name: 'Jules Koundé', club: 'Barcelona', nationality: 'FR', position: 'DEF', basePrice: 42 },
  { name: 'Daniel Carvajal', club: 'Real Madrid', nationality: 'ES', position: 'DEF', basePrice: 40 },
  { name: 'Josko Gvardiol', club: 'Manchester City', nationality: 'HR', position: 'DEF', basePrice: 44 },
  { name: 'Dayot Upamecano', club: 'Bayern Munich', nationality: 'FR', position: 'DEF', basePrice: 40 },
  { name: 'John Stones', club: 'Manchester City', nationality: 'GB', position: 'DEF', basePrice: 38 },
  { name: 'Ronald Araújo', club: 'Barcelona', nationality: 'UY', position: 'DEF', basePrice: 39 },
  { name: 'Trent Alexander-Arnold', club: 'Liverpool', nationality: 'GB', position: 'DEF', basePrice: 44 },
  { name: 'Marcos Marquinhos', club: 'Paris Saint-Germain', nationality: 'BR', position: 'DEF', basePrice: 52 },
  { name: 'Lisandro Martínez', club: 'Manchester United', nationality: 'AR', position: 'DEF', basePrice: 50 },
  { name: 'Matthijs de Ligt', club: 'Manchester United', nationality: 'NL', position: 'DEF', basePrice: 48 },
  { name: 'Andrew Robertson', club: 'Liverpool', nationality: 'GB', position: 'DEF', basePrice: 48 },
  { name: 'Ibrahima Konaté', club: 'Liverpool', nationality: 'FR', position: 'DEF', basePrice: 46 },
  { name: 'Kieran Trippier', club: 'Newcastle', nationality: 'GB', position: 'DEF', basePrice: 46 },
  { name: 'Ben White', club: 'Arsenal', nationality: 'GB', position: 'DEF', basePrice: 44 },
  { name: 'Pau Cubarsí', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 44 },
  { name: 'Levi Colwill', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 44 },
  { name: 'Jeremie Frimpong', club: 'Bayer Leverkusen', nationality: 'NL', position: 'DEF', basePrice: 48 },
  { name: 'Malo Gusto', club: 'Chelsea', nationality: 'FR', position: 'DEF', basePrice: 42 },
  { name: 'Pedro Porro', club: 'Tottenham', nationality: 'ES', position: 'DEF', basePrice: 42 },
  { name: 'Alex Grimaldo', club: 'Bayer Leverkusen', nationality: 'ES', position: 'DEF', basePrice: 44 },
  { name: 'Federico Dimarco', club: 'Inter Milan', nationality: 'IT', position: 'DEF', basePrice: 40 },
  { name: 'Alessandro Bastoni', club: 'Inter Milan', nationality: 'IT', position: 'DEF', basePrice: 42 },
  { name: 'Destiny Udogie', club: 'Tottenham', nationality: 'IT', position: 'DEF', basePrice: 40 },
  { name: 'Nico Schlotterbeck', club: 'Borussia Dortmund', nationality: 'DE', position: 'DEF', basePrice: 32 },
  { name: 'José María Giménez', club: 'Atlético Madrid', nationality: 'UY', position: 'DEF', basePrice: 38 },
  { name: 'Nuno Mendes', club: 'Paris Saint-Germain', nationality: 'PT', position: 'DEF', basePrice: 40 },
  { name: 'Kyle Walker', club: 'Manchester City', nationality: 'GB', position: 'DEF', basePrice: 34 },
  { name: 'Alphonso Davies', club: 'Bayern Munich', nationality: 'CA', position: 'DEF', basePrice: 40 },
  { name: 'Gabriel Magalhães', club: 'Arsenal', nationality: 'BR', position: 'DEF', basePrice: 36 },
  { name: 'Eder Militão', club: 'Real Madrid', nationality: 'BR', position: 'DEF', basePrice: 38 },
  { name: 'Bremer', club: 'Juventus', nationality: 'BR', position: 'DEF', basePrice: 32 },
  { name: 'Jurriën Timber', club: 'Arsenal', nationality: 'NL', position: 'DEF', basePrice: 28 },
  { name: 'Lucas Hernández', club: 'Paris Saint-Germain', nationality: 'FR', position: 'DEF', basePrice: 32 },
  { name: 'Jonathan Tah', club: 'Bayer Leverkusen', nationality: 'DE', position: 'DEF', basePrice: 30 },
  { name: 'Benjamin Pavard', club: 'Inter Milan', nationality: 'FR', position: 'DEF', basePrice: 30 },
  { name: 'Reece James', club: 'Chelsea', nationality: 'GB', position: 'DEF', basePrice: 26 },
  { name: 'Leny Yoro', club: 'Manchester United', nationality: 'FR', position: 'DEF', basePrice: 28 },
  { name: 'Ben White', club: 'Arsenal', nationality: 'GB', position: 'DEF', basePrice: 28 },
  { name: 'Micky van de Ven', club: 'Tottenham', nationality: 'NL', position: 'DEF', basePrice: 32 },
  { name: 'Danilo', club: 'Juventus', nationality: 'BR', position: 'DEF', basePrice: 26 },
  { name: 'Federico Gatti', club: 'Juventus', nationality: 'IT', position: 'DEF', basePrice: 22 },
  { name: 'Edmond Tapsoba', club: 'Bayer Leverkusen', nationality: 'BF', position: 'DEF', basePrice: 28 },
  { name: 'Milan Škriniar', club: 'Paris Saint-Germain', nationality: 'SK', position: 'DEF', basePrice: 30 },
  { name: 'Diogo Dalot', club: 'Manchester United', nationality: 'PT', position: 'DEF', basePrice: 24 },
  { name: 'Wesley Fofana', club: 'Chelsea', nationality: 'FR', position: 'DEF', basePrice: 24 },
  { name: 'Benoît Badiashile', club: 'Chelsea', nationality: 'FR', position: 'DEF', basePrice: 24 },
  { name: 'Raphaël Varane', club: 'Como', nationality: 'FR', position: 'DEF', basePrice: 26 },
  { name: 'Sergio Ramos', club: 'Sevilla', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Jordi Alba', club: 'Inter Miami', nationality: 'ES', position: 'DEF', basePrice: 22 },
  { name: 'Mats Hummels', club: 'Roma', nationality: 'DE', position: 'DEF', basePrice: 20 },
  { name: 'Konrad Laimer', club: 'Bayern Munich', nationality: 'AT', position: 'DEF', basePrice: 22 },
  { name: 'Inigo Martínez', club: 'Barcelona', nationality: 'ES', position: 'DEF', basePrice: 24 },
  { name: 'Raphaël Guerreiro', club: 'Bayern Munich', nationality: 'PT', position: 'DEF', basePrice: 20 },
  { name: 'Sven Botman', club: 'Newcastle', nationality: 'NL', position: 'DEF', basePrice: 28 },
  { name: 'Fabian Schär', club: 'Newcastle', nationality: 'CH', position: 'DEF', basePrice: 24 },
  { name: 'Nahuel Molina', club: 'Atlético Madrid', nationality: 'AR', position: 'DEF', basePrice: 28 },
  { name: 'Jorrel Hato', club: 'Ajax', nationality: 'NL', position: 'DEF', basePrice: 22 },
  { name: 'David Hancko', club: 'Feyenoord', nationality: 'SK', position: 'DEF', basePrice: 18 },
  { name: 'Stefan de Vrij', club: 'Inter Milan', nationality: 'NL', position: 'DEF', basePrice: 20 },
  { name: 'Gleison Bremer', club: 'Juventus', nationality: 'BR', position: 'DEF', basePrice: 46 },
  { name: 'Willi Orbán', club: 'RB Leipzig', nationality: 'HU', position: 'DEF', basePrice: 44 },
  { name: 'Niklas Süle', club: 'Borussia Dortmund', nationality: 'DE', position: 'DEF', basePrice: 42 },
  { name: 'Piero Hincapié', club: 'Bayer Leverkusen', nationality: 'EC', position: 'DEF', basePrice: 40 },
  { name: 'Waldemar Anton', club: 'Borussia Dortmund', nationality: 'DE', position: 'DEF', basePrice: 38 },
  { name: 'Noussair Mazraoui', club: 'Manchester United', nationality: 'MA', position: 'DEF', basePrice: 46 },
  { name: 'Joško Gvardiol', club: 'Manchester City', nationality: 'HR', position: 'DEF', basePrice: 48 },
  { name: 'Jan Paul van Hecke', club: 'Brighton', nationality: 'NL', position: 'DEF', basePrice: 44 },
  { name: 'Jarrad Branthwaite', club: 'Everton', nationality: 'GB', position: 'DEF', basePrice: 48 },
  { name: 'Nico Tagliafico', club: 'Lyon', nationality: 'AR', position: 'DEF', basePrice: 24 },
  { name: 'Cristian Romero', club: 'Tottenham', nationality: 'AR', position: 'DEF', basePrice: 36 },
  { name: 'Aymeric Laporte', club: 'Al Nassr', nationality: 'ES', position: 'DEF', basePrice: 38 },
  { name: 'Chris Richards', club: 'Crystal Palace', nationality: 'US', position: 'DEF', basePrice: 40 },
])

const UCL_MID = section([
  { name: 'Jude Bellingham', club: 'Real Madrid', nationality: 'GB', position: 'MID', basePrice: 85, isEligibleForIcon: true },
  { name: 'Rodri', club: 'Manchester City', nationality: 'ES', position: 'MID', basePrice: 75 },
  { name: 'Kevin De Bruyne', club: 'Manchester City', nationality: 'BE', position: 'MID', basePrice: 60 },
  { name: 'Declan Rice', club: 'Arsenal', nationality: 'GB', position: 'MID', basePrice: 58 },
  { name: 'Jamal Musiala', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 70 },
  { name: 'Florian Wirtz', club: 'Bayer Leverkusen', nationality: 'DE', position: 'MID', basePrice: 62 },
  { name: 'Federico Valverde', club: 'Real Madrid', nationality: 'UY', position: 'MID', basePrice: 56 },
  { name: 'Eduardo Camavinga', club: 'Real Madrid', nationality: 'FR', position: 'MID', basePrice: 50 },
  { name: 'Aurélien Tchouaméni', club: 'Real Madrid', nationality: 'FR', position: 'MID', basePrice: 48 },
  { name: 'Pedri', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 54 },
  { name: 'Gavi', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 50 },
  { name: 'Frenkie de Jong', club: 'Barcelona', nationality: 'NL', position: 'MID', basePrice: 42 },
  { name: 'Ilkay Gündogan', club: 'Manchester City', nationality: 'DE', position: 'MID', basePrice: 44 },
  { name: 'Phil Foden', club: 'Manchester City', nationality: 'GB', position: 'MID', basePrice: 58 },
  { name: 'Bruno Fernandes', club: 'Manchester United', nationality: 'PT', position: 'MID', basePrice: 46 },
  { name: 'Kobbie Mainoo', club: 'Manchester United', nationality: 'GB', position: 'MID', basePrice: 36 },
  { name: 'Cole Palmer', club: 'Chelsea', nationality: 'GB', position: 'MID', basePrice: 52 },
  { name: 'Enzo Fernández', club: 'Chelsea', nationality: 'AR', position: 'MID', basePrice: 42 },
  { name: 'Moises Caicedo', club: 'Chelsea', nationality: 'EC', position: 'MID', basePrice: 38 },
  { name: 'Alexis Mac Allister', club: 'Liverpool', nationality: 'AR', position: 'MID', basePrice: 40 },
  { name: 'Dominik Szoboszlai', club: 'Liverpool', nationality: 'HU', position: 'MID', basePrice: 38 },
  { name: 'Ryan Gravenberch', club: 'Liverpool', nationality: 'NL', position: 'MID', basePrice: 32 },
  { name: 'Bernardo Silva', club: 'Manchester City', nationality: 'PT', position: 'MID', basePrice: 46 },
  { name: 'Martin Ødegaard', club: 'Arsenal', nationality: 'NO', position: 'MID', basePrice: 52 },
  { name: 'James Maddison', club: 'Tottenham', nationality: 'GB', position: 'MID', basePrice: 36 },
  { name: 'Joshua Kimmich', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 40 },
  { name: 'Leon Goretzka', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 32 },
  { name: 'Warren Zaïre-Emery', club: 'Paris Saint-Germain', nationality: 'FR', position: 'MID', basePrice: 34 },
  { name: 'Vitinha', club: 'Paris Saint-Germain', nationality: 'PT', position: 'MID', basePrice: 32 },
  { name: 'Nicolo Barella', club: 'Inter Milan', nationality: 'IT', position: 'MID', basePrice: 36 },
  { name: 'Hakan Çalhanoğlu', club: 'Inter Milan', nationality: 'TR', position: 'MID', basePrice: 34 },
  { name: 'Dani Olmo', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 36 },
  { name: 'Fermín López', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 28 },
  { name: 'Alejandro Garnacho', club: 'Manchester United', nationality: 'AR', position: 'MID', basePrice: 34 },
  { name: 'Mason Mount', club: 'Manchester United', nationality: 'GB', position: 'MID', basePrice: 26 },
  { name: 'Conor Gallagher', club: 'Atlético Madrid', nationality: 'GB', position: 'MID', basePrice: 22 },
  { name: 'Rodrigo De Paul', club: 'Atlético Madrid', nationality: 'AR', position: 'MID', basePrice: 30 },
  { name: 'Granit Xhaka', club: 'Bayer Leverkusen', nationality: 'CH', position: 'MID', basePrice: 26 },
  { name: 'Exequiel Palacios', club: 'Bayer Leverkusen', nationality: 'AR', position: 'MID', basePrice: 26 },
  { name: 'Julian Brandt', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 28 },
  { name: 'Marcel Sabitzer', club: 'Borussia Dortmund', nationality: 'AT', position: 'MID', basePrice: 24 },
  { name: 'Tijjani Reijnders', club: 'AC Milan', nationality: 'NL', position: 'MID', basePrice: 28 },
  { name: 'Christian Pulisic', club: 'AC Milan', nationality: 'US', position: 'MID', basePrice: 30 },
  { name: 'Ismaël Bennacer', club: 'AC Milan', nationality: 'DZ', position: 'MID', basePrice: 26 },
  { name: 'Luka Modrić', club: 'Real Madrid', nationality: 'HR', position: 'MID', basePrice: 32 },
  { name: 'Toni Kroos', club: 'Real Madrid', nationality: 'DE', position: 'MID', basePrice: 32 },
  { name: 'Romeo Lavia', club: 'Chelsea', nationality: 'BE', position: 'MID', basePrice: 26 },
  { name: 'Harvey Elliott', club: 'Brighton', nationality: 'GB', position: 'MID', basePrice: 26 },
  { name: 'Curtis Jones', club: 'Liverpool', nationality: 'GB', position: 'MID', basePrice: 28 },
  { name: 'Pape Matar Sarr', club: 'Tottenham', nationality: 'SN', position: 'MID', basePrice: 28 },
  { name: 'Yves Bissouma', club: 'Tottenham', nationality: 'ML', position: 'MID', basePrice: 26 },
  { name: 'Aleksandar Pavlović', club: 'Bayern Munich', nationality: 'DE', position: 'MID', basePrice: 30 },
  { name: 'João Palhinha', club: 'Bayern Munich', nationality: 'PT', position: 'MID', basePrice: 32 },
  { name: 'Pascal Groß', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 28 },
  { name: 'Felix Nmecha', club: 'Borussia Dortmund', nationality: 'DE', position: 'MID', basePrice: 24 },
  { name: 'Dani Ceballos', club: 'Real Madrid', nationality: 'ES', position: 'MID', basePrice: 22 },
  { name: 'Sergio Busquets', club: 'Inter Miami', nationality: 'ES', position: 'MID', basePrice: 22 },
  { name: 'Dan Ndoye', club: 'Bologna', nationality: 'CH', position: 'MID', basePrice: 16 },
  { name: 'Davy Klaassen', club: 'Inter Milan', nationality: 'NL', position: 'MID', basePrice: 16 },
  { name: 'Henrikh Mkhitaryan', club: 'Inter Milan', nationality: 'AM', position: 'MID', basePrice: 24 },
  { name: 'Thomas Lemar', club: 'Atlético Madrid', nationality: 'FR', position: 'MID', basePrice: 20 },
])

const UCL_FWD = section([
  { name: 'Kylian Mbappé', club: 'Real Madrid', nationality: 'FR', position: 'FWD', basePrice: 92, isEligibleForIcon: true },
  { name: 'Erling Haaland', club: 'Manchester City', nationality: 'NO', position: 'FWD', basePrice: 95, isEligibleForIcon: true },
  { name: 'Vinícius Jr.', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 80, isEligibleForIcon: true },
  { name: 'Harry Kane', club: 'Bayern Munich', nationality: 'GB', position: 'FWD', basePrice: 82, isEligibleForIcon: true },
  { name: 'Lamine Yamal', club: 'Barcelona', nationality: 'ES', position: 'FWD', basePrice: 78, isEligibleForIcon: true },
  { name: 'Bukayo Saka', club: 'Arsenal', nationality: 'GB', position: 'FWD', basePrice: 66 },
  { name: 'Mohamed Salah', club: 'Liverpool', nationality: 'EG', position: 'FWD', basePrice: 62 },
  { name: 'Rodrygo', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 56 },
  { name: 'Lautaro Martínez', club: 'Inter Milan', nationality: 'AR', position: 'FWD', basePrice: 54 },
  { name: 'Ousmane Dembélé', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 52 },
  { name: 'Antoine Griezmann', club: 'Atlético Madrid', nationality: 'FR', position: 'FWD', basePrice: 50 },
  { name: 'Raphinha', club: 'Barcelona', nationality: 'BR', position: 'FWD', basePrice: 48 },
  { name: 'Victor Osimhen', club: 'Galatasaray', nationality: 'NG', position: 'FWD', basePrice: 46 },
  { name: 'Gabriel Martinelli', club: 'Arsenal', nationality: 'BR', position: 'FWD', basePrice: 44 },
  { name: 'Julian Álvarez', club: 'Atlético Madrid', nationality: 'AR', position: 'FWD', basePrice: 42 },
  { name: 'Kingsley Coman', club: 'Bayern Munich', nationality: 'FR', position: 'FWD', basePrice: 42 },
  { name: 'Leroy Sané', club: 'Bayern Munich', nationality: 'DE', position: 'FWD', basePrice: 42 },
  { name: 'Diogo Jota', club: 'Liverpool', nationality: 'PT', position: 'FWD', basePrice: 40 },
  { name: 'Khvicha Kvaratskhelia', club: 'Napoli', nationality: 'GE', position: 'FWD', basePrice: 40 },
  { name: 'Marcus Rashford', club: 'Manchester United', nationality: 'GB', position: 'FWD', basePrice: 38 },
  { name: 'Luis Díaz', club: 'Liverpool', nationality: 'CO', position: 'FWD', basePrice: 38 },
  { name: 'Christopher Nkunku', club: 'Chelsea', nationality: 'FR', position: 'FWD', basePrice: 36 },
  { name: 'Darwin Núñez', club: 'Liverpool', nationality: 'UY', position: 'FWD', basePrice: 36 },
  { name: 'Jérémy Doku', club: 'Manchester City', nationality: 'BE', position: 'FWD', basePrice: 36 },
  { name: 'Cody Gakpo', club: 'Liverpool', nationality: 'NL', position: 'FWD', basePrice: 34 },
  { name: 'Nico Williams', club: 'Athletic Bilbao', nationality: 'ES', position: 'FWD', basePrice: 34 },
  { name: 'Bradley Barcola', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 34 },
  { name: 'Michael Olise', club: 'Bayern Munich', nationality: 'FR', position: 'FWD', basePrice: 34 },
  { name: 'Kaoru Mitoma', club: 'Brighton', nationality: 'JP', position: 'FWD', basePrice: 36 },
  { name: 'João Pedro', club: 'Brighton', nationality: 'BR', position: 'FWD', basePrice: 34 },
  { name: 'Nicolas Jackson', club: 'Chelsea', nationality: 'SN', position: 'FWD', basePrice: 32 },
  { name: 'Jack Grealish', club: 'Manchester City', nationality: 'GB', position: 'FWD', basePrice: 32 },
  { name: 'Álvaro Morata', club: 'AC Milan', nationality: 'ES', position: 'FWD', basePrice: 32 },
  { name: 'Gonçalo Ramos', club: 'Paris Saint-Germain', nationality: 'PT', position: 'FWD', basePrice: 32 },
  { name: 'Mason Greenwood', club: 'Marseille', nationality: 'GB', position: 'FWD', basePrice: 32 },
  { name: 'Randal Kolo Muani', club: 'Paris Saint-Germain', nationality: 'FR', position: 'FWD', basePrice: 30 },
  { name: 'Evan Ferguson', club: 'Brighton', nationality: 'IE', position: 'FWD', basePrice: 30 },
  { name: 'Dejan Kulusevski', club: 'Tottenham', nationality: 'SE', position: 'FWD', basePrice: 30 },
  { name: 'Jadon Sancho', club: 'Chelsea', nationality: 'GB', position: 'FWD', basePrice: 30 },
  { name: 'Pedro Neto', club: 'Chelsea', nationality: 'PT', position: 'FWD', basePrice: 30 },
  { name: 'Karim Adeyemi', club: 'Borussia Dortmund', nationality: 'DE', position: 'FWD', basePrice: 28 },
  { name: 'Raheem Sterling', club: 'Chelsea', nationality: 'GB', position: 'FWD', basePrice: 28 },
  { name: 'Endrick', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 28 },
  { name: 'Donyell Malen', club: 'Borussia Dortmund', nationality: 'NL', position: 'FWD', basePrice: 28 },
  { name: 'Mykhailo Mudryk', club: 'Chelsea', nationality: 'UA', position: 'FWD', basePrice: 28 },
  { name: 'Mathys Tel', club: 'Bayern Munich', nationality: 'FR', position: 'FWD', basePrice: 26 },
  { name: 'Hugo Ekitiké', club: 'Eintracht Frankfurt', nationality: 'FR', position: 'FWD', basePrice: 26 },
  { name: 'Richarlison', club: 'Tottenham', nationality: 'BR', position: 'FWD', basePrice: 24 },
  { name: 'Brennan Johnson', club: 'Tottenham', nationality: 'GB', position: 'FWD', basePrice: 20 },
  { name: 'Samuel Chukwueze', club: 'AC Milan', nationality: 'NG', position: 'FWD', basePrice: 24 },
  { name: 'Noah Okafor', club: 'AC Milan', nationality: 'CH', position: 'FWD', basePrice: 20 },
  { name: 'Simon Adingra', club: 'Brighton', nationality: 'CI', position: 'FWD', basePrice: 28 },
  { name: 'Federico Chiesa', club: 'Liverpool', nationality: 'IT', position: 'FWD', basePrice: 30 },
  { name: 'Serge Gnabry', club: 'Bayern Munich', nationality: 'DE', position: 'FWD', basePrice: 34 },
  { name: 'Samuel Omorodion', club: 'Porto', nationality: 'ES', position: 'FWD', basePrice: 18 },
  { name: 'Jamie Bynoe-Gittens', club: 'Borussia Dortmund', nationality: 'GB', position: 'FWD', basePrice: 20 },
  { name: 'Facundo Pellistri', club: 'Panathinaikos', nationality: 'UY', position: 'FWD', basePrice: 20 },
  { name: 'Antony', club: 'Manchester United', nationality: 'BR', position: 'FWD', basePrice: 22 },
  { name: 'Amad Diallo', club: 'Manchester United', nationality: 'CI', position: 'FWD', basePrice: 24 },
  { name: 'Mikkel Damsgaard', club: 'Brentford', nationality: 'DK', position: 'FWD', basePrice: 50 },
  { name: 'Ansu Fati', club: 'Barcelona', nationality: 'ES', position: 'FWD', basePrice: 48 },
  { name: 'Fábio Carvalho', club: 'Brentford', nationality: 'PT', position: 'FWD', basePrice: 46 },
  { name: 'Amad Diallo', club: 'Manchester United', nationality: 'CI', position: 'FWD', basePrice: 46 },
])

const UCL_PLAYERS: PlayerTemplate[] = [
  ...UCL_GK,
  ...UCL_DEF,
  ...UCL_MID,
  ...UCL_FWD,
]

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

const UEL_PLAYERS: PlayerTemplate[] = [
  ...UEL_GK, ...UEL_DEF, ...UEL_MID, ...UEL_FWD,
]

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

const AFCON_PLAYERS: PlayerTemplate[] = [
  ...AFCON_GK, ...AFCON_DEF, ...AFCON_MID, ...AFCON_FWD,
]

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
  { name: 'Alexia Putellas', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 42, isEligibleForIcon: true },
  { name: 'Aitana Bonmati', club: 'Barcelona', nationality: 'ES', position: 'MID', basePrice: 40, isEligibleForIcon: true },
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

const WWC_PLAYERS: PlayerTemplate[] = [
  ...WWC_GK, ...WWC_DEF, ...WWC_MID, ...WWC_FWD,
]

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
  { name: 'Lionel Messi', club: 'Inter Miami', nationality: 'AR', position: 'FWD', basePrice: 78, isEligibleForIcon: true },
  { name: 'Vinicius Jr.', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 75, isEligibleForIcon: true },
  { name: 'Lautaro Martinez', club: 'Inter Milan', nationality: 'AR', position: 'FWD', basePrice: 52 },
  { name: 'Julian Alvarez', club: 'Atletico Madrid', nationality: 'AR', position: 'FWD', basePrice: 40 },
  { name: 'Rodrygo', club: 'Real Madrid', nationality: 'BR', position: 'FWD', basePrice: 54 },
  { name: 'Raphinha', club: 'Barcelona', nationality: 'BR', position: 'FWD', basePrice: 46 },
  { name: 'Gabriel Martinelli', club: 'Arsenal', nationality: 'BR', position: 'FWD', basePrice: 42 },
  { name: 'Darwin Nunez', club: 'Liverpool', nationality: 'UY', position: 'FWD', basePrice: 36 },
  { name: 'Alexis Sanchez', club: 'Udinese', nationality: 'CL', position: 'FWD', basePrice: 24 },
  { name: 'Eduardo Vargas', club: 'Nacional', nationality: 'CL', position: 'FWD', basePrice: 20 },
])

const COPA_PLAYERS: PlayerTemplate[] = [
  ...COPA_GK, ...COPA_DEF, ...COPA_MID, ...COPA_FWD,
]

// ─── Target sizes (real tournament data) ────────────────
// FIFA World Cup 2026: 48 teams x 26 players = 1,248
// UEFA Champions League 2026/27: 32 teams x 25 (List A) = 800
// UEFA Europa League 2026/27: 36 teams x 25 (List A) = 900
// CAF Africa Cup of Nations 2027: 24 teams x 27 players = 648
// FIFA Women's World Cup 2027: 32 teams x 26 players = 832
// Copa America 2028: 16 teams x 26 players = 416

const WC_TARGET = 1248
const UCL_TARGET = 800
const UEL_TARGET = 900
const AFCON_TARGET = 648
const WWC_TARGET = 832
const COPA_TARGET = 416

// ─── Main ───────────────────────────────────────────────

function main() {
  const wcBase = WC_PLAYERS
  const uclBase = UCL_PLAYERS
  const uelBase = UEL_PLAYERS
  const afconBase = AFCON_PLAYERS
  const wwcBase = WWC_PLAYERS
  const copaBase = COPA_PLAYERS

  // Generate filler players to reach target counts
  const wcFillers = generateFillerPlayers(wcBase, WC_TARGET, WC_NATIONALITIES, WC_CLUBS)
  const uclFillers = generateFillerPlayers(uclBase, UCL_TARGET, UCL_NATIONALITIES, UCL_CLUBS)
  const uelFillers = generateFillerPlayers(uelBase, UEL_TARGET, UEL_NATIONALITIES, UEL_CLUBS)
  const afconFillers = generateFillerPlayers(afconBase, AFCON_TARGET, AFCON_NATIONALITIES, AFCON_CLUBS)
  const wwcFillers = generateFillerPlayers(wwcBase, WWC_TARGET, WWC_NATIONALITIES, WWC_CLUBS, true)
  const copaFillers = generateFillerPlayers(copaBase, COPA_TARGET, COPA_NATIONALITIES, COPA_CLUBS)

  const wcPlayers = [...wcBase, ...wcFillers]
  const uclPlayers = [...uclBase, ...uclFillers]
  const uelPlayers = [...uelBase, ...uelFillers]
  const afconPlayers = [...afconBase, ...afconFillers]
  const wwcPlayers = [...wwcBase, ...wwcFillers]
  const copaPlayers = [...copaBase, ...copaFillers]

  const allPlayers: any[] = []
  let idCounter = 1

  const tournaments = [
    { id: 'fifa-wc-2026', players: wcPlayers, base: wcBase, fillers: wcFillers, target: WC_TARGET, label: 'FIFA WC 2026' },
    { id: 'uefa-ucl-2026-27', players: uclPlayers, base: uclBase, fillers: uclFillers, target: UCL_TARGET, label: 'UCL 2026/27' },
    { id: 'uefa-uel-2026-27', players: uelPlayers, base: uelBase, fillers: uelFillers, target: UEL_TARGET, label: 'UEL 2026/27' },
    { id: 'caf-afcon-2027', players: afconPlayers, base: afconBase, fillers: afconFillers, target: AFCON_TARGET, label: 'AFCON 2027' },
    { id: 'fifa-wwc-2027', players: wwcPlayers, base: wwcBase, fillers: wwcFillers, target: WWC_TARGET, label: 'WWC 2027' },
    { id: 'conmebol-copa-america-2028', players: copaPlayers, base: copaBase, fillers: copaFillers, target: COPA_TARGET, label: 'COPA 2028' },
  ]

  for (const t of tournaments) {
    for (const template of t.players) {
      allPlayers.push({
        id: `player-${idCounter++}`,
        tournamentId: t.id,
        ...template,
      })
    }
  }

  console.log(`\n=== Player Generation Summary ===`)
  console.log(`Total players: ${allPlayers.length}\n`)

  for (const t of tournaments) {
    const count = allPlayers.filter((p) => p.tournamentId === t.id).length
    const realCount = t.base.length
    const genCount = t.fillers.length
    const positions: Record<string, number> = {}
    for (const p of allPlayers) {
      if (p.tournamentId === t.id) {
        positions[p.position] = (positions[p.position] || 0) + 1
      }
    }
    console.log(`  ${t.label}: ${count} players (${realCount} real + ${genCount} generated) — target: ${t.target}`)
    console.log(`    Positions: GK=${positions.GK ?? 0}, DEF=${positions.DEF ?? 0}, MID=${positions.MID ?? 0}, FWD=${positions.FWD ?? 0}`)
  }

  const outputPath = path.join(DATA_DIR, 'players.json')
  const tmpPath = outputPath + '.tmp'
  if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(tmpPath, JSON.stringify(allPlayers, null, 2), 'utf-8')
  fs.renameSync(tmpPath, outputPath)
  console.log(`\nWritten to ${outputPath}`)
}

main()
