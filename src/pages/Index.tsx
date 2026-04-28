import React, { useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      // Don't auto-navigate while LoginForm is processing a sign-in (trusted device check)
      if (sessionStorage.getItem("authFlowPending") === "true") return;
      navigate("/dashboard");
    }
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto">
        <LoginForm />
      </div>
    </div>
  );
};

export default Index;
