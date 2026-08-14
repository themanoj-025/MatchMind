import express from 'express'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { updateProfileSchema } from '../config/schemas'
import type { AuthenticatedRequest } from '../middleware/auth'
import { openapiRegistry } from "../config/openapi";

const router = express.Router()

// GET /api/users/check-username

openapiRegistry.registerPath({
  method: 'get',
  path: '/check-username',
  responses: { 200: { description: 'Success' } }
})
router.get('/check-username', async (req, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const { username } = req.query as { username?: string }
      const available = await userService.checkUsernameAvailable(username)
      res.json({ available })
    })


openapiRegistry.registerPath({
  method: 'get',
  path: '/:id',
  responses: { 200: { description: 'Success' } }
})
router.get('/:id', async (req, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const user = await userService.getUserProfile(req.params.id)
      if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } })
      res.json(user)
    })


openapiRegistry.registerPath({
  method: 'patch',
  path: '/me',
  request: { body: { content: { 'application/json': { schema: updateProfileSchema } } } },
  responses: { 200: { description: 'Success' } }
})
router.patch('/me', authenticateToken, validate(updateProfileSchema), async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const { displayName, avatar, bio, favouriteSports, favouriteTeams } = req.body as {
        displayName?: string
        avatar?: string | null
        bio?: string | null
        favouriteSports?: string[]
        favouriteTeams?: string[]
      }
      
      const user = await userService.updateProfile(req.userId, {
        displayName,
        avatar,
        bio,
        favouriteSports,
        favouriteTeams,
      })

      res.json(user)
    })


openapiRegistry.registerPath({
  method: 'post',
  path: '/:id/follow',
  responses: { 200: { description: 'Success' } }
})
router.post('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const follow = await userService.followUser(req.userId, req.params.id)
      res.status(201).json(follow)
    })


openapiRegistry.registerPath({
  method: 'delete',
  path: '/:id/follow',
  responses: { 200: { description: 'Success' } }
})
router.delete('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      await userService.unfollowUser(req.userId, req.params.id)
      res.json({ message: 'Unfollowed' })
    })


openapiRegistry.registerPath({
  method: 'get',
  path: '/me/notifications',
  responses: { 200: { description: 'Success' } }
})
router.get('/me/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      const notifications = await userService.getNotifications(req.userId)
      res.json(notifications)
    })


openapiRegistry.registerPath({
  method: 'patch',
  path: '/me/notifications/read',
  responses: { 200: { description: 'Success' } }
})
router.patch('/me/notifications/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // @ts-ignore
      const userService = (req as any).container.resolve('userService')
      await userService.markNotificationsRead(req.userId)
      res.json({ message: 'All notifications marked as read' })
    })

export default router
