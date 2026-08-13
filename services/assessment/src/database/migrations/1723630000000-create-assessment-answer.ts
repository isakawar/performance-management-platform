import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssessmentAnswer1723630000000 implements MigrationInterface {
  name = 'CreateAssessmentAnswer1723630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."assessment_answers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL REFERENCES "assessment"."assessments"("id"),
        "competency_id" uuid NOT NULL REFERENCES "assessment"."competencies"("id"),
        "grade" varchar NOT NULL,
        "comment" varchar,
        "evidence" varchar,
        UNIQUE ("assessment_id", "competency_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."assessment_answers"`);
  }
}
