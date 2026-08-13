import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFramework1723600000000 implements MigrationInterface {
  name = 'CreateFramework1723600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "assessment"`);
    await queryRunner.query(`
      CREATE TABLE "assessment"."frameworks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "framework_id" uuid NOT NULL REFERENCES "assessment"."frameworks"("id"),
        "name" varchar NOT NULL,
        "order_index" int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."competencies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL REFERENCES "assessment"."categories"("id"),
        "name" varchar NOT NULL,
        "description" varchar,
        "weight" numeric NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "assessment"."competency_grade_expectations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "competency_id" uuid NOT NULL REFERENCES "assessment"."competencies"("id"),
        "grade" varchar NOT NULL,
        "description" varchar NOT NULL,
        UNIQUE ("competency_id", "grade")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assessment"."competency_grade_expectations"`);
    await queryRunner.query(`DROP TABLE "assessment"."competencies"`);
    await queryRunner.query(`DROP TABLE "assessment"."categories"`);
    await queryRunner.query(`DROP TABLE "assessment"."frameworks"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "assessment" CASCADE`);
  }
}
