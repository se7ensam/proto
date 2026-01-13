import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authService } from '../services/auth.service'

export const authRouter = Router()

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

const googleLoginSchema = z.object({
    token: z.string(),
})

authRouter.post('/signup', async (req: Request, res: Response) => {
    try {
        console.log('[Auth] Signup attempt:', req.body)
        const validated = signupSchema.parse(req.body)
        const result = await authService.register(validated.email, validated.password)
        res.json(result)
    } catch (error) {
        console.error('[Auth] Signup error:', error)
        if (error instanceof Error) {
            res.status(400).json({ error: error.message })
        } else {
            res.status(500).json({ error: 'Internal server error' })
        }
    }
})

authRouter.post('/login', async (req: Request, res: Response) => {
    try {
        const validated = loginSchema.parse(req.body)
        const result = await authService.login(validated.email, validated.password)
        res.json(result)
    } catch (error) {
        if (error instanceof Error) {
            res.status(401).json({ error: error.message })
        } else {
            res.status(500).json({ error: 'Internal server error' })
        }
    }
})

authRouter.post('/google', async (req: Request, res: Response) => {
    try {
        const validated = googleLoginSchema.parse(req.body)
        const result = await authService.googleLogin(validated.token)
        res.json(result)
    } catch (error) {
        if (error instanceof Error) {
            res.status(401).json({ error: error.message })
        } else {
            res.status(500).json({ error: 'Internal server error' })
        }
    }
})
