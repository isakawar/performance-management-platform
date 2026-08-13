import { BadRequestException } from '@nestjs/common';
import { Grade } from '@pmp/shared';

const VALID_GRADES = new Set<string>(Object.values(Grade));

export interface AnswerInput {
  competencyId: string;
  grade: string;
  comment?: string;
  evidence?: string;
}
export interface SaveAnswersDto {
  answers: AnswerInput[];
}
export function parseSaveAnswersDto(body: unknown): SaveAnswersDto {
  const candidate = body as Partial<SaveAnswersDto> | undefined;
  if (!Array.isArray(candidate?.answers)) {
    throw new BadRequestException('answers must be an array');
  }
  const answers = candidate.answers.map((entry, index) => {
    if (typeof entry?.competencyId !== 'string' || typeof entry?.grade !== 'string') {
      throw new BadRequestException(`answers[${index}] must have competencyId and grade`);
    }
    if (!VALID_GRADES.has(entry.grade)) {
      throw new BadRequestException(`answers[${index}].grade must be one of: ${[...VALID_GRADES].join(', ')}`);
    }
    return {
      competencyId: entry.competencyId,
      grade: entry.grade,
      comment: typeof entry.comment === 'string' ? entry.comment : undefined,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : undefined,
    };
  });
  return { answers };
}
