declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    ALCHEMY_API_KEY: string;
    RESEND_API_KEY: string;
  }
}
