import app from "./src/index";

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
