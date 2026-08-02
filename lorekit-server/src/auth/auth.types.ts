export type AccessTokenPayload = {
  sub: string;
  sid: string;
  ver: number;
  typ: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
};

export type AuthenticatedRequest = {
  userId: string;
  sessionId: string;
  deviceId: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  deviceId: string;
};
