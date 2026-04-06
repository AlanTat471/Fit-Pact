import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import { useAuth } from "@/contexts/AuthContext";

const Logout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleCancel = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <MaterialIcon name="logout" className="text-destructive" />
          </div>
          <CardTitle>Log Out</CardTitle>
          <CardDescription>
            Are you sure you want to log out of your account?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
          >
            Yes, Log Out
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logout;
