export enum Grade {
  UNWILLING = 'UNWILLING',
  JUNIOR = 'JUNIOR',
  JUNIOR_PLUS = 'JUNIOR+',
  MIDDLE = 'MIDDLE',
  MIDDLE_PLUS = 'MIDDLE+',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

const GRADE_NUMERIC_VALUE: Record<Grade, number> = {
  [Grade.UNWILLING]: 0,
  [Grade.JUNIOR]: 1,
  [Grade.JUNIOR_PLUS]: 2,
  [Grade.MIDDLE]: 3,
  [Grade.MIDDLE_PLUS]: 4,
  [Grade.SENIOR]: 5,
  [Grade.LEAD]: 6,
};

export function gradeToNumeric(grade: Grade): number {
  return GRADE_NUMERIC_VALUE[grade];
}

export function numericToGrade(value: number): Grade {
  const match = (Object.entries(GRADE_NUMERIC_VALUE) as [Grade, number][]).find(
    ([, numeric]) => numeric === value,
  );
  if (!match) {
    throw new Error(`No grade defined for numeric value ${value}`);
  }
  return match[0];
}
