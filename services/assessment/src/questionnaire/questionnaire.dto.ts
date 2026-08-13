import { BadRequestException } from '@nestjs/common';

export interface CreateQuestionnaireDto {
  name: string;
  direction: string;
  frameworkId: string;
}
export function parseCreateQuestionnaireDto(body: unknown): CreateQuestionnaireDto {
  const candidate = body as Partial<CreateQuestionnaireDto> | undefined;
  if (typeof candidate?.name !== 'string' || candidate.name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  if (typeof candidate?.direction !== 'string' || candidate.direction.trim().length === 0) {
    throw new BadRequestException('direction is required');
  }
  if (typeof candidate?.frameworkId !== 'string' || candidate.frameworkId.length === 0) {
    throw new BadRequestException('frameworkId is required');
  }
  return { name: candidate.name.trim(), direction: candidate.direction.trim(), frameworkId: candidate.frameworkId };
}
