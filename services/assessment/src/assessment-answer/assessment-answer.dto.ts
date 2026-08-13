import { BadRequestException } from '@nestjs/common';

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
    return {
      competencyId: entry.competencyId,
      grade: entry.grade,
      comment: typeof entry.comment === 'string' ? entry.comment : undefined,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : undefined,
    };
  });
  return { answers };
}
