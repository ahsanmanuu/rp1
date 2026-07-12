import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      points: number;
      theme: string;
      membership: string;
    } & DefaultSession["user"];
  }

  interface User {
    points: number;
    theme: string;
    membership: string;
  }
}
