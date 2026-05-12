import React, { useEffect } from "react";
import RegisterForm from "@/components/RegisterForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NUMI_LOGIN_OK_THIS_DOCUMENT_KEY } from "@/lib/authSessionGate";

const Register = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Send already-signed-in users to the app only if they completed login in this
  // browser session (sessionStorage). Prevents /register from racing the stale-session gate.
  useEffect(() => {
    if (loading || !session) return;
    try {
      if (sessionStorage.getItem(NUMI_LOGIN_OK_THIS_DOCUMENT_KEY) === "1") {
        navigate("/dashboard", { replace: true });
      }
    } catch {
      /* no-op */
    }
  }, [loading, session, navigate]);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto py-8">
        <RegisterForm />
      </div>
    </div>
  );
};

export default Register;