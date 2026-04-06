import React, { useEffect } from "react";
import RegisterForm from "@/components/RegisterForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Redirect already-registered users away from sign-up (sensitive pages are for registered users only)
  useEffect(() => {
    if (!loading && session) {
      navigate("/dashboard", { replace: true });
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