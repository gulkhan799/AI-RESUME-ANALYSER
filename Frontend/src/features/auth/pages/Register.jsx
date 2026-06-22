import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Register = () => {

    const navigate = useNavigate()
    const [ username, setUsername ] = useState("")
    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")

    const { loading, handleRegister } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        await handleRegister({ username, email, password })
        navigate("/")
    }

    if (loading) {
        return (
            <main className="auth-screen">
                <div className="auth-loading" role="status" aria-live="polite">
                    <span className="auth-loading__spinner" aria-hidden="true" />
                    <p>Creating your account&hellip;</p>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-screen">
            <div className="form-container">
                <div className="form-brand" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                </div>
                <div className="form-heading">
                    <h1>Create your account</h1>
                    <p>Start generating personalized interview strategies in minutes.</p>
                </div>

                <form onSubmit={handleSubmit} noValidate>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            onChange={(e) => { setUsername(e.target.value) }}
                            type="text"
                            id="username"
                            name="username"
                            autoComplete="username"
                            placeholder="Choose a username"
                            required
                        />
                    </div>
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
                            autoComplete="new-password"
                            placeholder="Create a password"
                            required
                        />
                    </div>

                    <button type="submit" className="button primary-button auth-submit">Register</button>

                </form>

                <p className="form-switch">Already have an account? <Link to={"/login"}>Login</Link></p>
            </div>
        </main>
    )
}

export default Register
