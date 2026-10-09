import { env } from '../config/env'
import logger from '../utils/logger'
import { z } from 'zod'

// Basic schema for a match from SportRadar
export const sportRadarMatchSchema = z.object({
  id: z.string(),
  scheduled: z.string(),
  status: z.string(),
  home_team: z.object({ id: z.string(), name: z.string(), alias: z.string() }),
  away_team: z.object({ id: z.string(), name: z.string(), alias: z.string() }),
})

export type SportRadarMatch = z.infer<typeof sportRadarMatchSchema>

export class SportRadarService {
  private readonly baseUrl = 'https://api.sportradar.com/cricket-t2/en'
  private readonly apiKey = env.SPORTRADAR_API_KEY

  /**
   * Fetches the daily schedule of matches.
   * Note: This is scaffolding. Requires a valid API Key to function.
   */
  async getDailySchedule(date: string): Promise<SportRadarMatch[]> {
    if (!this.apiKey) {
      logger.warn({ event: 'sportradar.missing_key' }, 'SportRadar API key is missing. Returning mock data.')
      return [] // Return mock or empty data if no key
    }

    try {
      const response = await fetch(`${this.baseUrl}/schedules/${date}/schedule.json?api_key=${this.apiKey}`)
      if (!response.ok) {
        throw new Error(`SportRadar API error: ${response.statusText}`)
      }
      const data = (await response.json()) as {
        sport_events?: Array<{
          id: string
          scheduled: string
          status: string
          competitors: Array<{ id: string; name: string; abbreviation: string }>
        }>
      }

      // Map/validate the data as needed
      return (
        data.sport_events
          ?.map((event) => {
            const home = event.competitors[0]
            const away = event.competitors[1]
            if (!home || !away) {
              return null
            }
            return {
              id: event.id,
              scheduled: event.scheduled,
              status: event.status,
              home_team: {
                id: home.id,
                name: home.name,
                alias: home.abbreviation,
              },
              away_team: {
                id: away.id,
                name: away.name,
                alias: away.abbreviation,
              },
            }
          })
          .filter((m): m is SportRadarMatch => m !== null) || []
      )
    } catch (error: unknown) {
      logger.error({ event: 'sportradar.fetch_failed', error }, 'Failed to fetch schedule from SportRadar')
      throw error
    }
  }
}

export const sportRadarService = new SportRadarService()
