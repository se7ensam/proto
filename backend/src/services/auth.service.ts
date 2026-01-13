import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

export class AuthService {
    private googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

    private generateToken(userId: string) {
        return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
    }

    async register(email: string, password?: string) {
        // Check if user exists
        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))

        if (existingUser) {
            throw new Error('User already exists')
        }

        let hashedPassword = null
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10)
        }

        const [newUser] = await db
            .insert(users)
            .values({
                email,
                password: hashedPassword,
            })
            .returning()

        return {
            user: { id: newUser.id, email: newUser.email },
            token: this.generateToken(newUser.id),
        }
    }

    async login(email: string, password?: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))

        if (!user) {
            throw new Error('Invalid credentials')
        }

        if (!user.password && password) {
            throw new Error('This account uses Google Login. Please use Google Sign-In.')
        }

        if (password && user.password) {
            const isValid = await bcrypt.compare(password, user.password)
            if (!isValid) {
                throw new Error('Invalid credentials')
            }
        } else if (password) {
            // Should catch cases where one is missing
            throw new Error('Invalid credentials')
        }
        // If no password provided, it might require different flow, but standard login requires it.

        return {
            user: { id: user.id, email: user.email },
            token: this.generateToken(user.id),
        }
    }

    async googleLogin(idToken: string) {
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        })
        const payload = ticket.getPayload()

        if (!payload || !payload.email) {
            throw new Error('Invalid Google Token')
        }

        const email = payload.email
        const googleId = payload.sub

        // Check if user exists
        let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))

        if (!user) {
            // Create new user
            [user] = await db
                .insert(users)
                .values({
                    email,
                    googleId,
                })
                .returning()
        } else if (!user.googleId) {
            // Link Google ID to existing account
            [user] = await db
                .update(users)
                .set({ googleId })
                .where(eq(users.id, user.id))
                .returning()
        }

        return {
            user: { id: user.id, email: user.email },
            token: this.generateToken(user.id),
        }
    }
}

export const authService = new AuthService()
