import "reflect-metadata";
import { DataSource } from "typeorm";

export const TestDataSource = new DataSource({
  name: "test",
  type: "postgres",
  host: "db",
  port: 5432,
  username: "marsmadness",
  database: "pom_testing",
  password: "DB_PASSWORD",
  synchronize: false,
  logging: false,
  entities: ["database/entities/**/*.ts"],
  migrations: ["database/migrations/**/*.ts"],
});
