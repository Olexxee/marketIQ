import OpenAI from "openai";
import {env} from "./env"

const apiKey = env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured");
}

const openai = new OpenAI({
  apiKey,
});

export default openai;
