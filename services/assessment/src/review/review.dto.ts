import { BadRequestException } from '@nestjs/common';

export interface CreateReviewDto {
  questionnaireId: string;
  employeeEmail: string;
  leadEmail: string;
}
export function parseCreateReviewDto(body: unknown): CreateReviewDto {
  const candidate = body as Partial<CreateReviewDto> | undefined;
  if (typeof candidate?.questionnaireId !== 'string' || candidate.questionnaireId.length === 0) {
    throw new BadRequestException('questionnaireId is required');
  }
  if (typeof candidate?.employeeEmail !== 'string' || candidate.employeeEmail.length === 0) {
    throw new BadRequestException('employeeEmail is required');
  }
  if (typeof candidate?.leadEmail !== 'string' || candidate.leadEmail.length === 0) {
    throw new BadRequestException('leadEmail is required');
  }
  return { questionnaireId: candidate.questionnaireId, employeeEmail: candidate.employeeEmail, leadEmail: candidate.leadEmail };
}
