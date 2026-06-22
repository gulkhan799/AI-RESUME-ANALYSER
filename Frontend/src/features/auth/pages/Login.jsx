import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        await handleLogin({ email, password })
        navigate('/')
    }

    if (loading) {
        return (
            <main className="auth-screen">
                <div className="auth-loading" role="status" aria-live="polite">
                    <span className="auth-loading__spinner" aria-hidden="true" />
                    <p>Signing you in&hellip;</p>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-screen">
            <div className="product-brand">
                <p className="product-brand__title">AI Resume Analyser</p>
                <p className="product-brand__subtitle">by GUL KHAN</p>
                <p className="app-tagline">Generate AI Resume and Resume Score with Interview Questions</p>
            </div>
           
            <div className="form-container">
                <div className="form-brand" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                </div>
                <div className="form-heading">
                    <h1>Welcome back</h1>
                    <p>Sign in to continue building your interview strategy.</p>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="input-group">
                        <label htmlFor="email">Email address</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email"
                            id="email"
                            name="email"
                            autoComplete="email"
                            placeholder="you@company.com"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password"
                            id="password"
                            name="password"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            required
                        />
                    </div>
                    <button type="submit" className="button primary-button auth-submit">Login</button>
                </form>
                <p className="form-switch">Don't have an account? <Link to={"/register"}>Register</Link></p>
            </div>
        </main>
    )
}

export default Login
