import { useState } from 'react'
import { apiService } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface LoginPageProps {
    onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            let result
            if (isLogin) {
                result = await apiService.login(email, password)
            } else {
                result = await apiService.signup(email, password)
            }

            apiService.setToken(result.token)
            onLoginSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
            <Card className="w-[400px] shadow-xl border-0 backdrop-blur-sm bg-white/80">
                <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isLogin ? 'Sign in to continue to AI Chat' : 'Sign up to get started with AI Chat'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Email</label>
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Password</label>
                            <Input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="h-11"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                        >
                            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="font-medium text-primary hover:underline"
                            >
                                {isLogin ? 'Sign up' : 'Log in'}
                            </button>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
