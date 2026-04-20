import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProfile } from "@/lib/supabaseProfile";
import { getUserPref } from "@/lib/supabaseUserPrefs";

// Achievement icons and their data for display on Profile page
const achievementsList = [
  { id: 1, title: "7-Day Streak", description: "Completed a week of tracking", icon: "bolt", color: "text-primary", bgColor: "bg-primary/10" },
  { id: 2, title: "Big Stepper", description: "Walked 10,000 steps", icon: "directions_walk", color: "text-secondary", bgColor: "bg-secondary/10" },
  { id: 3, title: "Consistency is Key", description: "Completed 7 day streak", icon: "check_circle", color: "text-accent", bgColor: "bg-accent/10" },
  { id: 4, title: "1kg Club", description: "Lose 1 kilogram", icon: "monitor_weight", color: "text-green-500", bgColor: "bg-green-500/10" },
  { id: 5, title: "30-Day Challenge", description: "Complete 30 consecutive days", icon: "event", color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
];

interface Goal {
  id: string;
  text: string;
  target?: number;
  current?: number;
  completed: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  
  // User name state - from Supabase profile
  const [userName, setUserName] = useState<{ firstName: string; lastName: string }>({ firstName: '', lastName: '' });
  
  // Profile description state - from Supabase, fallback to localStorage
  const [profileDescription, setProfileDescription] = useState(
    () => profile?.profile_description || localStorage.getItem('profileDescription') || ""
  );
  const [tempDescription, setTempDescription] = useState(profileDescription);
  const [showDescriptionPopup, setShowDescriptionPopup] = useState(false);
  
  // My Why state - from Supabase, fallback to localStorage
  const [myWhy, setMyWhy] = useState(
    () => profile?.my_why || localStorage.getItem('myWhy') || "I want to be healthier and have more energy for my family. I want to feel confident in my clothes and improve my overall well-being."
  );
  const [tempMyWhy, setTempMyWhy] = useState(myWhy);
  const [showMyWhyPopup, setShowMyWhyPopup] = useState(false);
  
  // Days of the week for goals
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Goals state - organized by day
  interface DayGoals {
    [day: string]: Goal[];
  }
  
  const [dayGoals, setDayGoals] = useState<DayGoals>(() => {
    const fromProfile = profile?.my_day_goals;
    if (fromProfile && typeof fromProfile === 'object') {
      try {
        return fromProfile as DayGoals;
      } catch {
        return daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
      }
    }
    const saved = localStorage.getItem('myDayGoals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
      }
    }
    return daysOfWeek.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
  });
  
  const [showGoalsPopup, setShowGoalsPopup] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  
  // Keep old goals for backwards compatibility - from Supabase first
  const [goals, setGoals] = useState<Goal[]>(() => {
    const fromProfile = profile?.my_goals;
    if (Array.isArray(fromProfile) && fromProfile.length > 0) {
      return fromProfile as Goal[];
    }
    const saved = localStorage.getItem('myGoals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  
  // Profile photo state - from Supabase first
  const [profilePhoto, setProfilePhoto] = useState(() => {
    return profile?.profile_photo || localStorage.getItem('profilePhoto') || "";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Weight loss tracking state
  const [weightLossToDate, setWeightLossToDate] = useState("0");

  // Active plan for PRO badge
  const [activePlan, setActivePlan] = useState<string>('free');
  useEffect(() => {
    if (!user?.id) {
      setActivePlan(localStorage.getItem('activePlan') || 'free');
      return;
    }
    getUserPref(user.id, 'activePlan').then((plan) => {
      if (plan) setActivePlan(plan);
      else setActivePlan(localStorage.getItem('activePlan') || 'free');
    });
  }, [user?.id]);
  
  const saveProfileToSupabase = useCallback(async (updates: { profile_description?: string; my_why?: string; my_goals?: Goal[]; my_day_goals?: DayGoals; profile_photo?: string }) => {
    if (!user?.id) return;
    await upsertProfile(user.id, {
      profile_description: updates.profile_description,
      my_why: updates.my_why,
      my_goals: updates.my_goals,
      my_day_goals: updates.my_day_goals,
      profile_photo: updates.profile_photo,
    });
    refreshProfile();
  }, [user?.id, refreshProfile]);

  // Load user name and profile data from Supabase profile
  useEffect(() => {
    if (profile) {
      setUserName({
        firstName: profile.first_name || '',
        lastName: profile.last_name || ''
      });
      setProfileDescription(profile.profile_description || "");
      setMyWhy(profile.my_why || "I want to be healthier and have more energy for my family. I want to feel confident in my clothes and improve my overall well-being.");
      if (Array.isArray(profile.my_goals)) setGoals(profile.my_goals as Goal[]);
      if (profile.my_day_goals && typeof profile.my_day_goals === 'object') setDayGoals(profile.my_day_goals as DayGoals);
      if (profile.profile_photo) setProfilePhoto(profile.profile_photo);
    } else {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          setUserName({ firstName: p.firstName || '', lastName: p.lastName || '' });
        } catch {}
      }
    }
  }, [profile]);
  
  // Get weight unit from user profile (prefer AuthContext profile, then localStorage)
  const getWeightUnit = () => {
    if (profile?.unit_system === 'imperial') return 'lbs';
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      try {
        const parsed = JSON.parse(userProfile);
        return parsed.unitSystem === 'imperial' ? 'lbs' : 'kg';
      } catch {
        return 'kg';
      }
    }
    return 'kg';
  };
  const weightUnit = getWeightUnit();
  
  /** Signed kg vs acclimation baseline (same as Dashboard): negative = loss, positive = gain */
  const getWeightPhaseDeltaKg = (): number => {
    const completedWeeksData = localStorage.getItem("dashboardCompletedWeeks");
    const acclimationDataStr = localStorage.getItem("dashboardAcclimationData");
    if (!completedWeeksData || !acclimationDataStr) return 0;
    try {
      const weeks = JSON.parse(completedWeeksData) as { averages?: { weight: number } }[];
      if (!weeks?.length) return 0;
      const acclim = JSON.parse(acclimationDataStr) as Record<string, Record<string, number>>;
      const week1Values = Object.values(acclim.week1 || {}).filter((v) => v > 0);
      const week2Values = Object.values(acclim.week2 || {}).filter((v) => v > 0);
      const week3Values = Object.values(acclim.week3 || {}).filter((v) => v > 0);
      const week4Values = Object.values(acclim.week4 || {}).filter((v) => v > 0);
      const allAcclimValues = [...week1Values, ...week2Values, ...week3Values, ...week4Values];
      if (allAcclimValues.length === 0) return 0;
      const acclimationAvg = allAcclimValues.reduce((sum, v) => sum + v, 0) / allAcclimValues.length;
      const lastCompletedWeekAvg = weeks[weeks.length - 1]?.averages?.weight ?? 0;
      return lastCompletedWeekAvg - acclimationAvg;
    } catch {
      return 0;
    }
  };

  const formatKgFullPrecision = (n: number) => {
    if (!Number.isFinite(n) || n === 0) return "0";
    const s = n.toString();
    if (!s.includes("e") && !s.includes("E")) return s;
    return n.toFixed(20).replace(/\.?0+$/, "");
  };

  const getWeightChangeDisplay = () => {
    const d = getWeightPhaseDeltaKg();
    const eps = 1e-12;
    if (Math.abs(d) < eps) return "0";
    if (d < 0) return `-${formatKgFullPrecision(Math.abs(d))}`;
    return `+${formatKgFullPrecision(d)}`;
  };
  
  // Update weight change on mount and when storage changes - poll for changes
  useEffect(() => {
    const updateWeightLoss = () => {
      setWeightLossToDate(getWeightChangeDisplay());
    };
    
    updateWeightLoss();
    
    // Poll for changes every 2 seconds
    const interval = setInterval(updateWeightLoss, 2000);
    
    const handleStorageChange = () => {
      updateWeightLoss();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Get dynamic badge data from localStorage/dashboard
  const getBadgeData = () => {
    let currentStreak = parseInt(localStorage.getItem('dashboardCurrentStreak') || '0');
    let longestStreak = parseInt(localStorage.getItem('dashboardLongestStreak') || '0');
    let latestAchievement = "No achievements yet";
    
    try {
      const completedWeeksData = localStorage.getItem('dashboardCompletedWeeks');
      if (completedWeeksData) {
        const weeks = JSON.parse(completedWeeksData);
        if (weeks.length > 0) {
          latestAchievement = `Week ${weeks.length} Complete`;
        }
      }
    } catch {}
    
    return { currentStreak, longestStreak, latestAchievement };
  };
  
  const badgeData = getBadgeData();
  
  const handleSaveDescription = () => {
    if (tempDescription.length <= 1000) {
      setProfileDescription(tempDescription);
      localStorage.setItem('profileDescription', tempDescription);
      saveProfileToSupabase({ profile_description: tempDescription });
      setShowDescriptionPopup(false);
    }
  };
  
  const handleSaveMyWhy = () => {
    if (tempMyWhy.length <= 1000) {
      setMyWhy(tempMyWhy);
      localStorage.setItem('myWhy', tempMyWhy);
      saveProfileToSupabase({ my_why: tempMyWhy });
      setShowMyWhyPopup(false);
    }
  };
  
  // Day Goals handlers
  const handleAddDayGoal = (day: string) => {
    if (!newGoalText.trim()) return;
    
    const newGoal: Goal = {
      id: Date.now().toString(),
      text: newGoalText,
      target: newGoalTarget ? parseInt(newGoalTarget.replace(/,/g, '')) : undefined,
      current: 0,
      completed: false,
    };
    
    const updatedDayGoals = {
      ...dayGoals,
      [day]: [...(dayGoals[day] || []), newGoal]
    };
    setDayGoals(updatedDayGoals);
    localStorage.setItem('myDayGoals', JSON.stringify(updatedDayGoals));
    saveProfileToSupabase({ my_day_goals: updatedDayGoals });
    setNewGoalText("");
    setNewGoalTarget("");
  };
  
  const handleUpdateDayGoalProgress = (day: string, goalId: string, newCurrent: number) => {
    const updatedDayGoals = {
      ...dayGoals,
      [day]: (dayGoals[day] || []).map(goal => {
        if (goal.id === goalId) {
          const updated = { ...goal, current: newCurrent };
          if (goal.target && newCurrent >= goal.target) {
            updated.completed = true;
          } else {
            updated.completed = false;
          }
          return updated;
        }
        return goal;
      })
    };
    setDayGoals(updatedDayGoals);
    localStorage.setItem('myDayGoals', JSON.stringify(updatedDayGoals));
    saveProfileToSupabase({ my_day_goals: updatedDayGoals });
  };
  
  const handleDeleteDayGoal = (day: string, goalId: string) => {
    const updatedDayGoals = {
      ...dayGoals,
      [day]: (dayGoals[day] || []).filter(goal => goal.id !== goalId)
    };
    setDayGoals(updatedDayGoals);
    localStorage.setItem('myDayGoals', JSON.stringify(updatedDayGoals));
    saveProfileToSupabase({ my_day_goals: updatedDayGoals });
  };
  
  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    
    const newGoal: Goal = {
      id: Date.now().toString(),
      text: newGoalText,
      target: newGoalTarget ? parseInt(newGoalTarget.replace(/,/g, '')) : undefined,
      current: 0,
      completed: false,
    };
    
    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    localStorage.setItem('myGoals', JSON.stringify(updatedGoals));
    saveProfileToSupabase({ my_goals: updatedGoals });
    setNewGoalText("");
    setNewGoalTarget("");
  };
  
  const handleUpdateGoalProgress = (goalId: string, newCurrent: number) => {
    const updatedGoals = goals.map(goal => {
      if (goal.id === goalId) {
        const updated = { ...goal, current: newCurrent };
        // Auto-complete if target reached
        if (goal.target && newCurrent >= goal.target) {
          updated.completed = true;
        }
        return updated;
      }
      return goal;
    });
    setGoals(updatedGoals);
    localStorage.setItem('myGoals', JSON.stringify(updatedGoals));
    saveProfileToSupabase({ my_goals: updatedGoals });
  };
  
  const handleToggleGoal = (goalId: string) => {
    const updatedGoals = goals.map(goal => 
      goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
    );
    setGoals(updatedGoals);
    localStorage.setItem('myGoals', JSON.stringify(updatedGoals));
    saveProfileToSupabase({ my_goals: updatedGoals });
  };
  
  const handleDeleteGoal = (goalId: string) => {
    const updatedGoals = goals.filter(goal => goal.id !== goalId);
    setGoals(updatedGoals);
    localStorage.setItem('myGoals', JSON.stringify(updatedGoals));
    saveProfileToSupabase({ my_goals: updatedGoals });
  };
  
  const getGoalProgress = (goal: Goal) => {
    if (!goal.target || !goal.current) return 0;
    return Math.min(100, (goal.current / goal.target) * 100);
  };

  // Get completed achievements based on user data
  const getCompletedAchievements = () => {
    const completed: typeof achievementsList = [];
    
    // Check streak achievements (7-day streak, Consistency is Key)
    const streakData = localStorage.getItem('streakData');
    let currentStreak = 0;
    if (streakData) {
      try {
        const parsed = JSON.parse(streakData);
        currentStreak = parsed.currentStreak || 0;
      } catch {}
    }
    
    // Also check dashboard streak
    const dashboardStreak = parseInt(localStorage.getItem('dashboardCurrentStreak') || '0');
    currentStreak = Math.max(currentStreak, dashboardStreak);
    
    if (currentStreak >= 7) {
      completed.push(achievementsList.find(a => a.id === 1)!); // 7-Day Streak
      completed.push(achievementsList.find(a => a.id === 3)!); // Consistency is Key
    }
    
    // Check step achievements (Big Stepper - 10,000 steps)
    // Check from day goals
    let hasReached10kSteps = false;
    const dayGoalsData = localStorage.getItem('myDayGoals');
    if (dayGoalsData) {
      try {
        const goals = JSON.parse(dayGoalsData);
        Object.values(goals).forEach((dayGoals: any) => {
          (dayGoals || []).forEach((goal: any) => {
            if (goal.text?.toLowerCase().includes('step') && goal.current >= 10000) {
              hasReached10kSteps = true;
            }
          });
        });
      } catch {}
    }
    
    // Also check weekly data for steps
    const weeklyData = localStorage.getItem('dashboardWeeklyData');
    if (weeklyData) {
      try {
        const data = JSON.parse(weeklyData);
        Object.values(data).forEach((dayData: any) => {
          if (dayData?.steps >= 10000) {
            hasReached10kSteps = true;
          }
        });
      } catch {}
    }
    
    if (hasReached10kSteps) {
      completed.push(achievementsList.find(a => a.id === 2)!); // Big Stepper
    }
    
    // 1kg Club: at least 1 kg lost vs acclimation baseline (signed delta <= -1)
    if (getWeightPhaseDeltaKg() <= -1) {
      completed.push(achievementsList.find(a => a.id === 4)!); // 1kg Club
    }
    
    // Check 30-day streak
    if (currentStreak >= 30) {
      completed.push(achievementsList.find(a => a.id === 5)!); // 30-Day Challenge
    }
    
    return completed.filter(Boolean);
  };

  // Get today's steps from dashboard
  const getTodaySteps = () => {
    const today = new Date().toISOString().split('T')[0];
    const dailyEntries = localStorage.getItem('dailyEntries');
    if (dailyEntries) {
      try {
        const entries = JSON.parse(dailyEntries);
        const todayEntry = entries[today];
        return todayEntry?.steps || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Handle profile photo upload
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      
      // Convert to base64 for localStorage (for demo purposes)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfilePhoto(base64String);
        localStorage.setItem('profilePhoto', base64String);
        saveProfileToSupabase({ profile_photo: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  // Format number with commas
  const formatNumberWithCommas = (value: string) => {
    // Remove all non-digit characters
    const numericValue = value.replace(/[^0-9]/g, '');
    // Convert to number and format with commas
    if (numericValue) {
      const num = parseInt(numericValue, 10);
      if (num > 999999999) return '999,999,999';
      return num.toLocaleString();
    }
    return '';
  };

  // Format numbers within free text (e.g., "Walk 10000 steps" → "Walk 10,000 steps")
  const formatNumbersInText = (text: string) => {
    // First strip existing commas within number groups to avoid double-formatting
    const stripped = text.replace(/(\d),(\d)/g, '$1$2');
    // Then find all number sequences and format them
    return stripped.replace(/\d+/g, (match) => {
      const num = parseInt(match, 10);
      return num >= 1000 ? num.toLocaleString() : match;
    });
  };

  // Parse formatted number back to plain number
  const parseFormattedNumber = (value: string) => {
    return value.replace(/,/g, '');
  };

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <BackButton />

      {/* Profile Header */}
      <section className="text-center space-y-4">
        <div className="relative w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-primary/30 p-1 bg-gradient-to-br from-primary/20 to-accent/20">
          <Avatar className="w-full h-full rounded-xl">
            <AvatarImage src={profilePhoto || "/placeholder-avatar.jpg"} alt="Profile" className="object-cover" />
            <AvatarFallback className="text-2xl rounded-xl">{(userName.firstName?.[0] || '') + (userName.lastName?.[0] || '') || 'U'}</AvatarFallback>
          </Avatar>
          {activePlan !== 'free' && (
            <span className="absolute bottom-2 right-2 bg-green-400 text-[#0A0A0A] text-[10px] font-black px-2 py-0.5 rounded-sm uppercase">PRO</span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 left-1 h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MaterialIcon name="photo_camera" size="sm" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload photo</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
          />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">
            {userName.firstName && userName.lastName
              ? `${userName.firstName} ${userName.lastName}`
              : userName.firstName || userName.lastName || 'User'}
          </h2>
          <div className="mt-1 flex items-center justify-center gap-2">
            <p className="text-on-surface-variant text-xs italic uppercase tracking-widest">
              {profileDescription || "Tell us about yourself..."}
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setTempDescription(profileDescription);
                      setShowDescriptionPopup(true);
                    }}
                  >
                    <MaterialIcon name="edit" size="xs" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit profile description</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-container-low p-4 rounded-sm border-l-2 border-primary text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
          <span className="block text-2xl font-black text-primary">{getCompletedAchievements().length}</span>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">Badges</span>
        </div>
        <div className="bg-surface-container-low p-4 rounded-sm border-l-2 border-accent text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
          <span className="block text-2xl font-black text-accent">
            {weightUnit === "lbs"
              ? (() => {
                  const kg = getWeightPhaseDeltaKg();
                  const lbs = kg * 2.20462;
                  const eps = 1e-9;
                  if (Math.abs(lbs) < eps) return `0 ${weightUnit}`;
                  if (lbs < 0) return `-${formatKgFullPrecision(Math.abs(lbs))}${weightUnit}`;
                  return `+${formatKgFullPrecision(lbs)}${weightUnit}`;
                })()
              : `${weightLossToDate} ${weightUnit}`}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">Weight change</span>
        </div>
        <div className="bg-surface-container-low p-4 rounded-sm border-l-2 border-green-400 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
          <span className="block text-2xl font-black text-green-400">{badgeData.currentStreak}</span>
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">Streak</span>
        </div>
      </div>

      {/* Completed Achievement Icons */}
      {(() => {
        const completedAchievements = getCompletedAchievements();
        if (completedAchievements.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 justify-center">
            {completedAchievements.map((achievement) => (
              <TooltipProvider key={achievement.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`w-8 h-8 rounded-full ${achievement.bgColor} flex items-center justify-center cursor-pointer hover:scale-110 transition-transform`}>
                      <MaterialIcon name={achievement.icon} size="sm" className={achievement.color} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{achievement.title}</p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        );
      })()}

      {/* My Why Card */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">My Why</h3>
        <div className="bg-surface-container-low p-8 rounded-sm border-l-4 border-primary relative transition-all duration-300 hover:shadow-card hover:-translate-y-1">
          <p className="text-xl font-medium leading-relaxed italic text-on-surface relative z-10">
            "{myWhy}"
          </p>
          <button
            className="mt-4 flex items-center text-primary text-xs font-bold uppercase tracking-widest"
            onClick={() => {
              setTempMyWhy(myWhy);
              setShowMyWhyPopup(true);
            }}
          >
            <MaterialIcon name="edit" size="xs" className="mr-1" /> Edit Statement
          </button>
        </div>
      </section>

      {/* Daily Goals Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">Daily Goals</h3>
          <button className="text-primary" onClick={() => setShowGoalsPopup(true)}>
            <MaterialIcon name="add_circle" size="md" />
          </button>
        </div>
        <div className="space-y-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="bg-surface-container-low border border-outline-variant rounded-sm overflow-hidden transition-all duration-300 hover:shadow-card">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-container-high transition-colors"
                onClick={() => setEditingDay(day)}
              >
                <h4 className="font-bold text-sm">{day}</h4>
                <span className="text-xs text-on-surface-variant">{(dayGoals[day] || []).length} goals</span>
              </div>
              {(dayGoals[day] || []).length > 0 && (
                <div className="px-4 pb-3 space-y-1">
                  {(dayGoals[day] || []).map((goal) => (
                    <div key={goal.id} className={`flex items-center justify-between p-2 rounded-sm ${goal.completed ? 'border border-primary/30' : 'border border-outline-variant'}`}>
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-sm flex items-center justify-center cursor-pointer ${goal.completed ? 'bg-primary' : 'border-2 border-outline-variant'}`}
                          onClick={() => {
                            const updatedDayGoals = {
                              ...dayGoals,
                              [day]: (dayGoals[day] || []).map((g) => {
                                if (g.id !== goal.id) return g;
                                const nextCompleted = !g.completed;
                                let nextCurrent = g.current ?? 0;
                                if (nextCompleted && g.target != null) {
                                  nextCurrent = g.target;
                                }
                                return {
                                  ...g,
                                  completed: nextCompleted,
                                  current: nextCurrent,
                                };
                              }),
                            };
                            setDayGoals(updatedDayGoals);
                            localStorage.setItem('myDayGoals', JSON.stringify(updatedDayGoals));
                            saveProfileToSupabase({ my_day_goals: updatedDayGoals });
                          }}
                        >
                          {goal.completed && <MaterialIcon name="check" size="xs" className="text-[#0A0A0A]" />}
                        </div>
                        <span className={`text-sm font-medium ${goal.completed ? 'line-through text-on-surface-variant' : ''}`}>
                          {formatNumbersInText(goal.text)}
                        </span>
                      </div>
                      {goal.target !== undefined && (
                        <span className="text-xs text-on-surface-variant">
                          {formatNumberWithCommas((goal.current || 0).toString())}/{formatNumberWithCommas(goal.target.toString())}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap gap-4 justify-center pt-4">
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
          <MaterialIcon name="trending_up" size="sm" />
          Go to my Dashboard
        </Button>
        <Button variant="outline" onClick={() => navigate('/community-help')} className="gap-2">
          <MaterialIcon name="gps_fixed" size="sm" />
          Go to my Community
        </Button>
        <Button variant="outline" onClick={() => navigate('/achievements')} className="gap-2">
          <MaterialIcon name="emoji_events" size="sm" />
          Go to my Achievements
        </Button>
      </div>

      {/* Profile Description Popup */}
      <AlertDialog open={showDescriptionPopup} onOpenChange={setShowDescriptionPopup}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Edit Profile Description</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Tell us a bit about yourself, hobbies, interests, lifestyle, goals...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={tempDescription}
              onChange={(e) => setTempDescription(e.target.value)}
              placeholder="I'm passionate about fitness and love trying new workout routines..."
              className="min-h-[150px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {tempDescription.length}/1,000
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDescription}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* My Why Popup */}
      <AlertDialog open={showMyWhyPopup} onOpenChange={setShowMyWhyPopup}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Edit My Why</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              What motivates you? Why are you on this fitness journey?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={tempMyWhy}
              onChange={(e) => setTempMyWhy(e.target.value)}
              placeholder="Enter your motivation and goals..."
              className="min-h-[200px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {tempMyWhy.length}/1,000
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveMyWhy}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Goals Popup - Day Selection */}
      <AlertDialog open={showGoalsPopup} onOpenChange={setShowGoalsPopup}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Edit My Goals</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Select a day to add or edit goals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
            {daysOfWeek.map((day) => (
              <Button
                key={day}
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  setEditingDay(day);
                  setShowGoalsPopup(false);
                }}
              >
                <span>{day}</span>
                <span className="text-xs text-muted-foreground">
                  {(dayGoals[day] || []).length} goals
                </span>
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Day Goals Popup */}
      <AlertDialog open={!!editingDay} onOpenChange={(open) => !open && setEditingDay(null)}>
        <AlertDialogContent className="bg-surface-container-lowest text-on-surface border-outline-variant rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Goals for {editingDay}</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              Add, edit, update or remove your goals for this day.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {editingDay && (dayGoals[editingDay] || []).map((goal) => (
              <div key={goal.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={goal.completed ? 'line-through text-muted-foreground' : ''}>{formatNumbersInText(goal.text)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => editingDay && handleDeleteDayGoal(editingDay, goal.id)}
                  >
                    <MaterialIcon name="delete" size="sm" />
                  </Button>
                </div>
                {goal.target !== undefined && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Update:</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberWithCommas((goal.current || 0).toString())}
                      onChange={(e) => {
                        if (!editingDay) return;
                        const rawValue = parseFormattedNumber(e.target.value);
                        const numValue = parseInt(rawValue) || 0;
                        handleUpdateDayGoalProgress(editingDay, goal.id, Math.min(999999999, numValue));
                      }}
                      className="h-8 w-28"
                    />
                    <span className="text-xs text-muted-foreground">/ {formatNumberWithCommas(goal.target.toString())}</span>
                    {goal.completed && <span className="text-xs text-green-500">Goal reached!</span>}
                    {!goal.completed && goal.target && goal.current !== undefined && goal.current > 0 && (
                      <span className="text-xs text-primary">
                        {(() => {
                          const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100));
                          const remaining = goal.target - goal.current;
                          if (percentage >= 100) return 'Goal reached!';
                          if (remaining <= 10) return `${remaining.toLocaleString()} more to go!`;
                          return `Keep going, you're ${percentage}% complete!`;
                        })()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium">Add New Goal</h4>
              <div className="space-y-2">
                <Label>Goal</Label>
                <Input
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(formatNumbersInText(e.target.value))}
                  placeholder="e.g., Walk 10,000 steps..."
                />
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(formatNumberWithCommas(e.target.value))}
                  placeholder="Enter a number"
                />
              </div>
              <Button
                onClick={() => editingDay && handleAddDayGoal(editingDay)}
                className="w-full gap-2"
              >
                <MaterialIcon name="add" size="sm" />
                Add Goal
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setEditingDay(null)}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
