import "dotenv/config"; // MUST BE THE FIRST IMPORT
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        // Gracefully injects the production string from Railway or local env
        url: env("DATABASE_URL"),
    },
});