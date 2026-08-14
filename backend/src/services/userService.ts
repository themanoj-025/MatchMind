import { IUserRepository, UserData } from '../repositories/types'

export class UserService {
  private userRepository: IUserRepository

  constructor(deps: { userRepository: IUserRepository }) {
    this.userRepository = deps.userRepository
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    if (!username || username.length < 3) return false
    const existing = await this.userRepository.findByUsername(username)
    return !existing
  }

  async getUserProfile(userId: string): Promise<Partial<UserData> | null> {
    const user = await this.userRepository.findById(userId)
    if (!user) return null
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      countryCode: user.countryCode,
      totalPoints: user.totalPoints,
      globalRank: user.globalRank,
      predAccuracy: user.predAccuracy,
      streakCurrent: user.streakCurrent,
      tier: user.tier,
      createdAt: user.createdAt,
    }
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string
      avatar?: string | null
      bio?: string | null
      favouriteSports?: string[]
      favouriteTeams?: string[]
    }
  ): Promise<Partial<UserData>> {
    const { favouriteSports, favouriteTeams, ...updateData } = data
    
    // We filter undefined keys from updateData
    const cleanedData: Partial<UserData> = {}
    if (updateData.displayName !== undefined) cleanedData.displayName = updateData.displayName
    if (updateData.avatar !== undefined) cleanedData.avatar = updateData.avatar
    if (updateData.bio !== undefined) cleanedData.bio = updateData.bio

    const user = await this.userRepository.update(userId, cleanedData)

    if (favouriteSports !== undefined) {
      await this.userRepository.updateSports(userId, favouriteSports)
    }

    if (favouriteTeams !== undefined) {
      await this.userRepository.updateTeams(userId, favouriteTeams)
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      totalPoints: user.totalPoints,
      tier: user.tier,
    }
  }

  async followUser(followerId: string, followingId: string): Promise<unknown> {
    return this.userRepository.followUser(followerId, followingId)
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    return this.userRepository.unfollowUser(followerId, followingId)
  }

  async getNotifications(userId: string): Promise<unknown[]> {
    return this.userRepository.getNotifications(userId, 50)
  }

  async markNotificationsRead(userId: string): Promise<void> {
    return this.userRepository.markNotificationsRead(userId)
  }
}
