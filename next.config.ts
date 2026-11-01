import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  ...(process.env.RAINCHECK_RUNTIME === "cloudflare" ? {} : {
    webpack(config: Parameters<NonNullable<NextConfig["webpack"]>>[0], context: Parameters<NonNullable<NextConfig["webpack"]>>[1]) {
      config.plugins.push(new context.webpack.NormalModuleReplacementPlugin(
        /(?:^|[\\/])lib[\\/]server(?:\.ts)?$/,
        path.resolve(process.cwd(), "lib/server-vercel.ts"),
      ));
      return config;
    },
  }),
};

export default nextConfig;
