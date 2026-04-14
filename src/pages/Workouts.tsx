import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import { BackButton } from "@/components/BackButton";
import { useUserData } from "@/contexts/UserDataContext";
import { resolveJourneyAnchorFromRow } from "@/lib/journeyAnchor";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProfile } from "@/lib/supabaseProfile";

const TDEE = () => {
  const navigate = useNavigate();
  const { saveTdee, loading: userDataLoading, journey } = useUserData();
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();

  // Safety timeout: if loading exceeds 5s, force-show the form to avoid infinite spinner
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawLoading = authLoading || (!!user && userDataLoading);
  const isLoading = rawLoading && !loadingTimedOut;

  useEffect(() => {
    if (rawLoading) {
      loadingTimeoutRef.current = setTimeout(() => setLoadingTimedOut(true), 5000);
    } else {
      setLoadingTimedOut(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    }
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, [rawLoading]);
  
  // State for overview dialog (shows only once per user)
  const [showOverviewDialog, setShowOverviewDialog] = useState(() => {
    return !localStorage.getItem('tdeeOverviewShown');
  });
  
  // State for TDEE change warning popup
  const [showTdeeChangeWarning, setShowTdeeChangeWarning] = useState(false);
  const [showUnderweightDialog, setShowUnderweightDialog] = useState(false);
  const [pendingFieldChange, setPendingFieldChange] = useState<{ field: string; value: string } | null>(null);
  
  // Store original values from profile creation
  const [originalValues, setOriginalValues] = useState<typeof formData | null>(null);
  
  // Load form data from localStorage on mount and sync with userProfile
  const [formData, setFormData] = useState(() => {
    const profile = localStorage.getItem('userProfile');
    
    // Load from user profile if available
    if (profile) {
      try {
        const profileData = JSON.parse(profile);
        return {
          gender: profileData.gender || "",
          height: profileData.height || "",
          weight: profileData.currentWeight || "",
          age: profileData.age || "",
          activityLevel: profileData.activityLevel || ""
        };
      } catch (e) {
        // Fall through to default
      }
    }
    
    // Default empty state
    return {
      gender: "",
      height: "",
      weight: "",
      age: "",
      activityLevel: ""
    };
  });
  
  const profileHydratedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) profileHydratedForUserRef.current = null;
  }, [user?.id]);

  // Hydrate TDEE form from Supabase profile once per login — avoids flicker from refreshProfile/saveTdee loops
  useEffect(() => {
    if (!user?.id || !profile) return;
    if (profileHydratedForUserRef.current === user.id) return;
    profileHydratedForUserRef.current = user.id;
    const next = {
      gender: profile.gender || "",
      height: profile.height || "",
      weight: profile.current_weight || "",
      age: String(profile.age ?? ""),
      activityLevel: profile.activity_level || "",
    };
    setFormData(next);
    setOriginalValues({ ...next });
  }, [user?.id, profile]);

  // When profile weight updates from elsewhere (e.g. Maintenance Phase week 4 sync), keep TDEE form in sync
  // Skip sync briefly after the user edits weight locally to avoid the old DB value overwriting their input
  const localWeightEditRef = useRef(false);
  const localWeightEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileWeight = profile?.current_weight;
  useEffect(() => {
    if (localWeightEditRef.current) return;
    if (profileWeight == null || profileWeight === "") return;
    setFormData((prev) => {
      if (prev.weight === profileWeight) return prev;
      return { ...prev, weight: profileWeight };
    });
  }, [profileWeight]);

  // Listen for changes to userProfile in localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      if (localWeightEditRef.current) return;
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        try {
          const profileData = JSON.parse(profile);
          setFormData({
            gender: profileData.gender || "",
            height: profileData.height || "",
            weight: profileData.currentWeight || "",
            age: profileData.age || "",
            activityLevel: profileData.activityLevel || ""
          });
        } catch (e) {
          console.error('Error parsing user profile:', e);
        }
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const [calculatedValues, setCalculatedValues] = useState({
    bmr: "",
    tdee: "",
    startingCalories: "",
    idealWeightMin: "",
    idealWeightMax: "",
    idealBodyFatMin: "",
    idealBodyFatMax: "",
    idealBMIMin: "",
    idealBMIMax: "",
    currentBMI: "",
    classification: "",
    yourClassification: "",
    estimatedBodyFat: ""
  });

  const displayVal = (v: string): string => {
    if (!v) return "";
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return "Unable to calculate";
    return v;
  };

  const hasInvalidCalcs = (() => {
    const { currentBMI, estimatedBodyFat, idealWeightMin, idealWeightMax, idealBMIMin, idealBMIMax } = calculatedValues;
    if (!currentBMI || !estimatedBodyFat) return true;
    const bmi = parseFloat(currentBMI);
    const bf = parseFloat(estimatedBodyFat);
    const iwMin = parseFloat(idealWeightMin);
    const iwMax = parseFloat(idealWeightMax);
    const bmiMin = parseFloat(idealBMIMin);
    const bmiMax = parseFloat(idealBMIMax);
    if (isNaN(bmi) || bmi <= 0) return true;
    if (isNaN(bf) || bf <= 0) return true;
    if (isNaN(iwMin) || iwMin <= 0 || isNaN(iwMax) || iwMax <= 0) return true;
    if (isNaN(bmiMin) || bmiMin <= 0 || isNaN(bmiMax) || bmiMax <= 0) return true;
    const weight = parseFloat(formData.weight);
    const midWeight = (iwMin + iwMax) / 2;
    const suggestedGoal = Math.max(0, weight - midWeight);
    if (suggestedGoal <= 0) return true;
    if (bmi < bmiMin || bf < parseFloat(calculatedValues.idealBodyFatMin)) return true;
    return false;
  })();

  const isUnderweight = calculatedValues.yourClassification === "Underweight";

  // Calculate BMR using Mifflin-St Jeor Equation
  const calculateBMR = (weight: number, height: number, age: number, gender: string) => {
    if (gender === "male") {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  };

  // Calculate BMI
  const calculateBMI = (weight: number, height: number) => {
    const heightInM = height / 100;
    return weight / (heightInM * heightInM);
  };

  // Get BMI classification
  const getBMIClassification = (bmi: number) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Within Healthy Range";
    if (bmi < 30) return "Overweight";
    return "Obese";
  };

  // Get simplified classification category
  const getClassificationCategory = (bmi: number) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Healthy";
    if (bmi < 30) return "Overweight";
    return "Obese";
  };

  /** Robinson (1983) ideal body weight from height — differs by sex so changing gender updates the range */
  const calculateIdealWeightRangeFromGender = (heightCm: number, gender: string) => {
    const totalInches = heightCm / 2.54;
    const inchesOver5ft = Math.max(0, totalInches - 60);
    const center =
      gender === "female" ? 49 + 1.7 * inchesOver5ft : 52 + 1.9 * inchesOver5ft;
    const minWeight = center * 0.92;
    const maxWeight = center * 1.08;
    return { min: minWeight, max: maxWeight, center };
  };

  // Calculate ideal body fat ranges based on age and gender
  const calculateIdealBodyFatRange = (age: number, gender: string) => {
    if (gender === "male") {
      if (age <= 30) return { min: 10, max: 18 };
      if (age <= 50) return { min: 12, max: 21 };
      return { min: 14, max: 24 };
    } else {
      if (age <= 30) return { min: 16, max: 24 };
      if (age <= 50) return { min: 19, max: 27 };
      return { min: 22, max: 30 };
    }
  };

  // Calculate estimated body fat percentage using Navy method
  const calculateEstimatedBodyFat = (weight: number, height: number, age: number, gender: string) => {
    const bmi = calculateBMI(weight, height);
    // Using Deurenberg formula
    if (gender === "male") {
      return (1.2 * bmi) + (0.23 * age) - 16.2;
    } else {
      return (1.2 * bmi) + (0.23 * age) - 5.4;
    }
  };

  const tdeeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualStartingCalRef = useRef<string | null>(null);

  useEffect(() => {
    const { gender, height, weight, age, activityLevel } = formData;

    if (gender && height && weight && age && activityLevel) {
      const heightNum = parseFloat(height);
      const weightNum = parseFloat(weight);
      const ageNum = parseFloat(age);

      const bmr = calculateBMR(weightNum, heightNum, ageNum, gender);

      const activityMultipliers = {
        sedentary: 1.2,
        "lightly-active": 1.375,
        "moderately-active": 1.55,
        "very-active": 1.725,
        "super-active": 1.9,
      };

      const multiplier = activityMultipliers[activityLevel as keyof typeof activityMultipliers] || 1.2;
      const tdee = bmr * multiplier;
      const startingCalories = manualStartingCalRef.current
        ? parseInt(manualStartingCalRef.current, 10)
        : tdee;

      const idealWeight = calculateIdealWeightRangeFromGender(heightNum, gender);
      const idealBodyFat = calculateIdealBodyFatRange(ageNum, gender);

      const currentBMI = calculateBMI(weightNum, heightNum);
      const classification = getBMIClassification(currentBMI);
      const yourClassification = getClassificationCategory(currentBMI);

      const estimatedBodyFat = calculateEstimatedBodyFat(weightNum, heightNum, ageNum, gender);

      const newCalculatedValues = {
        bmr: bmr.toFixed(0),
        tdee: tdee.toFixed(0),
        startingCalories: startingCalories.toFixed(0),
        idealWeightMin: idealWeight.min.toFixed(1),
        idealWeightMax: idealWeight.max.toFixed(1),
        idealBodyFatMin: idealBodyFat.min.toString(),
        idealBodyFatMax: idealBodyFat.max.toString(),
        idealBMIMin: "18.5",
        idealBMIMax: "24.9",
        currentBMI: currentBMI.toFixed(1),
        classification,
        yourClassification,
        estimatedBodyFat: estimatedBodyFat.toFixed(1),
      };

      setCalculatedValues(newCalculatedValues);

      const midWeight = idealWeight.center;
      const weightToLose = Math.max(0, weightNum - midWeight);

      const valuesJson = {
        currentBMI: currentBMI.toFixed(1),
        bodyFatPercentage: estimatedBodyFat.toFixed(1),
        classification: yourClassification,
        currentWeight: weightNum.toFixed(1),
        weightToLose: weightToLose.toFixed(2),
        suggestedWeightGoal: midWeight.toFixed(2),
        height: heightNum.toString(),
      };

      if (tdeeSaveTimerRef.current) clearTimeout(tdeeSaveTimerRef.current);
      tdeeSaveTimerRef.current = setTimeout(() => {
        localStorage.setItem("startingCalorieIntake", startingCalories.toFixed(0));
        localStorage.setItem("suggestedWeightGoal", midWeight.toFixed(2));
        localStorage.setItem("tdeeCalculatedValues", JSON.stringify(valuesJson));
        saveTdee({
          starting_calorie_intake: startingCalories.toFixed(0),
          suggested_weight_goal: midWeight.toFixed(2),
          height: heightNum.toString(),
          current_weight: weightNum.toFixed(1),
          weight_to_lose: weightToLose.toFixed(2),
          values_json: valuesJson,
        });
        tdeeSaveTimerRef.current = null;
      }, 450);
    }

    return () => {
      if (tdeeSaveTimerRef.current) clearTimeout(tdeeSaveTimerRef.current);
    };
  }, [formData, saveTdee]);

  const prevClassRef = useRef(calculatedValues.yourClassification);
  useEffect(() => {
    if (calculatedValues.yourClassification === "Underweight" && prevClassRef.current !== "Underweight") {
      setShowUnderweightDialog(true);
    }
    prevClassRef.current = calculatedValues.yourClassification;
  }, [calculatedValues.yourClassification]);

  // Handle field change with warning popup (only shows once, then user has already acknowledged)
  const handleFieldChangeWithWarning = (field: string, value: string) => {
    const alreadyAcknowledged = localStorage.getItem('tdeeChangeWarningAcknowledged') === 'true';
    // Check if original values exist and value is actually different
    if (!alreadyAcknowledged && originalValues && originalValues[field as keyof typeof originalValues] !== value) {
      setPendingFieldChange({ field, value });
      setShowTdeeChangeWarning(true);
    } else {
      applyFieldChange(field, value);
    }
  };
  
  // Apply the field change without warning
  const applyFieldChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    if (field === "weight") {
      localWeightEditRef.current = true;
      if (localWeightEditTimerRef.current) clearTimeout(localWeightEditTimerRef.current);
      localWeightEditTimerRef.current = setTimeout(() => { localWeightEditRef.current = false; }, 2000);
    }
    
    // Update profile in Supabase (source of truth)
    const fieldMap: Record<string, string> = {
      'weight': 'current_weight',
      'gender': 'gender',
      'height': 'height',
      'age': 'age',
      'activityLevel': 'activity_level'
    };
    const profileField = fieldMap[field];
    if (user?.id && profileField) {
      const payload: Record<string, string | number> = {};
      payload[profileField] = field === 'age' ? parseInt(value, 10) : value;
      upsertProfile(user.id, payload as Parameters<typeof upsertProfile>[1]);
      if (field !== "weight") refreshProfile();
    }
    // Also update localStorage for legacy compatibility
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try {
        const profileData = JSON.parse(stored);
        const camelMap: Record<string, string> = {
          'weight': 'currentWeight',
          'gender': 'gender',
          'height': 'height',
          'age': 'age',
          'activityLevel': 'activityLevel'
        };
        profileData[camelMap[field] || field] = value;
        localStorage.setItem('userProfile', JSON.stringify(profileData));
      } catch (e) {
        console.error('Error updating user profile:', e);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // For first time editing or when no original values, just apply directly
    if (!originalValues || !originalValues[field as keyof typeof originalValues]) {
      applyFieldChange(field, value);
      return;
    }
    
    // Check if value has actually changed from original
    const originalValue = originalValues[field as keyof typeof originalValues];
    if (originalValue !== value) {
      handleFieldChangeWithWarning(field, value);
    } else {
      applyFieldChange(field, value);
    }
  };
  
  // Handle confirmation of TDEE change
  const handleConfirmTdeeChange = () => {
    if (pendingFieldChange) {
      applyFieldChange(pendingFieldChange.field, pendingFieldChange.value);
      setOriginalValues(prev => prev ? { ...prev, [pendingFieldChange.field]: pendingFieldChange.value } : null);
    }
    // Mark as acknowledged so it never shows again
    localStorage.setItem('tdeeChangeWarningAcknowledged', 'true');
    setPendingFieldChange(null);
    setShowTdeeChangeWarning(false);
  };
  
  // Handle cancellation - revert to original values
  const handleCancelTdeeChange = () => {
    if (originalValues) {
      setFormData({ ...originalValues });
      // Also revert userProfile in localStorage
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        try {
          const profileData = JSON.parse(profile);
          profileData.gender = originalValues.gender;
          profileData.height = originalValues.height;
          profileData.currentWeight = originalValues.weight;
          profileData.age = originalValues.age;
          profileData.activityLevel = originalValues.activityLevel;
          localStorage.setItem('userProfile', JSON.stringify(profileData));
        } catch (e) {
          console.error('Error reverting user profile:', e);
        }
      }
    }
    setPendingFieldChange(null);
    setShowTdeeChangeWarning(false);
  };

  const handleClearFields = () => {
    manualStartingCalRef.current = null;
    const emptyFormData = {
      gender: "",
      height: "",
      weight: "",
      age: "",
      activityLevel: ""
    };
    setFormData(emptyFormData);
    setCalculatedValues({
      bmr: "",
      tdee: "",
      startingCalories: "",
      idealWeightMin: "",
      idealWeightMax: "",
      idealBodyFatMin: "",
      idealBodyFatMax: "",
      idealBMIMin: "",
      idealBMIMax: "",
      currentBMI: "",
      classification: "",
      yourClassification: "",
      estimatedBodyFat: ""
    });
    localStorage.removeItem('tdeeFormData');
    localStorage.removeItem('startingCalorieIntake');
    localStorage.removeItem('tdeeCalculatedValues');
    const profileRaw = localStorage.getItem('userProfile');
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw);
        p.height = "";
        p.currentWeight = "";
        p.age = "";
        p.activityLevel = "";
        p.gender = "";
        localStorage.setItem('userProfile', JSON.stringify(p));
      } catch (e) {
        console.error('Error clearing user profile TDEE fields:', e);
      }
    }
    saveTdee({
      values_json: null,
      starting_calorie_intake: null,
      suggested_weight_goal: null,
      current_weight: null,
      weight_to_lose: null,
      height: null,
      current_bmi: null,
      body_fat_percentage: null,
      classification: null,
    });
  };

  const TooltipField = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {children}
        <Tooltip>
          <TooltipTrigger asChild>
            <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );


  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackButton />
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-xl border border-primary/20 bg-gradient-hero px-4 py-5 shadow-primary">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            My TDEE Calculator
            <Tooltip>
              <TooltipTrigger asChild>
                <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                <p className="text-sm">This calculator estimates your baseline calories and body metrics used by your dashboard and macro planning.</p>
              </TooltipContent>
            </Tooltip>
          </h1>
          <p className="text-muted-foreground">Calculate your Total Daily Energy Expenditure and ideal body metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="border-primary/20 transition-all duration-300 hover:shadow-primary">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gender */}
            <div className="space-y-3">
              <TooltipField tooltip="Biological sex affects metabolic rate calculations. Males typically have higher BMR than females due to muscle mass differences.">
                <Label htmlFor="gender">Gender</Label>
              </TooltipField>
              <RadioGroup
                value={formData.gender}
                onValueChange={(value) => handleInputChange("gender", value)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <TooltipField tooltip="Your age affects your metabolic rate. BMR typically decreases with age due to loss of muscle mass and slower cellular processes.">
                <Label htmlFor="age">Age (years)</Label>
              </TooltipField>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange("age", e.target.value)}
                placeholder="Enter your age"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Height */}
            <div className="space-y-2">
              <TooltipField tooltip="Your height in centimeters. This measurement is crucial for calculating BMI and determining ideal weight ranges.">
                <Label htmlFor="height">Height (cm)</Label>
              </TooltipField>
              <Input
                id="height"
                type="number"
                value={formData.height}
                onChange={(e) => handleInputChange("height", e.target.value)}
                placeholder="Enter your height in cm"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Activity Level */}
            <div className="space-y-2">
              <TooltipField tooltip="Your daily activity level affects how many calories you burn. Select the option that best describes your typical day.">
                <Label htmlFor="activityLevel">Activity Level</Label>
              </TooltipField>
              <Select value={formData.activityLevel} onValueChange={(value) => handleInputChange("activityLevel", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary - Less than 3,000 steps/day (Desk job, minimal movement)</SelectItem>
                  <SelectItem value="lightly-active">Lightly Active - 3,000-7,000 steps/day (Retail worker, teacher)</SelectItem>
                  <SelectItem value="moderately-active">Moderately Active - 7,500-9,000 steps/day (Warehouse worker, nurse)</SelectItem>
                  <SelectItem value="very-active">Very Active - 10,000-12,000 steps/day (Construction worker, personal trainer)</SelectItem>
                  <SelectItem value="super-active">Super Active - 12,500+ steps/day (Professional athlete, courier)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Body Weight */}
            <div className="space-y-2">
              <TooltipField tooltip="This is the weight you weighed this morning after going to the toilet and before eating or drinking.">
                <Label htmlFor="weight">Current Body Weight (kg)</Label>
              </TooltipField>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                placeholder="Enter your weight in kg"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Calculated Results */}
        <Card className="border-primary/20 transition-all duration-300 hover:shadow-primary">
          <CardHeader>
            <CardTitle>Calculated Values</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* BMR */}
            <div className="space-y-2">
              <TooltipField tooltip="This is the number of calories burned at rest (i.e., Breathing, Blood circulation, Regulate body temperature, Digesting process etc.).">
                <Label htmlFor="bmr">Basal Metabolic Rate (BMR)</Label>
              </TooltipField>
              <Input
                id="bmr"
                type="text"
                value={displayVal(calculatedValues.bmr) === "Unable to calculate" ? "Unable to calculate" : parseInt(calculatedValues.bmr || '0').toLocaleString()}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* TDEE */}
            <div className="space-y-2">
              <TooltipField tooltip="Your Total Daily Energy Expenditure is calculated by multiplying your BMR by your activity level multiplier. This represents the total calories you burn per day based on your current daily activity level and is what you need to eat to maintain your current weight.">
                <Label htmlFor="tdee">Total Daily Energy Expenditure (TDEE)</Label>
              </TooltipField>
              <Input
                id="tdee"
                type="text"
                inputMode="numeric"
                value={displayVal(calculatedValues.tdee) === "Unable to calculate" ? "Unable to calculate" : parseInt(calculatedValues.tdee || '0').toLocaleString()}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                  setCalculatedValues(prev => ({ ...prev, tdee: rawValue }));
                }}
                onBlur={() => {
                  const num = parseInt(calculatedValues.tdee, 10);
                  const floor = formData.gender === "female" ? 1300 : 1500;
                  if (!isNaN(num) && num > 0 && num < floor) {
                    alert(`The minimum allowed value is ${floor.toLocaleString()} calories for ${formData.gender === "female" ? "females" : "males"}. The value has been adjusted.`);
                    setCalculatedValues(prev => ({ ...prev, tdee: String(floor) }));
                  }
                }}
                readOnly={displayVal(calculatedValues.tdee) === "Unable to calculate"}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Starting Calories */}
            <div className="space-y-2">
              <TooltipField tooltip="Use this value to start your four-week 'Acclimation Phase'. This is to establish a baseline to start your diet. You may edit this value if you wish to start at a different calorie intake.">
                <Label htmlFor="startingCalories">Starting Calorie Intake</Label>
              </TooltipField>
              <Input
                id="startingCalories"
                type="text"
                inputMode="numeric"
                value={displayVal(calculatedValues.startingCalories) === "Unable to calculate" ? "Unable to calculate" : parseInt(calculatedValues.startingCalories || '0').toLocaleString()}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                  manualStartingCalRef.current = rawValue;
                  setCalculatedValues(prev => ({ ...prev, startingCalories: rawValue }));
                }}
                onBlur={() => {
                  const num = parseInt(calculatedValues.startingCalories, 10);
                  const floor = formData.gender === "female" ? 1300 : 1500;
                  if (!isNaN(num) && num > 0 && num < floor) {
                    alert(`The minimum allowed value is ${floor.toLocaleString()} calories for ${formData.gender === "female" ? "females" : "males"}. The value has been adjusted.`);
                    manualStartingCalRef.current = String(floor);
                    setCalculatedValues(prev => ({ ...prev, startingCalories: String(floor) }));
                  }
                  const finalVal = (!isNaN(num) && num > 0 && num < floor) ? String(floor) : calculatedValues.startingCalories;
                  if (finalVal && parseInt(finalVal, 10) > 0) {
                    manualStartingCalRef.current = finalVal;
                    localStorage.setItem('startingCalorieIntake', finalVal);
                    saveTdee({ starting_calorie_intake: finalVal });
                  }
                }}
                readOnly={displayVal(calculatedValues.startingCalories) === "Unable to calculate"}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Current BMI */}
            <div className="space-y-2">
              <TooltipField tooltip="Your current Body Mass Index based on your height and weight. BMI categories: Underweight (<18.5), Healthy (18.5-24.9), Overweight (25-29.9), Obese (≥30).">
                <Label htmlFor="currentBMI">Estimated BMI</Label>
              </TooltipField>
              <Input
                id="currentBMI"
                type="text"
                value={displayVal(calculatedValues.currentBMI)}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Estimated Body Fat % */}
            <div className="space-y-2">
              <TooltipField tooltip="Estimated body fat percentage calculated using the Deurenberg formula based on your BMI, age, and gender.">
                <Label htmlFor="estimatedBodyFat">Estimated Body Fat %</Label>
              </TooltipField>
              <Input
                id="estimatedBodyFat"
                type="text"
                value={displayVal(calculatedValues.estimatedBodyFat)}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Your Classification */}
            <div className="space-y-2">
              <TooltipField tooltip="Your health classification category based on BMI and other metrics: Underweight, Healthy, Overweight, or Obese.">
                <Label htmlFor="yourClassification">Your Classification</Label>
              </TooltipField>
              <Input
                id="yourClassification"
                value={calculatedValues.yourClassification}
                readOnly
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ideal Ranges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ideal Weight Range */}
        <Card className="md:col-span-1 border-primary/20 transition-all duration-300 hover:shadow-primary">
          <CardHeader>
            <CardTitle>Ideal Weight Range</CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Uses the Robinson formula (1983) from height and sex — changing gender updates this range.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <TooltipField tooltip="Lower end of a healthy reference range around the Robinson ideal weight for your height and sex (~8% below midpoint).">
                  <Label>From (kg)</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealWeightMin)}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <TooltipField tooltip="Upper end of a healthy reference range around the Robinson ideal weight for your height and sex (~8% above midpoint).">
                  <Label>Up to (kg)</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealWeightMax)}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ideal Body Fat Range */}
        <Card className="md:col-span-1 border-primary/20 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Ideal Body Fat Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <TooltipField tooltip="The minimum healthy body fat percentage for your age and gender. Body fat below this range may indicate insufficient essential fat.">
                  <Label>From (%)</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealBodyFatMin)}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <TooltipField tooltip="The maximum healthy body fat percentage for your age and gender. Body fat above this range may increase health risks.">
                  <Label>Up to (%)</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealBodyFatMax)}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ideal BMI Range */}
        <Card className="md:col-span-1 border-primary/20 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
          <CardHeader>
            <CardTitle>Ideal Body Mass Index (BMI) Range</CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              18.5–24.9 is the standard healthy adult BMI band used by the WHO; it does not vary by sex.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <TooltipField tooltip="The lower boundary of healthy BMI range (18.5). BMI below this indicates underweight status.">
                  <Label>From</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealBMIMin)}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <TooltipField tooltip="The upper boundary of healthy BMI range (24.9). BMI above this indicates overweight or obese status.">
                  <Label>Up to</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={displayVal(calculatedValues.idealBMIMax)}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weight Suggestion */}
        {calculatedValues.currentBMI && calculatedValues.idealWeightMax && formData.weight && (
          <Card className="md:col-span-1 border-primary/20 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
            <CardHeader>
              <CardTitle>Suggested Weight Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <TooltipField tooltip="Based on your current weight and the mid-range of the healthy BMI (21.7), this is the suggested weight to aim for to reach optimal health.">
                  <Label>Weight to Lose (kg)</Label>
                </TooltipField>
                <Input
                  type="text"
                  value={(() => {
                    const currentWeight = parseFloat(formData.weight);
                    const minWeight = parseFloat(calculatedValues.idealWeightMin);
                    const maxWeight = parseFloat(calculatedValues.idealWeightMax);
                    if (isNaN(currentWeight) || isNaN(minWeight) || isNaN(maxWeight) || minWeight <= 0 || maxWeight <= 0) return "Unable to calculate";
                    const midWeight = (minWeight + maxWeight) / 2;
                    const weightToLose = Math.max(0, currentWeight - midWeight);
                    if (weightToLose <= 0) return "0.00";
                    return weightToLose.toFixed(2);
                  })()}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This value represents the weight you need to lose to reach the mid-range of your healthy weight range.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Overview Dialog (shows on page load) */}
      <AlertDialog open={showOverviewDialog} onOpenChange={setShowOverviewDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Your TDEE Overview</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3">
              <p>
                Here is the overview of the details you have entered. This page will tell you that based on your inputs, your estimated Body Fat % (BF %), Body Mass Index (BMI), and your current 'Classification' is.
              </p>
              <p>
                It will also tell you what the ideal ranges are and give you an estimated weight to lose to get to your healthy weight.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                localStorage.setItem('tdeeOverviewShown', 'true');
              }}
            >
              Got it!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TDEE Change Warning Dialog */}
      <AlertDialog open={showTdeeChangeWarning} onOpenChange={setShowTdeeChangeWarning}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Warning!</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You are making a change to your TDEE. In doing so, this will change the values on your 'Dashboard'. Do you wish to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelTdeeChange}>
              No, keep as is.
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleConfirmTdeeChange}
            >
              Yes, please proceed.
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Button variant="outline" size="lg" className="gap-2" onClick={handleClearFields}>
          <MaterialIcon name="refresh" size="sm" />
          Clear Fields
        </Button>
        <button 
          className={`flex items-center justify-center gap-2 transition-colors text-lg font-medium ${hasInvalidCalcs || isUnderweight ? 'text-muted-foreground cursor-not-allowed opacity-50' : 'text-foreground hover:text-primary'}`}
          disabled={hasInvalidCalcs || isUnderweight}
          onClick={() => {
            if (isUnderweight) {
              setShowUnderweightDialog(true);
              return;
            }
            const existingLocal = localStorage.getItem("dashboardWeightLossStartDate");
            const hasServerAnchor = journey ? !!resolveJourneyAnchorFromRow(journey) : false;
            if (!existingLocal && !hasServerAnchor) {
              localStorage.setItem("showReadyToStartPopup", "true");
            }
            navigate('/dashboard');
          }}
        >
          Go to your Dashboard
          <MaterialIcon name="arrow_forward" size="sm" />
        </button>
      </div>

      {/* Underweight Classification Dialog */}
      <AlertDialog open={showUnderweightDialog} onOpenChange={setShowUnderweightDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Underweight Classification</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You are classified as 'Underweight'. You will not be able to continue losing weight. It is strongly recommended you first start a weight gain phase. Please consult your doctor first should you wish to go on a fat loss journey.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              I understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TDEE;