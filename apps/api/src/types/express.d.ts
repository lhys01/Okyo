declare global {
  namespace Express {
    interface Request {
      auth?: Readonly<{
        userId: string;
      }>;
      scanContext?: Readonly<{
        requestId: string;
        ingressStartedAt: number;
      }>;
    }
  }
}

export {};
