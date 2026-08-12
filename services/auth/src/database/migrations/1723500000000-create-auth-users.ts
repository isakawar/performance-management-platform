import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthUsers1723500000000 implements MigrationInterface {
  name = 'CreateAuthUsers1723500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "auth"`);
    await queryRunner.query(`
      CREATE TABLE "auth"."auth_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "google_sub" varchar NOT NULL UNIQUE,
        "email" varchar NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth"."auth_users"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "auth"`);
  }
}
