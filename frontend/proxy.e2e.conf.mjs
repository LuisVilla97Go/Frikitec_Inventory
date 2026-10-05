export default {
  "/api": {
    target: `http://127.0.0.1:${process.env.E2E_PUERTO_API ?? "5001"}`,
    secure: false,
    changeOrigin: false,
  },
};
