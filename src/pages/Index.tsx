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
      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
        
        {/* Left Side - Logo (Fit.jpg: place in public/ folder for best quality) */}
        <div className="flex justify-center lg:justify-start">
          <img 
            src="/Fit.jpg" 
            alt="Weight Loss Buddy - Your fitness journey starts here" 
            className="w-full max-w-md object-contain rounded-lg shadow-md"
            width={448}
            height={336}
            fetchPriority="high"
          />
        </div>
        
        {/* Right Side - Login Form */}
        <div className="flex justify-center lg:justify-end">
          <LoginForm />
        </div>
        
      </div>
    </div>
  );
};

export default Index;
