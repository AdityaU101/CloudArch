import OpenAI from "openai";

const apiKey = process.env["GROQ_API_KEY"];
const baseURL = "https://api.groq.com/openai/v1";

if (!apiKey) {
  throw new Error(
    "GROQ_API_KEY environment variable is required but was not set. Add it to your Replit Secrets.",
  );
}

export const groq = new OpenAI({
  apiKey,
  baseURL,
});

export const GROQ_MODEL = "llama-3.3-70b-versatile";
