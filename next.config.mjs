/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEYNAR_API_KEY: process.env.NEYNAR_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    POSTGRES_URL: process.env.POSTGRES_URL,
  },
};

export default nextConfig;
