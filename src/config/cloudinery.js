import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js"; 

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

// Using your logger instead of console.log for better practice
console.info(`☁️ Cloudinary initialized for: ${cloudinary.config().cloud_name}`);

export default cloudinary;
