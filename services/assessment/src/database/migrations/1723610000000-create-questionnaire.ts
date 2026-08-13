import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionnaire1723610000000 implements MigrationInterface {
  name = 'CreateQuestionnaire1723610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment"."questionnaires" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "direction" varchar NOT NULL,
        "framework_id" uuid NOT NULL REFERENCES "assessment"."frameworks"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."questionnaires"`);
  }
}
