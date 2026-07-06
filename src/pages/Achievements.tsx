import { MaterialIcon } from "@/components/ui/material-icon";
import { BackButton } from "@/components/BackButton";

const Achievements = () => {
  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500 max-w-md mx-auto">
      <BackButton />
      <header className="text-center space-y-3 py-8">
        <MaterialIcon name="emoji_events" size="lg" className="text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-on-surface">Achievements</h1>
        <p className="text-sm text-on-surface-variant">Coming Soon!</p>
        <p className="text-xs text-muted-foreground px-4">
          We are building badges and milestones for your Numi journey. This tab will unlock in a future update.
        </p>
      </header>
    </div>
  );
};

export default Achievements;
