import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from 'react'
import "../auth.form.scss"

const Protected = ({ children }) => {
    const { loading, user } = useAuth()

    if (loading) {
        return (
            <main className="auth-screen">
                <div className="auth-loading" role="status" aria-live="polite">
                    <span className="auth-loading__spinner" aria-hidden="true" />
                    <p>Loading&hellip;</p>
                </div>
            </main>
        )
    }

    if (!user) {
        return <Navigate to={'/login'} />
    }

    return children
}

export default Protected
