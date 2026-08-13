import { BadRequestException } from '@nestjs/common';

export interface CreateFrameworkDto {
  name: string;
}
export function parseCreateFrameworkDto(body: unknown): CreateFrameworkDto {
  const name = (body as Partial<CreateFrameworkDto> | undefined)?.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  return { name: name.trim() };
}

export interface CreateCategoryDto {
  name: string;
  orderIndex: number;
}
export function parseCreateCategoryDto(body: unknown): CreateCategoryDto {
  const candidate = body as Partial<CreateCategoryDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  const orderIndex = typeof candidate.orderIndex === 'number' ? candidate.orderIndex : 0;
  return { name: candidate.name.trim(), orderIndex };
}

export interface GradeExpectationInput {
  grade: string;
  description: string;
}
export interface CreateCompetencyDto {
  name: string;
  description?: string;
  weight: number;
  gradeExpectations: GradeExpectationInput[];
}
export function parseCreateCompetencyDto(body: unknown): CreateCompetencyDto {
  const candidate = body as Partial<CreateCompetencyDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  const weight = typeof candidate.weight === 'number' ? candidate.weight : 1;
  const gradeExpectations = Array.isArray(candidate.gradeExpectations)
    ? candidate.gradeExpectations.filter(
        (entry): entry is GradeExpectationInput =>
          typeof entry?.grade === 'string' && typeof entry?.description === 'string',
      )
    : [];
  return {
    name: candidate.name.trim(),
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    weight,
    gradeExpectations,
  };
}
