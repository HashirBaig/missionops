const dev = {
  API_URL: "http://localhost:5000/api",
};

const prod = {
  API_URL: "https://slimprep-core.vercel.app/api",
};

const config = import.meta.env.MODE === "production" ? prod : dev;

export default config;
