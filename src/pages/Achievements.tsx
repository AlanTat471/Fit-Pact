import React, { useMemo } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BackButton } from "@/components/BackButton";
import { useUserData } from "@/contexts/UserDataContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const Achievements = () => {
  const { journey } = useUserData();

  const { accomplished, achievements } = useMemo(() => {
    let completedWeeks: Array<{ weekNumber: number; data: Record<string, { steps: number; calories: number; weight: number }>; averages?: { steps: number; calories: number; weight: number } }> = [];
    let acclimation: { week1?: Record<string, number>; week2?: Record<string, number>; week3?: Record<string, number>; week4?: Record<string, number> } = {};

    if (journey) {
      completedWeeks = (journey.completed_weeks ?? []) as typeof completedWeeks;
      acclimation = (journey.acclimation_data ?? { week1: {}, week2: {}, week3: {}, week4: {} }) as typeof acclimation;
    } else {
      try {
        const raw = localStorage.getItem("dashboardCompletedWeeks");
        if (raw) completedWeeks = JSON.parse(raw);
      } catch {}
      try {
        const raw = localStorage.getItem("dashboardAcclimationData");
        if (raw) acclimation = JSON.parse(raw);
      } catch {}
    }

    let actualWeightLost = 0;
    try {
      const acclimWeek1Vals = Object.values(acclimation.week1 || {}).filter((v: any) => v > 0) as number[];
      const acclimWeek2Vals = Object.values(acclimation.week2 || {}).filter((v: any) => v > 0) as number[];
      const acclimWeek3Vals = Object.values(acclimation.week3 || {}).filter((v: any) => v > 0) as number[];
      const acclimWeek4Vals = Object.values(acclimation.week4 || {}).filter((v: any) => v > 0) as number[];
      const allAcclimVals = [...acclimWeek1Vals, ...acclimWeek2Vals, ...acclimWeek3Vals, ...acclimWeek4Vals];
      if (allAcclimVals.length > 0 && completedWeeks.length > 0) {
        const acclimAvg = allAcclimVals.reduce((s, v) => s + v, 0) / allAcclimVals.length;
        const lastWeekAvg = completedWeeks[completedWeeks.length - 1]?.averages?.weight || 0;
        if (lastWeekAvg > 0) actualWeightLost = acclimAvg - lastWeekAvg;
      }
    } catch {}

    const currentWeeklyRaw =
      journey?.weekly_data ??
      (() => {
        try {
          const raw = localStorage.getItem("dashboardWeeklyData");
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      })();
    const weeksWithSteps = [
      ...completedWeeks.map((w) => w.data || {}),
      typeof currentWeeklyRaw === "object" && currentWeeklyRaw !== null ? currentWeeklyRaw : {},
    ].filter((d) => typeof d === "object" && d !== null);
    const allWeekDataForWeight: Array<Record<string, number | { steps?: number; weight?: number }>> = [
      ...(acclimation.week1 ? [acclimation.week1 as Record<string, number>] : []),
      ...(acclimation.week2 ? [acclimation.week2 as Record<string, number>] : []),
      ...(acclimation.week3 ? [acclimation.week3 as Record<string, number>] : []),
      ...(acclimation.week4 ? [acclimation.week4 as Record<string, number>] : []),
      ...completedWeeks.map((w) => (w.data || {}) as Record<string, { steps?: number; weight?: number }>),
    ];

    let totalDaysWithSteps = 0;
    let maxStepsInDay = 0;
    for (const week of weeksWithSteps) {
      for (const day of DAYS) {
        const d = (week as Record<string, { steps?: number; weight?: number }>)[day];
        if (d == null) continue;
        const steps = typeof d === "object" && d && "steps" in d ? Number((d as { steps: number }).steps) : 0;
        if (steps > 0) {
          totalDaysWithSteps += 1;
          if (steps > maxStepsInDay) maxStepsInDay = steps;
        }
      }
    }

    let totalDaysWithWeight = 0;
    for (const week of allWeekDataForWeight) {
      for (const day of DAYS) {
        const d = week[day];
        if (d == null) continue;
        const weight = typeof d === "object" && d && "weight" in d ? Number((d as { weight: number }).weight) : typeof d === "number" ? d : 0;
        if (weight > 0) totalDaysWithWeight += 1;
      }
    }

    const hasOneCompletedWeek = completedWeeks.length >= 1;
    const bigStepper = maxStepsInDay >= 10000;
    const oneKgClub = actualWeightLost >= 1;
    const thirtyDayChallenge = completedWeeks.length >= 4;
    const littleAchiever = totalDaysWithSteps >= 10;
    const weightWatcher = totalDaysWithWeight >= 14;
    const consistencyKing = completedWeeks.length >= 12;

    const accomplished = [
      hasOneCompletedWeek,
      bigStepper,
      hasOneCompletedWeek,
      oneKgClub,
      thirtyDayChallenge,
      littleAchiever,
      weightWatcher,
      consistencyKing,
    ];

    const achievements = [
      { id: 1, title: "7-Day Streak", description: "Completed a week of tracking", icon: "bolt" },
      { id: 2, title: "Big Stepper", description: "Walked 10,000 steps in a day", icon: "directions_walk" },
      { id: 3, title: "Consistency is Key", description: "Completed 7 day streak", icon: "check_circle" },
      { id: 4, title: "1kg Club", description: "Lose 1 kilogram", icon: "monitor_weight" },
      { id: 5, title: "30-Day Challenge", description: "Complete 30 consecutive days", icon: "event" },
      { id: 6, title: "Little Achiever", description: "Completed 10 goals", icon: "emoji_events" },
      { id: 7, title: "Weight Watcher", description: "Track your weight for 14 days straight", icon: "monitor_weight" },
      { id: 8, title: "Consistency King", description: "Complete all 12 weeks of weight loss", icon: "event" },
    ];

    return {
      accomplished,
      achievements: achievements.map((a, i) => ({
        ...a,
        accomplished: accomplished[i],
        color: accomplished[i] ? "text-primary" : "text-muted-foreground",
        bgColor: accomplished[i] ? "bg-primary/10" : "bg-muted/30",
      })),
    };
  }, [journey]);

  const accomplishedCount = achievements.filter((a) => a.accomplished).length;
  const totalCount = achievements.length;

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <BackButton />

      {/* Header with progress */}
      <header className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase flex items-center gap-2">
            My Achievements
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <MaterialIcon name="help_outline" size="xs" className="text-on-surface-variant cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Achievements unlock as you complete acclimation and weekly tracking milestones.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <div className="text-right">
            <span className="text-4xl font-black italic text-primary">{accomplishedCount}</span>
            <span className="text-xl font-black text-primary ml-1 italic">/ {totalCount}</span>
          </div>
        </div>
        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (accomplishedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <p className="text-sm text-on-surface-variant">
          Track your milestones and celebrate your progress.
          {accomplishedCount > 0 && (
            <> You have unlocked <span className="text-primary font-bold">{accomplishedCount}</span> achievement{accomplishedCount !== 1 ? 's' : ''}.</>
          )}
        </p>
      </header>

      {/* Recently Unlocked */}
      {achievements.filter((a) => a.accomplished).length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase flex items-center">
            <MaterialIcon name="local_fire_department" size="sm" className="text-accent mr-2" /> Recently Unlocked
          </h3>
          <div className="bg-surface-container-low p-6 rounded-sm border border-outline-variant space-y-4 transition-all duration-300 hover:shadow-card">
            {achievements
              .filter((a) => a.accomplished)
              .slice(0, 3)
              .map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-4 p-3 rounded-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface-container-high/50"
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${achievement.bgColor}`}>
                    <MaterialIcon name={achievement.icon} size="lg" className={achievement.color} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest">{achievement.title}</h4>
                    <p className="text-[10px] text-on-surface-variant uppercase mt-0.5">{achievement.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Collection Grid */}
      <section className="space-y-6">
        <h3 className="text-xl font-black italic tracking-tighter uppercase">Collection</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`bg-surface-container-low p-6 rounded-sm border border-outline-variant text-center space-y-4 flex flex-col items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card ${
                !achievement.accomplished ? "opacity-40" : ""
              }`}
            >
              <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
                achievement.accomplished ? "bg-surface-container-high" : "border-2 border-dashed border-outline"
              }`}>
                <MaterialIcon
                  name={achievement.accomplished ? achievement.icon : "lock"}
                  size="lg"
                  className={achievement.accomplished ? achievement.color : "text-outline"}
                />
              </div>
              <div>
                <h5 className="text-xs font-bold uppercase tracking-widest">{achievement.title}</h5>
                <p className="text-[9px] text-on-surface-variant mt-1 uppercase">{achievement.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Empty state */}
      {accomplishedCount === 0 && (
        <div className="bg-surface-container-low p-8 rounded-sm border border-outline-variant text-center">
          <MaterialIcon name="emoji_events" size="lg" className="text-outline mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant">Complete weeks and track steps & weight to unlock achievements.</p>
        </div>
      )}
    </div>
  );
};

export default Achievements;
