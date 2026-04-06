/**
 * Shared TDEE / display snapshot from weight + profile — used after Maintenance Phase
 * and to keep Dashboard / TDEE page aligned with Workouts.tsx formulas.
 */

export interface TdeeSnapshotInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: string;
  activityLevel: string;
}

export interface TdeeSnapshotResult {
  values_json: Record<string, unknown>;
  starting_calorie_intake: string;
  suggested_weight_goal: string;
  current_weight: string;
  weight_to_lose: string;
}

const activityMultipliers: Record<string, number> = {
  sedentary: 1.2,
  "lightly-active": 1.375,
  "moderately-active": 1.55,
  "very-active": 1.725,
  "super-active": 1.9,
};

function calculateBMR(weight: number, height: number, age: number, gender: string) {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calculateBMI(weight: number, heightCm: number) {
  const h = heightCm / 100;
  return weight / (h * h);
}

/** Robinson (1983) ideal body weight from height — matches Workouts.tsx */
export function calculateIdealWeightCenterKg(heightCm: number, gender: string) {
  const totalInches = heightCm / 2.54;
  const inchesOver5ft = Math.max(0, totalInches - 60);
  const center =
    gender === "female" ? 49 + 1.7 * inchesOver5ft : 52 + 1.9 * inchesOver5ft;
  return center;
}

function getClassificationCategory(bmi: number) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function calculateEstimatedBodyFat(weight: number, height: number, age: number, gender: string) {
  const bmi = calculateBMI(weight, height);
  if (gender === "male") {
    return (1.2 * bmi) + (0.23 * age) - 16.2;
  }
  return (1.2 * bmi) + (0.23 * age) - 5.4;
}

/** Full TDEE row payload for saveTdee — mirrors Workouts.tsx values_json shape */
export function buildTdeeSnapshotFromMetrics(input: TdeeSnapshotInput): TdeeSnapshotResult {
  const { weightKg, heightCm, age, gender, activityLevel } = input;
  const mult = activityMultipliers[activityLevel] ?? 1.55;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const tdee = bmr * mult;
  const midWeight = calculateIdealWeightCenterKg(heightCm, gender);
  const weightToLose = Math.max(0, weightKg - midWeight);
  const currentBMI = calculateBMI(weightKg, heightCm);
  const yourClassification = getClassificationCategory(currentBMI);
  const estimatedBodyFat = calculateEstimatedBodyFat(weightKg, heightCm, age, gender);

  const values_json: Record<string, unknown> = {
    currentBMI: currentBMI.toFixed(1),
    bodyFatPercentage: estimatedBodyFat.toFixed(1),
    classification: yourClassification,
    currentWeight: weightKg.toFixed(1),
    weightToLose: weightToLose.toFixed(2),
    suggestedWeightGoal: midWeight.toFixed(2),
    height: heightCm.toString(),
  };

  return {
    values_json,
    starting_calorie_intake: tdee.toFixed(0),
    suggested_weight_goal: midWeight.toFixed(2),
    current_weight: weightKg.toFixed(1),
    weight_to_lose: weightToLose.toFixed(2),
  };
}
