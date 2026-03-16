import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      aiEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    aiEnabled?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    aiEnabled: boolean;
  }
}
