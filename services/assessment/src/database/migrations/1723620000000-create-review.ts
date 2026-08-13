import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReview1723620000000 implements MigrationInterface {
  name = 'CreateReview1723620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "questionnaire_id" uuid NOT NULL REFERENCES "assessment"."questionnaires"("id"),
        "employee_email" varchar NOT NULL,
        "lead_email" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "review_id" uuid NOT NULL REFERENCES "assessment"."reviews"("id"),
        "type" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "submitted_at" timestamptz,
        UNIQUE ("review_id", "type")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."assessments"`);
    await queryRunner.query(`DROP TABLE "assessment"."reviews"`);
  }
}
