import { Grade, gradeToNumeric, numericToGrade } from './grade.enum';

describe('gradeToNumeric', () => {
  it('maps each grade to its documented numeric value', () => {
    expect(gradeToNumeric(Grade.UNWILLING)).toBe(0);
    expect(gradeToNumeric(Grade.JUNIOR)).toBe(1);
    expect(gradeToNumeric(Grade.JUNIOR_PLUS)).toBe(2);
    expect(gradeToNumeric(Grade.MIDDLE)).toBe(3);
    expect(gradeToNumeric(Grade.MIDDLE_PLUS)).toBe(4);
    expect(gradeToNumeric(Grade.SENIOR)).toBe(5);
    expect(gradeToNumeric(Grade.LEAD)).toBe(6);
  });
});

describe('numericToGrade', () => {
  it('is the inverse of gradeToNumeric for every grade', () => {
    for (const grade of Object.values(Grade)) {
      expect(numericToGrade(gradeToNumeric(grade))).toBe(grade);
    }
  });

  it('throws for a numeric value with no matching grade', () => {
    expect(() => numericToGrade(99)).toThrow('No grade defined for numeric value 99');
  });
});
