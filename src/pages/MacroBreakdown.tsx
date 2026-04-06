import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Slider } from "@/components/ui/slider";
import { BackButton } from "@/components/BackButton";
import { useUserData } from "@/contexts/UserDataContext";
import { useAuth } from "@/contexts/AuthContext";

const MacroBreakdown = () => {
  const { profile } = useAuth();
  const { tdee, journey, customMacros, saveMacros } = useUserData();
  // Load daily calories: prefer journey (Dashboard) recommended, then tdee starting, then localStorage
  const startingCalorieIntake = (() => {
    const rec = journey?.recommended_calories;
    if (rec && rec > 0) return String(rec);
    const storedRec = localStorage.getItem('dashboardRecommendedCalories');
    if (storedRec && parseInt(storedRec) > 0) return storedRec;
    return tdee?.starting_calorie_intake || localStorage.getItem('startingCalorieIntake') || "";
  })();
  
  // Get activity level from user profile (prefer AuthContext profile, then localStorage)
  const getActivityLevel = (): string => {
    if (profile?.activity_level) return profile.activity_level;
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      try {
        const parsed = JSON.parse(userProfile);
        return parsed.activityLevel || 'sedentary';
      } catch (e) {
        return 'sedentary';
      }
    }
    return 'sedentary';
  };

  // Get macro percentages based on activity level (normalize hyphenated values from userProfile)
  const getMacroPercentages = (activityLevel: string) => {
    const normalized = activityLevel.toLowerCase().replace(/-/g, ' ');
    switch (normalized) {
      case 'sedentary':
        return { protein: 22, fats: 23, carbs: 55 };
      case 'lightly active':
        return { protein: 25, fats: 20, carbs: 55 };
      case 'moderately active':
        return { protein: 30, fats: 20, carbs: 50 };
      case 'very active':
        return { protein: 35, fats: 20, carbs: 45 };
      case 'super active':
        return { protein: 35, fats: 25, carbs: 40 };
      default:
        return { protein: 22, fats: 23, carbs: 55 };
    }
  };

  const activityLevel = getActivityLevel();
  const defaultPercentages = getMacroPercentages(activityLevel);

  // Calculate grams from daily calories based on percentages, adjusting carbs to ensure exact 100%
  const calculateMacroGrams = (calories: number, proteinPercent: number, carbPercent: number, fatPercent: number) => {
    const proteinCalories = (calories * proteinPercent) / 100;
    const fatCalories = (calories * fatPercent) / 100;
    
    let proteinGrams = Math.round(proteinCalories / 4);
    let fatGrams = Math.round(fatCalories / 9);
    
    // Calculate remaining calories for carbs to ensure total equals daily calories
    const usedCalories = (proteinGrams * 4) + (fatGrams * 9);
    const remainingCalories = calories - usedCalories;
    let carbGrams = Math.round(remainingCalories / 4);
    
    // Final adjustment to ensure exact match
    let totalCals = (proteinGrams * 4) + (carbGrams * 4) + (fatGrams * 9);
    while (totalCals > calories && carbGrams > 0) {
      carbGrams--;
      totalCals = (proteinGrams * 4) + (carbGrams * 4) + (fatGrams * 9);
    }
    while (totalCals < calories) {
      carbGrams++;
      totalCals = (proteinGrams * 4) + (carbGrams * 4) + (fatGrams * 9);
      if (totalCals > calories) {
        carbGrams--;
        break;
      }
    }
    
    return { protein: proteinGrams, carbs: carbGrams, fats: fatGrams };
  };

  const initialCalories = parseInt(startingCalorieIntake) || 0;
  const initialDefaults = calculateMacroGrams(initialCalories, defaultPercentages.protein, defaultPercentages.carbs, defaultPercentages.fats);

  const [dailyCalories, setDailyCalories] = useState(startingCalorieIntake);
  const [macroGrams, setMacroGrams] = useState({
    protein: initialCalories > 0 ? initialDefaults.protein : 0,
    carbs: initialCalories > 0 ? initialDefaults.carbs : 0,
    fats: initialCalories > 0 ? initialDefaults.fats : 0
  });

  const [macros, setMacros] = useState({
    protein: { grams: 0, calories: 0, percentage: 0 },
    carbs: { grams: 0, calories: 0, percentage: 0 },
    fats: { grams: 0, calories: 0, percentage: 0 },
    totalCalories: 0
  });

  // Popup states
  const [showCustomMacroPopup, setShowCustomMacroPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showBelowRecommendedPopup, setShowBelowRecommendedPopup] = useState(false);
  const [showAdjustmentChoicePopup, setShowAdjustmentChoicePopup] = useState(false);
  const [showConfirmProceedPopup, setShowConfirmProceedPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [inputMode, setInputMode] = useState<'grams' | 'percentage'>('grams');
  const [customInputs, setCustomInputs] = useState({
    protein: "",
    carbs: "",
    fats: ""
  });
  const [belowRecommendedType, setBelowRecommendedType] = useState<'protein' | 'fats' | 'both'>('both');

  type MacroGramsShape = { protein: number; carbs: number; fats: number };
  const [pendingMacrosToCommit, setPendingMacrosToCommit] = useState<MacroGramsShape | null>(null);
  const [pendingBelowRecommendedCommit, setPendingBelowRecommendedCommit] = useState<MacroGramsShape | null>(null);

  // Load saved custom macros: prefer Supabase (customMacros), fallback to localStorage
  useEffect(() => {
    if (customMacros && Object.keys(customMacros).length > 0) {
      setMacroGrams(customMacros as { protein: number; carbs: number; fats: number });
      return;
    }
    const s = localStorage.getItem('customMacroGrams');
    if (s) {
      try {
        setMacroGrams(JSON.parse(s));
      } catch (e) {
        console.error('Error parsing saved macros:', e);
      }
    }
  }, [customMacros]);

  // Update macros when daily calories or activity level changes from TDEE Calculator
  useEffect(() => {
    const storedCalories = startingCalorieIntake || localStorage.getItem('startingCalorieIntake') || "";
    if (storedCalories && storedCalories !== dailyCalories) {
      setDailyCalories(storedCalories);
      const calories = parseInt(storedCalories) || 0;
      if (calories > 0) {
        const hasMacros = (customMacros && Object.keys(customMacros).length > 0) || localStorage.getItem('customMacroGrams');
        if (!hasMacros) {
          const currentActivityLevel = getActivityLevel();
          const percentages = getMacroPercentages(currentActivityLevel);
          const defaults = calculateMacroGrams(calories, percentages.protein, percentages.carbs, percentages.fats);
          setMacroGrams(defaults);
        }
      }
    }
  }, [dailyCalories, startingCalorieIntake, customMacros]);

  // Calculate and update macro display with whole number percentages that add to 100%
  useEffect(() => {
    const totalCalories = parseInt(dailyCalories) || 0;
    
    const proteinCalories = macroGrams.protein * 4;
    const carbCalories = macroGrams.carbs * 4;
    const fatCalories = macroGrams.fats * 9;

    // Calculate percentages and round to whole numbers
    let proteinPercent = totalCalories > 0 ? Math.round((proteinCalories / totalCalories) * 100) : 0;
    let fatPercent = totalCalories > 0 ? Math.round((fatCalories / totalCalories) * 100) : 0;
    // Carbs gets the remainder to ensure total is always 100%
    let carbPercent = totalCalories > 0 ? 100 - proteinPercent - fatPercent : 0;
    
    // Ensure no negative percentages
    if (carbPercent < 0) {
      carbPercent = 0;
    }

    setMacros({
      protein: {
        grams: macroGrams.protein,
        calories: Math.round(proteinCalories),
        percentage: proteinPercent
      },
      carbs: {
        grams: macroGrams.carbs,
        calories: Math.round(carbCalories),
        percentage: carbPercent
      },
      fats: {
        grams: macroGrams.fats,
        calories: Math.round(fatCalories),
        percentage: fatPercent
      },
      totalCalories: totalCalories
    });
  }, [macroGrams, dailyCalories]);

  const handleOpenCustomPopup = () => {
    setInputMode('grams');
    setCustomInputs({
      protein: macroGrams.protein.toString(),
      carbs: macroGrams.carbs.toString(),
      fats: macroGrams.fats.toString()
    });
    setShowCustomMacroPopup(true);
  };

  const handleMacroSliderChange = (macro: 'protein' | 'carbs' | 'fats', nextValue: number) => {
    const totalCalories = parseInt(dailyCalories) || 0;
    if (totalCalories <= 0) return;

    const current = {
      protein: macros.protein.percentage,
      carbs: macros.carbs.percentage,
      fats: macros.fats.percentage,
    };
    const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));

    const others = (['protein', 'carbs', 'fats'] as const).filter((m) => m !== macro);
    const remaining = 100 - clamped;
    const sumOthers = current[others[0]] + current[others[1]];

    let otherOne = 0;
    let otherTwo = 0;
    if (sumOthers <= 0) {
      otherOne = Math.floor(remaining / 2);
      otherTwo = remaining - otherOne;
    } else {
      otherOne = Math.round((remaining * current[others[0]]) / sumOthers);
      otherTwo = remaining - otherOne;
    }

    const next = { ...current } as { protein: number; carbs: number; fats: number };
    next[macro] = clamped;
    next[others[0]] = otherOne;
    next[others[1]] = otherTwo;

    const grams = calculateMacroGrams(totalCalories, next.protein, next.carbs, next.fats);
    setMacroGrams(grams);
    localStorage.setItem('customMacroGrams', JSON.stringify(grams));
    saveMacros(grams);
  };

  const handleCustomInputChange = (field: 'protein' | 'carbs' | 'fats', value: string) => {
    // Only allow whole numbers
    const numValue = value.replace(/[^0-9]/g, '');
    const newInputs = { ...customInputs, [field]: numValue };
    
    // Auto-sync: Update the other format (grams <-> percentage) for real-time sync
    const totalCalories = parseInt(dailyCalories) || 0;
    if (totalCalories > 0) {
      // Calculate current values in grams
      let proteinGrams = 0;
      let carbsGrams = 0;
      let fatsGrams = 0;
      
      if (inputMode === 'grams') {
        proteinGrams = parseInt(newInputs.protein) || 0;
        carbsGrams = parseInt(newInputs.carbs) || 0;
        fatsGrams = parseInt(newInputs.fats) || 0;
      } else {
        const proteinPercent = parseInt(newInputs.protein) || 0;
        const carbsPercent = parseInt(newInputs.carbs) || 0;
        const fatsPercent = parseInt(newInputs.fats) || 0;
        
        proteinGrams = Math.round((totalCalories * proteinPercent / 100) / 4);
        carbsGrams = Math.round((totalCalories * carbsPercent / 100) / 4);
        fatsGrams = Math.round((totalCalories * fatsPercent / 100) / 9);
      }
    }
    
    setCustomInputs(newInputs);
  };

  // Reset to recommended macros based on activity level
  const handleResetToRecommended = () => {
    const calories = parseInt(dailyCalories) || 0;
    if (calories > 0) {
      const defaults = calculateMacroGrams(calories, defaultPercentages.protein, defaultPercentages.carbs, defaultPercentages.fats);
      setMacroGrams(defaults);
      localStorage.removeItem('customMacroGrams');
      saveMacros(defaults);
    }
  };
  const commitMacros = (newMacros: { protein: number; carbs: number; fats: number }, closePopup: boolean = true) => {
    setMacroGrams(newMacros);
    localStorage.setItem('customMacroGrams', JSON.stringify(newMacros));
    saveMacros(newMacros);
    // Update custom inputs to reflect the new values
    if (inputMode === 'grams') {
      setCustomInputs({
        protein: newMacros.protein.toString(),
        carbs: newMacros.carbs.toString(),
        fats: newMacros.fats.toString()
      });
    } else {
      const totalCalories = parseInt(dailyCalories) || 0;
      const proteinPercent = totalCalories > 0 ? Math.round((newMacros.protein * 4 / totalCalories) * 100) : 0;
      const fatPercent = totalCalories > 0 ? Math.round((newMacros.fats * 9 / totalCalories) * 100) : 0;
      const carbPercent = 100 - proteinPercent - fatPercent;
      setCustomInputs({
        protein: proteinPercent.toString(),
        carbs: Math.max(0, carbPercent).toString(),
        fats: fatPercent.toString()
      });
    }
    if (closePopup) {
      setShowCustomMacroPopup(false);
    }
  };

  const calcCarbsForRemainingCalories = (totalCals: number, proteinGrams: number, fatGrams: number) => {
    const usedCals = (proteinGrams * 4) + (fatGrams * 9);
    const remaining = totalCals - usedCals;
    let carbs = Math.max(0, Math.round(remaining / 4));

    let total = usedCals + (carbs * 4);
    while (total > totalCals && carbs > 0) {
      carbs--;
      total -= 4;
    }
    while (total < totalCals) {
      carbs++;
      total += 4;
      if (total > totalCals) {
        carbs--;
        break;
      }
    }

    return carbs;
  };

  // Autofill function - fills ALL blank macros based on activity level
  const handleAutofill = () => {
    const totalCalories = parseInt(dailyCalories) || 0;
    if (totalCalories === 0) return;

    const proteinInput = customInputs.protein;
    const carbsInput = customInputs.carbs;
    const fatsInput = customInputs.fats;

    if (inputMode === 'percentage') {
      // Fill blank percentages based on activity level
      let protein = proteinInput ? parseInt(proteinInput) : 0;
      let fats = fatsInput ? parseInt(fatsInput) : 0;
      let carbs = carbsInput ? parseInt(carbsInput) : 0;

      // If all blank, use recommended
      if (!proteinInput && !fatsInput && !carbsInput) {
        setCustomInputs({
          protein: defaultPercentages.protein.toString(),
          carbs: defaultPercentages.carbs.toString(),
          fats: defaultPercentages.fats.toString()
        });
        return;
      }

      // Fill in blank fields based on recommended and adjust
      if (!proteinInput) protein = defaultPercentages.protein;
      if (!fatsInput) fats = defaultPercentages.fats;
      if (!carbsInput) carbs = 100 - protein - fats;
      if (carbs < 0) carbs = 0;

      setCustomInputs({
        protein: protein.toString(),
        carbs: carbs.toString(),
        fats: fats.toString()
      });
    } else {
      // Grams mode - fill blank grams based on activity level
      let protein = proteinInput ? parseInt(proteinInput) : 0;
      let fats = fatsInput ? parseInt(fatsInput) : 0;
      let carbs = carbsInput ? parseInt(carbsInput) : 0;

      // If all blank, use recommended
      if (!proteinInput && !fatsInput && !carbsInput) {
        const defaults = calculateMacroGrams(totalCalories, defaultPercentages.protein, defaultPercentages.carbs, defaultPercentages.fats);
        setCustomInputs({
          protein: defaults.protein.toString(),
          carbs: defaults.carbs.toString(),
          fats: defaults.fats.toString()
        });
        return;
      }

      // If protein blank, calculate based on activity level percentage
      if (!proteinInput) {
        const proteinCalories = (totalCalories * defaultPercentages.protein) / 100;
        protein = Math.round(proteinCalories / 4);
      }

      // If fats blank, calculate based on activity level percentage
      if (!fatsInput) {
        const fatCalories = (totalCalories * defaultPercentages.fats) / 100;
        fats = Math.round(fatCalories / 9);
      }

      // Calculate carbs to fill remaining calories
      const usedCalories = (protein * 4) + (fats * 9);
      const remainingCalories = totalCalories - usedCalories;
      carbs = Math.round(remainingCalories / 4);
      if (carbs < 0) carbs = 0;

      // Fine-tune to ensure exact match
      let totalCals = (protein * 4) + (carbs * 4) + (fats * 9);
      while (totalCals > totalCalories && carbs > 0) {
        carbs--;
        totalCals = (protein * 4) + (carbs * 4) + (fats * 9);
      }
      while (totalCals < totalCalories) {
        carbs++;
        totalCals = (protein * 4) + (carbs * 4) + (fats * 9);
        if (totalCals > totalCalories) {
          carbs--;
          break;
        }
      }

      setCustomInputs({
        protein: protein.toString(),
        carbs: carbs.toString(),
        fats: fats.toString()
      });
    }
  };

  const handleSaveCustomMacros = () => {
    const totalCalories = parseInt(dailyCalories) || 0;
    if (totalCalories === 0) return;

    const toInt = (v: string) => parseInt(v || "0") || 0;

    if (inputMode === 'percentage') {
      const proteinPercent = toInt(customInputs.protein);
      const fatPercent = toInt(customInputs.fats);
      const carbPercent = toInt(customInputs.carbs);

      // If protein+fats exceed 100% we cannot fix by adjusting carbs.
      if (proteinPercent + fatPercent > 100) {
        const over = (proteinPercent + fatPercent) - 100;
        setPendingMacrosToCommit(null);
        setErrorMessage(
          `Protein and Fats alone exceed 100% by ${over}%. Please reduce Protein or Fats.`
        );
        setShowErrorPopup(true);
        return;
      }

      // If total isn't 100, carbs will be adjusted to be the remainder.
      const finalCarbPercent = Math.max(0, 100 - proteinPercent - fatPercent);
      const adjusted = calculateMacroGrams(totalCalories, proteinPercent, finalCarbPercent, fatPercent);

      // Exceeded -> show error, then commit the auto-adjusted values after user clicks Ok.
      if (proteinPercent + fatPercent + carbPercent > 100) {
        const over = (proteinPercent + fatPercent + carbPercent) - 100;
        setPendingMacrosToCommit(adjusted);
        setErrorMessage(
          `You have exceeded 100% by ${over}%. The app will automatically adjust Carbohydrates so your total is 100% and does not exceed your daily calories.`
        );
        setShowErrorPopup(true);
        return;
      }

      // Check which macros are below recommended
      const proteinBelow = proteinPercent < defaultPercentages.protein;
      const fatBelow = fatPercent < defaultPercentages.fats;

      if (proteinBelow || fatBelow) {
        if (proteinBelow && fatBelow) {
          setBelowRecommendedType('both');
        } else if (proteinBelow) {
          setBelowRecommendedType('protein');
        } else {
          setBelowRecommendedType('fats');
        }
        setPendingBelowRecommendedCommit(adjusted);
        setShowBelowRecommendedPopup(true);
        return;
      }

      commitMacros(adjusted);
      return;
    }

    // Grams mode
    const protein = toInt(customInputs.protein);
    const fats = toInt(customInputs.fats);
    const carbsInput = toInt(customInputs.carbs);

    const proteinFatCalories = (protein * 4) + (fats * 9);
    if (proteinFatCalories > totalCalories) {
      const overCalories = proteinFatCalories - totalCalories;
      setPendingMacrosToCommit(null);
      setErrorMessage(
        `Protein and Fats alone exceed your total daily calories by ${overCalories} calories. Please reduce Protein or Fats.`
      );
      setShowErrorPopup(true);
      return;
    }

    const inputCalories = proteinFatCalories + (carbsInput * 4);
    const adjustedCarbs = calcCarbsForRemainingCalories(totalCalories, protein, fats);
    const adjusted = { protein, carbs: adjustedCarbs, fats };

    // Exceeded -> show error, then commit the auto-adjusted values after user clicks Ok.
    if (inputCalories > totalCalories) {
      const overCalories = inputCalories - totalCalories;
      setPendingMacrosToCommit(adjusted);
      setErrorMessage(
        `You have exceeded your total daily calories by ${overCalories} calories. The app will automatically adjust Carbohydrates so your total does not exceed your daily calories.`
      );
      setShowErrorPopup(true);
      return;
    }

    // Check which macros are below recommended
    const proteinPercent = totalCalories > 0 ? Math.round(((protein * 4) / totalCalories) * 100) : 0;
    const fatPercent = totalCalories > 0 ? Math.round(((fats * 9) / totalCalories) * 100) : 0;

    const proteinBelow = proteinPercent < defaultPercentages.protein;
    const fatBelow = fatPercent < defaultPercentages.fats;

    if (proteinBelow || fatBelow) {
      if (proteinBelow && fatBelow) {
        setBelowRecommendedType('both');
      } else if (proteinBelow) {
        setBelowRecommendedType('protein');
      } else {
        setBelowRecommendedType('fats');
      }
      setPendingBelowRecommendedCommit(adjusted);
      setShowBelowRecommendedPopup(true);
      return;
    }

    // Under or exact -> carbs is automatically adjusted to hit total daily calories.
    commitMacros(adjusted);
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

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <BackButton />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2 text-zinc-100">
            Macro Breakdown
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Adjust your protein, carbohydrate, and fat split while the app preserves a 100% total and recalculates grams/calories automatically.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h1>
          <p className="text-zinc-400 text-sm">Calibrated from your daily target calories</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Calorie & Goal Information */}
        <Card className="bg-[#131313] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Calorie & Goal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Daily Calories */}
            <div className="space-y-2">
              <TooltipField tooltip="Your daily calorie target from your TDEE calculation.">
                <Label htmlFor="dailyCalories">Daily Calories</Label>
              </TooltipField>
              <Input
                id="dailyCalories"
                type="text"
                inputMode="numeric"
                value={parseInt(dailyCalories || '0') > 0 ? parseInt(dailyCalories).toLocaleString() : ''}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Macro Breakdown Results */}
            <div className="space-y-6 pt-4 border-t">
              <h3 className="font-semibold text-zinc-100 uppercase tracking-wide text-sm">Daily Target</h3>
              
              {/* Protein */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-bold text-primary uppercase tracking-widest text-xs">Protein</Label>
                  <span className="text-sm text-muted-foreground">{macros.protein.percentage}%</span>
                </div>
                <Slider value={[macros.protein.percentage]} min={0} max={100} step={1} onValueChange={(v) => handleMacroSliderChange('protein', v[0] ?? 0)} className="[&_[role=slider]]:border-primary" />
                <div className="flex justify-between text-sm">
                  <span>{macros.protein.grams.toLocaleString()}g</span>
                  <span>{macros.protein.calories.toLocaleString()} calories</span>
                </div>
              </div>

              {/* Carbohydrates */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-bold text-secondary uppercase tracking-widest text-xs">Carbs</Label>
                  <span className="text-sm text-muted-foreground">{macros.carbs.percentage}%</span>
                </div>
                <Slider value={[macros.carbs.percentage]} min={0} max={100} step={1} onValueChange={(v) => handleMacroSliderChange('carbs', v[0] ?? 0)} className="[&_[role=slider]]:border-secondary" />
                <div className="flex justify-between text-sm">
                  <span>{macros.carbs.grams.toLocaleString()}g</span>
                  <span>{macros.carbs.calories.toLocaleString()} calories</span>
                </div>
              </div>

              {/* Fats */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-bold text-accent uppercase tracking-widest text-xs">Fats</Label>
                  <span className="text-sm text-muted-foreground">{macros.fats.percentage}%</span>
                </div>
                <Slider value={[macros.fats.percentage]} min={0} max={100} step={1} onValueChange={(v) => handleMacroSliderChange('fats', v[0] ?? 0)} className="[&_[role=slider]]:border-accent" />
                <div className="flex justify-between text-sm">
                  <span>{macros.fats.grams.toLocaleString()}g</span>
                  <span>{macros.fats.calories.toLocaleString()} calories</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center font-medium">
                  <span>Total Daily Calories</span>
                  <span>{macros.totalCalories.toLocaleString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Total always remains 100%. When one macro changes, the other two auto-adjust proportionally.</p>
              </div>

              {/* Macro Buttons */}
              <div className="flex justify-center gap-3 pt-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleResetToRecommended} variant="outline" className="gap-2">
                        Recommended
                        <MaterialIcon name="help_outline" size="sm" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Press if you want to follow the 'Recommended macronutrient split' based on activity level and information entered.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button onClick={handleOpenCustomPopup} variant="outline">
                  Customise Macro
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Macro Guidelines */}
        <Card className="hidden">
          <CardHeader>
            <CardTitle>Macro Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-primary">Protein</h4>
                <p className="text-sm text-muted-foreground">
                  Essential for muscle building and repair. Aim for 0.8-2.2g per kg of body weight depending on activity level.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-secondary">Carbohydrates</h4>
                <p className="text-sm text-muted-foreground">
                  Primary energy source for workouts and daily activities. Focus on complex carbs for sustained energy.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-accent">Fats</h4>
                <p className="text-sm text-muted-foreground">
                  Important for hormone production and nutrient absorption. Include healthy fats like avocados, nuts, and olive oil.
                </p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Your Activity Level:</strong> {activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Recommended Split:</strong> {defaultPercentages.protein}% Protein, {defaultPercentages.carbs}% Carbs, {defaultPercentages.fats}% Fats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Macro Popup */}
      <AlertDialog open={showCustomMacroPopup} onOpenChange={setShowCustomMacroPopup}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Customise Macro</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Enter your desired macros. Carbohydrates will be adjusted accordingly and automatically for you. You can adjust your desired macro intake for Protein and Fats and the app will allocate remaining calories to carbohydrates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Percentage/Grams Toggle */}
            <div className="flex justify-center gap-2">
              <Button
                variant={inputMode === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (inputMode !== 'percentage') {
                    // Convert grams to percentage
                    const totalCalories = parseInt(dailyCalories) || 0;
                    const protein = parseInt(customInputs.protein) || 0;
                    const carbs = parseInt(customInputs.carbs) || 0;
                    const fats = parseInt(customInputs.fats) || 0;
                    
                    const proteinPercent = totalCalories > 0 ? Math.round((protein * 4 / totalCalories) * 100) : 0;
                    const fatPercent = totalCalories > 0 ? Math.round((fats * 9 / totalCalories) * 100) : 0;
                    const carbPercent = 100 - proteinPercent - fatPercent;
                    
                    setCustomInputs({
                      protein: proteinPercent.toString(),
                      carbs: Math.max(0, carbPercent).toString(),
                      fats: fatPercent.toString()
                    });
                    setInputMode('percentage');
                  }
                }}
              >
                Percentage
              </Button>
              <Button
                variant={inputMode === 'grams' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (inputMode !== 'grams') {
                    // Convert percentage to grams
                    const totalCalories = parseInt(dailyCalories) || 0;
                    const proteinPercent = parseInt(customInputs.protein) || 0;
                    const carbPercent = parseInt(customInputs.carbs) || 0;
                    const fatPercent = parseInt(customInputs.fats) || 0;
                    
                    const protein = Math.round((totalCalories * proteinPercent / 100) / 4);
                    const fats = Math.round((totalCalories * fatPercent / 100) / 9);
                    const usedCals = (protein * 4) + (fats * 9);
                    const carbs = Math.round((totalCalories - usedCals) / 4);
                    
                    setCustomInputs({
                      protein: protein.toString(),
                      carbs: Math.max(0, carbs).toString(),
                      fats: fats.toString()
                    });
                    setInputMode('grams');
                  }
                }}
              >
                Grams
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customProtein">Protein {inputMode === 'grams' ? '(g) - 4 cal/g' : '(%)'}</Label>
              <Input
                id="customProtein"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customInputs.protein}
                onChange={(e) => handleCustomInputChange("protein", e.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customCarbs">Carbohydrates {inputMode === 'grams' ? '(g) - 4 cal/g' : '(%)'}</Label>
              <Input
                id="customCarbs"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customInputs.carbs}
                onChange={(e) => handleCustomInputChange("carbs", e.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customFats">Fats {inputMode === 'grams' ? '(g) - 9 cal/g' : '(%)'}</Label>
              <Input
                id="customFats"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customInputs.fats}
                onChange={(e) => handleCustomInputChange("fats", e.target.value)}
                placeholder="0"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            {/* Autofill Button */}
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleAutofill} type="button">
                Autofill
              </Button>
            </div>
            
            {/* Preview of total */}
            <div className="pt-4 border-t">
              {inputMode === 'grams' ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span>Total Calories:</span>
                    <span className={`font-bold ${
                      ((parseInt(customInputs.protein) || 0) * 4 + (parseInt(customInputs.carbs) || 0) * 4 + (parseInt(customInputs.fats) || 0) * 9) > (parseInt(dailyCalories) || 0)
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                      {((parseInt(customInputs.protein) || 0) * 4 + (parseInt(customInputs.carbs) || 0) * 4 + (parseInt(customInputs.fats) || 0) * 9).toLocaleString()} / {parseInt(dailyCalories || '0').toLocaleString()} cal
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span>Percentage:</span>
                    <span className={`font-bold ${
                      ((parseInt(customInputs.protein) || 0) * 4 + (parseInt(customInputs.carbs) || 0) * 4 + (parseInt(customInputs.fats) || 0) * 9) > (parseInt(dailyCalories) || 0)
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                      {parseInt(dailyCalories) > 0 
                        ? Math.round((((parseInt(customInputs.protein) || 0) * 4 + (parseInt(customInputs.carbs) || 0) * 4 + (parseInt(customInputs.fats) || 0) * 9) / parseInt(dailyCalories)) * 100)
                        : 0}%
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span>Total Percentage:</span>
                    <span className={`font-bold ${
                      ((parseInt(customInputs.protein) || 0) + (parseInt(customInputs.carbs) || 0) + (parseInt(customInputs.fats) || 0)) > 100
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                      {(parseInt(customInputs.protein) || 0) + (parseInt(customInputs.carbs) || 0) + (parseInt(customInputs.fats) || 0)} / 100%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCustomMacroPopup(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomMacros}>
              Save Custom Macros
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Below recommended confirmation */}
      <AlertDialog open={showBelowRecommendedPopup} onOpenChange={setShowBelowRecommendedPopup}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Below Recommended</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You have entered values for {belowRecommendedType === 'both' ? 'Protein and Fats' : belowRecommendedType === 'protein' ? 'Protein' : 'Fats'} below the recommended daily intake. This is not ideal and you should at least be eating at recommended daily intake. Do you want the app to adjust to recommended intake?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowBelowRecommendedPopup(false);
                setShowAdjustmentChoicePopup(true);
              }}
            >
              Yes, please.
            </Button>
            <Button
              onClick={() => {
                // Show confirmation popup instead of immediately committing
                setShowBelowRecommendedPopup(false);
                setShowConfirmProceedPopup(true);
              }}
            >
              No, do not adjust.
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjustment Choice Popup */}
      <AlertDialog open={showAdjustmentChoicePopup} onOpenChange={setShowAdjustmentChoicePopup}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Adjust Macros</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Which macro would you like the app to adjust to recommended intake?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const totalCalories = parseInt(dailyCalories) || 0;
                if (totalCalories > 0) {
                  const toInt = (v: string) => parseInt(v || "0") || 0;
                  
                  if (inputMode === 'percentage') {
                    const fatPercent = toInt(customInputs.fats);
                    const newProtein = defaultPercentages.protein;
                    const newCarbPercent = Math.max(0, 100 - newProtein - fatPercent);
                    const adjusted = calculateMacroGrams(totalCalories, newProtein, newCarbPercent, fatPercent);
                    setShowAdjustmentChoicePopup(false);
                    setPendingBelowRecommendedCommit(null);
                    commitMacros(adjusted, false);
                  } else {
                    const fats = toInt(customInputs.fats);
                    const proteinCalories = (totalCalories * defaultPercentages.protein) / 100;
                    const newProtein = Math.round(proteinCalories / 4);
                    const newCarbs = calcCarbsForRemainingCalories(totalCalories, newProtein, fats);
                    setShowAdjustmentChoicePopup(false);
                    setPendingBelowRecommendedCommit(null);
                    commitMacros({ protein: newProtein, carbs: newCarbs, fats }, false);
                  }
                } else {
                  setShowAdjustmentChoicePopup(false);
                }
              }}
            >
              Protein
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const totalCalories = parseInt(dailyCalories) || 0;
                if (totalCalories > 0) {
                  const toInt = (v: string) => parseInt(v || "0") || 0;
                  
                  if (inputMode === 'percentage') {
                    const proteinPercent = toInt(customInputs.protein);
                    const newFats = defaultPercentages.fats;
                    const newCarbPercent = Math.max(0, 100 - proteinPercent - newFats);
                    const adjusted = calculateMacroGrams(totalCalories, proteinPercent, newCarbPercent, newFats);
                    setShowAdjustmentChoicePopup(false);
                    setPendingBelowRecommendedCommit(null);
                    commitMacros(adjusted, false);
                  } else {
                    const protein = toInt(customInputs.protein);
                    const fatCalories = (totalCalories * defaultPercentages.fats) / 100;
                    const newFats = Math.round(fatCalories / 9);
                    const newCarbs = calcCarbsForRemainingCalories(totalCalories, protein, newFats);
                    setShowAdjustmentChoicePopup(false);
                    setPendingBelowRecommendedCommit(null);
                    commitMacros({ protein, carbs: newCarbs, fats: newFats }, false);
                  }
                } else {
                  setShowAdjustmentChoicePopup(false);
                }
              }}
            >
              Fats
            </Button>
            <Button
              onClick={() => {
                const totalCalories = parseInt(dailyCalories) || 0;
                if (totalCalories > 0) {
                  const recommended = calculateMacroGrams(
                    totalCalories,
                    defaultPercentages.protein,
                    defaultPercentages.carbs,
                    defaultPercentages.fats
                  );
                  setShowAdjustmentChoicePopup(false);
                  setPendingBelowRecommendedCommit(null);
                  commitMacros(recommended, false);
                } else {
                  setShowAdjustmentChoicePopup(false);
                }
              }}
            >
              Both
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Proceed Popup */}
      <AlertDialog open={showConfirmProceedPopup} onOpenChange={setShowConfirmProceedPopup}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you sure you want to Proceed?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Your macro values are below the recommended daily intake. Are you sure you want to continue with these values?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // User confirms - save the below-recommended macros
                const candidate = pendingBelowRecommendedCommit;
                setShowConfirmProceedPopup(false);
                setPendingBelowRecommendedCommit(null);
                if (candidate) commitMacros(candidate, true);
              }}
            >
              Yes, proceed.
            </Button>
            <Button
              onClick={() => {
                // Return to Customise Macro popup
                setShowConfirmProceedPopup(false);
                setShowCustomMacroPopup(true);
              }}
            >
              No.
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Popup - Exceeds limit */}
      <AlertDialog open={showErrorPopup} onOpenChange={setShowErrorPopup}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Unable to Save</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              {errorMessage || "The total must add up to 100%. Protein and Fats alone exceed your Daily Calories."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowErrorPopup(false);
                const toCommit = pendingMacrosToCommit;
                setPendingMacrosToCommit(null);
                if (toCommit) commitMacros(toCommit, false);
              }}
            >
              Ok
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default MacroBreakdown;
