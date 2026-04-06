import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { upsertProfile, getProfile, profileToUserProfile } from "@/lib/supabaseProfile";
import { checkEmailExists, checkMobileExists } from "@/lib/supabaseCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialIcon } from "@/components/ui/material-icon";

const RegisterForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    age: "",
    gender: "",
    height: "",
    currentWeight: "",
    activityLevel: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    unitSystem: "metric"
  });
  
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null);
  const [errors, setErrors] = useState({
    age: "",
    height: "",
    password: "",
    weight: "",
    email: "",
    mobile: ""
  });
  const [weightWarning, setWeightWarning] = useState("");
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState("");
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmEmailDialog, setShowConfirmEmailDialog] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitAttempted(true);
    
    // Mark all fields as touched
    const allFields = ['firstName', 'lastName', 'age', 'gender', 'height', 'currentWeight', 'activityLevel', 'email', 'password', 'confirmPassword'];
    const allTouched: Record<string, boolean> = {};
    allFields.forEach(field => allTouched[field] = true);
    setTouchedFields(allTouched);
    
    // Check for missing required fields
    const requiredFields = [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'age', label: 'Age' },
      { field: 'gender', label: 'Gender' },
      { field: 'height', label: 'Height' },
      { field: 'currentWeight', label: 'Current Weight' },
      { field: 'activityLevel', label: 'Activity Level' },
      { field: 'email', label: 'Email' },
      { field: 'password', label: 'Password' },
      { field: 'confirmPassword', label: 'Confirm Password' },
    ];
    
    const missingFields = requiredFields.filter(rf => !formData[rf.field as keyof typeof formData]);
    if (missingFields.length > 0) {
      setErrorDialogMessage("One or more fields have not been filled in or completed correctly. Please check before proceeding.");
      setShowErrorDialog(true);
      return;
    }
    
    // Check if terms are accepted
    if (!formData.agreeToTerms) {
      setErrorDialogMessage("Please read and accept 'Terms & Conditions' before proceeding.");
      setShowErrorDialog(true);
      return;
    }
    
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setErrorDialogMessage("Passwords do not match. Please correct before proceeding.");
      setShowErrorDialog(true);
      return;
    }

    // Check email and mobile uniqueness (must be different from existing users)
    setErrors(prev => ({ ...prev, email: "", mobile: "" }));
    const emailExists = await checkEmailExists(formData.email.trim());
    if (emailExists) {
      setErrors(prev => ({ ...prev, email: "Email entered has already been used. Please enter a different email." }));
      return;
    }
    if (formData.mobile.trim()) {
      const mobileExists = await checkMobileExists(formData.mobile.trim());
      if (mobileExists) {
        setErrors(prev => ({ ...prev, mobile: "Mobile number entered has already been used. Please enter a different mobile number." }));
        return;
      }
    }
    
    // Check if weight is below the mid-point of healthy range based on height
    const weight = parseFloat(formData.currentWeight);
    const height = parseFloat(formData.height);
    const heightInCm = formData.unitSystem === "metric" ? height : height * 2.54;
    const weightInKg = formData.unitSystem === "metric" ? weight : weight * 0.453592;
    
    // Calculate healthy weight range using BMI 18.5-24.9
    const heightInM = heightInCm / 100;
    const minHealthyWeight = 18.5 * Math.pow(heightInM, 2);
    const maxHealthyWeight = 24.9 * Math.pow(heightInM, 2);
    
    // Calculate the mid-point of the healthy range
    const healthyMidPoint = (minHealthyWeight + maxHealthyWeight) / 2;
    
    // User weight cannot be below the mid-point of healthy range
    if (weightInKg < healthyMidPoint) {
      setErrorDialogMessage("Your current weight is below the mid-range of the healthy weight for your height. This app is designed for weight loss and is not suitable for users who are already at or below a healthy weight. Please consult a medical professional for advice.");
      setShowErrorDialog(true);
      return;
    }
    
    // Store height and weight in metric (cm, kg) for TDEE and app logic; convert if user chose imperial
    const heightToStore = formData.unitSystem === "metric" ? formData.height : String(Math.round(heightInCm * 10) / 10);
    const weightToStore = formData.unitSystem === "metric" ? formData.currentWeight : String(Math.round(weightInKg * 10) / 10);

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            age: parseInt(formData.age, 10),
            gender: formData.gender,
            height: heightToStore,
            currentWeight: weightToStore,
            activityLevel: formData.activityLevel,
            email: formData.email.trim(),
            mobile: formData.mobile || null,
            unitSystem: formData.unitSystem,
          },
        },
      });

      if (error) {
        setErrorDialogMessage(error.message || "Sign up failed. Please try again.");
        setShowErrorDialog(true);
        return;
      }

      // Only proceed if user is fully registered (has session). With email confirmation enabled,
      // signUp returns no session until the user confirms; with it disabled (dev), session is returned immediately.
      // Protected routes (dashboard, TDEE, etc.) require session - only registered users can access them.
      if (data.session?.user) {
        const { data: profileData, error: profileError } = await upsertProfile(data.session.user.id, {
          first_name: formData.firstName,
          last_name: formData.lastName,
          age: parseInt(formData.age, 10),
          gender: formData.gender,
          height: heightToStore,
          current_weight: weightToStore,
          activity_level: formData.activityLevel,
          email: formData.email.trim(),
          mobile: formData.mobile || null,
          unit_system: formData.unitSystem,
        });
        if (profileError) {
          // Fallback: profile may have been created by DB trigger; if so, proceed
          const { data: existing } = await getProfile(data.session.user.id);
          if (existing) {
            const u = profileToUserProfile(existing);
            if (u) localStorage.setItem("userProfile", JSON.stringify(u));
            navigate("/tdee-calculator");
            return;
          }
          setErrorDialogMessage(profileError.message || "Database error saving new user. Please try again or contact support.");
          setShowErrorDialog(true);
          return;
        }
        // Sync profile to localStorage so TDEE/Dashboard/etc see it immediately
        if (profileData) {
          const u = profileToUserProfile(profileData);
          if (u) localStorage.setItem("userProfile", JSON.stringify(u));
        }
        navigate("/tdee-calculator");
        return;
      }

      setShowConfirmEmailDialog(true);
    } catch (err) {
      setErrorDialogMessage("An unexpected error occurred. Please try again.");
      setShowErrorDialog(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Check if a required field is missing and has been touched or submit attempted
  const isFieldError = (fieldName: string) => {
    const value = formData[fieldName as keyof typeof formData];
    const isMissing = !value || (typeof value === 'string' && value.trim() === '');
    return (touchedFields[fieldName] || formSubmitAttempted) && isMissing;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    if (field === "email") setErrors(prev => ({ ...prev, email: "" }));
    if (field === "mobile") setErrors(prev => ({ ...prev, mobile: "" }));
    
    // Validate age
    if (field === "age") {
      const age = parseInt(value as string);
      if (age && age < 18) {
        setErrors(prev => ({ ...prev, age: "You must be at least 18 years old" }));
      } else {
        setErrors(prev => ({ ...prev, age: "" }));
      }
    }
    
    // Validate height
    if (field === "height") {
      const height = parseInt(value as string);
      const minHeight = formData.unitSystem === "metric" ? 135 : 53; // 135cm or 53in
      if (height && height < minHeight) {
        setErrors(prev => ({ ...prev, height: `Height must be at least ${minHeight}${formData.unitSystem === "metric" ? "cm" : "in"}` }));
      } else {
        setErrors(prev => ({ ...prev, height: "" }));
      }
    }
    
    // Validate weight against healthy mid-range
    if (field === "currentWeight" || field === "height" || field === "unitSystem") {
      const weight = parseFloat(field === "currentWeight" ? value as string : formData.currentWeight);
      const height = parseFloat(field === "height" ? value as string : formData.height);
      const unitSystem = field === "unitSystem" ? value as string : formData.unitSystem;
      
      if (weight && height) {
        const heightInCm = unitSystem === "metric" ? height : height * 2.54;
        const weightInKg = unitSystem === "metric" ? weight : weight * 0.453592;
        
        const heightInM = heightInCm / 100;
        const minHealthyWeight = 18.5 * Math.pow(heightInM, 2);
        const maxHealthyWeight = 24.9 * Math.pow(heightInM, 2);
        const healthyMidPoint = (minHealthyWeight + maxHealthyWeight) / 2;
        
        if (weightInKg < healthyMidPoint) {
          setErrors(prev => ({ ...prev, weight: "Your weight is too low." }));
          setWeightWarning(`Warning! The weight you entered is below the mid range of the healthy range. At your entered weight, you are close to the lowest weight for your Age, Height, Gender. Please consult a medical professional should you wish to go below the mid range healthy range.`);
        } else {
          setErrors(prev => ({ ...prev, weight: "" }));
          setWeightWarning("");
        }
      }
    }
    
    // Validate password
    if (field === "password") {
      const password = value as string;
      const hasMinLength = password.length >= 8;
      const hasNumber = /\d/.test(password);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      
      if (password && (!hasMinLength || !hasNumber || !hasSpecial)) {
        setErrors(prev => ({ ...prev, password: "Password must be at least 8 characters with numbers and special characters" }));
      } else {
        setErrors(prev => ({ ...prev, password: "" }));
      }
    }
    
    // Check password match
    if (field === "confirmPassword") {
      setPasswordMatch(value === formData.password);
    }
    if (field === "password" && formData.confirmPassword) {
      setPasswordMatch(formData.confirmPassword === value);
    }
  };

  return (
    <TooltipProvider>
      <Card className="w-full max-w-md mx-auto bg-background border-border">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-2xl font-bold text-foreground">
            Create a new profile
          </CardTitle>
          <CardDescription className="text-foreground/70">
            Tell us about yourself to get started
          </CardDescription>
          
          {/* Unit System Selection */}
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={() => handleInputChange("unitSystem", "metric")}
              className={`px-6 py-2 rounded border-2 transition-colors ${
                formData.unitSystem === "metric" 
                  ? "border-primary bg-primary/10 text-primary" 
                  : "border-border text-foreground hover:border-primary/50"
              }`}
            >
              KG/CM
            </button>
            <button
              type="button"
              onClick={() => handleInputChange("unitSystem", "imperial")}
              className={`px-6 py-2 rounded border-2 transition-colors ${
                formData.unitSystem === "imperial" 
                  ? "border-primary bg-primary/10 text-primary" 
                  : "border-border text-foreground hover:border-primary/50"
              }`}
            >
              LBS/INS
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className={`h-10 transition-colors ${isFieldError('firstName') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                  required
                />
                {isFieldError('firstName') && <p className="text-xs text-destructive">Required</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className={`h-10 transition-colors ${isFieldError('lastName') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                  required
                />
                {isFieldError('lastName') && <p className="text-xs text-destructive">Required</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium text-foreground">
                  Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", e.target.value)}
                  className={`h-10 transition-colors ${isFieldError('age') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                  min="18"
                  required
                />
                {isFieldError('age') && !errors.age && <p className="text-xs text-destructive">Required</p>}
                {errors.age && <p className="text-sm text-destructive">{errors.age}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-medium text-foreground">
                  Gender
                </Label>
                <Select onValueChange={(value) => handleInputChange("gender", value)} required>
                  <SelectTrigger className={`h-10 bg-background text-foreground ${isFieldError('gender') ? 'border-destructive' : 'border-border'}`}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-background text-foreground border-border">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                {isFieldError('gender') && <p className="text-xs text-destructive">Required</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height" className="text-sm font-medium text-foreground">
                  Height ({formData.unitSystem === "metric" ? "cm" : "in"})
                </Label>
                <Input
                  id="height"
                  type="number"
                  placeholder={formData.unitSystem === "metric" ? "175" : "69"}
                  value={formData.height}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  className={`h-10 transition-colors ${isFieldError('height') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                  min={formData.unitSystem === "metric" ? "135" : "53"}
                  required
                />
                {isFieldError('height') && !errors.height && <p className="text-xs text-destructive">Required</p>}
                {errors.height && <p className="text-sm text-destructive">{errors.height}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentWeight" className="text-sm font-medium text-foreground">
                  Current Weight ({formData.unitSystem === "metric" ? "kg" : "lbs"})
                </Label>
                <Input
                  id="currentWeight"
                  type="number"
                  placeholder={formData.unitSystem === "metric" ? "70" : "154"}
                  value={formData.currentWeight}
                  onChange={(e) => handleInputChange("currentWeight", e.target.value)}
                  className={`h-10 transition-colors ${isFieldError('currentWeight') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                  required
                />
                {isFieldError('currentWeight') && !errors.weight && <p className="text-xs text-destructive">Required</p>}
                {errors.weight && <p className="text-sm text-destructive font-medium">{errors.weight}</p>}
                {weightWarning && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                    {weightWarning}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="activityLevel" className="text-sm font-medium text-foreground">
                  Current Activity Level
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                    <p className="text-sm">
                      Activity levels and step counts are guidelines only and may not be entirely accurate. 
                      Individual results may vary depending on personal factors, fitness level, metabolism, 
                      and other varying circumstances.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select onValueChange={(value) => handleInputChange("activityLevel", value)} required>
                <SelectTrigger className={`h-10 bg-background text-foreground ${isFieldError('activityLevel') ? 'border-destructive' : 'border-border'}`}>
                  <SelectValue placeholder="Select your activity level" />
                </SelectTrigger>
                <SelectContent className="bg-background text-foreground border-border">
                  <SelectItem value="sedentary">Sedentary - Less than 3,000 steps/day (Desk job, minimal movement)</SelectItem>
                  <SelectItem value="lightly-active">Lightly Active - 3,000-7,000 steps/day (Retail worker, teacher)</SelectItem>
                  <SelectItem value="moderately-active">Moderately Active - 7,500-9,000 steps/day (Warehouse worker, nurse)</SelectItem>
                  <SelectItem value="very-active">Very Active - 10,000-12,000 steps/day (Construction worker, personal trainer)</SelectItem>
                  <SelectItem value="super-active">Super Active - 12,500+ steps/day (Professional athlete, courier)</SelectItem>
                </SelectContent>
              </Select>
              {isFieldError('activityLevel') && <p className="text-xs text-destructive">Required</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`h-10 transition-colors ${(isFieldError('email') || errors.email) ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                required
              />
              {isFieldError('email') && !errors.email && <p className="text-xs text-destructive">Required</p>}
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-sm font-medium text-foreground">
                Mobile (Optional)
              </Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="+61 400 000 000"
                value={formData.mobile}
                onChange={(e) => handleInputChange("mobile", e.target.value)}
                className={`h-10 transition-colors ${errors.mobile ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
              />
              {errors.mobile && <p className="text-sm text-destructive">{errors.mobile}</p>}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Create a Password
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                    <p className="text-sm">
                      Password must be at least 8 characters long and contain numbers and special characters
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className={`h-10 transition-colors ${isFieldError('password') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                minLength={8}
                required
              />
              {isFieldError('password') && !errors.password && <p className="text-xs text-destructive">Required</p>}
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                className={`h-10 transition-colors ${isFieldError('confirmPassword') ? 'border-destructive focus:border-destructive' : 'border-muted focus:border-primary'}`}
                required
              />
              {isFieldError('confirmPassword') && <p className="text-xs text-destructive">Required</p>}
              {passwordMatch !== null && (
                <p className={`text-sm ${passwordMatch ? "text-secondary" : "text-destructive"}`}>
                  {passwordMatch ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                className="border-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="terms" className="text-sm text-foreground">
                I agree to the Terms of Service and Privacy Policy
              </Label>
            </div>
            
            <button 
              type="submit" 
              className="w-full h-12 text-base text-foreground font-medium hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !formData.agreeToTerms || !!errors.age || !!errors.height || !!errors.password || !!errors.weight || (passwordMatch === false)}
            >
              {isSubmitting ? "Creating account…" : "Create a new profile"}
            </button>
          </form>
          
          <div className="text-center">
            <div className="text-sm text-foreground">
              Already have an account?{" "}
              <Link to="/" className="text-foreground hover:text-primary transition-colors font-medium underline-offset-4 hover:underline">
                Sign in here
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Confirm Email Dialog */}
      <AlertDialog open={showConfirmEmailDialog} onOpenChange={setShowConfirmEmailDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Check your email</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              We&apos;ve sent a confirmation link to <strong>{formData.email}</strong>. Click the link to verify your account, then sign in to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setShowConfirmEmailDialog(false); navigate("/"); }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Unable to Proceed</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              {errorDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
              Ok
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default RegisterForm;