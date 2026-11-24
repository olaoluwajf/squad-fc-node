const required = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing environment variable ${key}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 8787),
  prod: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "1",
  sessionSecret: new TextEncoder().encode(required("SESSION_SECRET")),
};
