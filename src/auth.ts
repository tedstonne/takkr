import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { challenges } from "@/config";
import * as passkey from "@/passkey";
import * as session from "@/session";
import * as User from "@/user";

export enum ErrorCode {
  USERNAME_TAKEN,
  USER_NOT_FOUND,
  CHALLENGE_NOT_FOUND,
}

export const ERRORS = {
  [ErrorCode.USERNAME_TAKEN]: {
    status: 409,
    message: "Username taken",
  },
  [ErrorCode.USER_NOT_FOUND]: {
    status: 404,
    message: "User not found",
  },
  [ErrorCode.CHALLENGE_NOT_FOUND]: {
    status: 400,
    message: "Challenge not found",
  },
} as const;

export const register = async (
  username: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> => {
  if (User.exists(username)) throw new Error(String(ErrorCode.USERNAME_TAKEN));

  const options = await passkey.challenge(username);

  return options;
};

export const verify = async (
  username: string,
  credential: RegistrationResponseJSON,
): Promise<string> => {
  const expected: string | undefined = challenges.get(username);
  if (!expected) throw new Error(String(ErrorCode.CHALLENGE_NOT_FOUND));

  const user: User.Record = await passkey.register(
    username,
    credential,
    expected,
  );

  User.create(user);
  challenges.delete(username);

  return session.create(username);
};

export const challenge = async (
  username: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> => {
  const user: User.Record | null = User.find(username);
  if (!user) throw new Error(String(ErrorCode.USER_NOT_FOUND));

  const result = await passkey.options(user.credential_id);

  return result;
};

export const authenticate = async (
  username: string,
  credential: AuthenticationResponseJSON,
): Promise<string> => {
  const user: User.Record | null = User.find(username);
  if (!user) throw new Error(String(ErrorCode.USER_NOT_FOUND));

  const expected: string | undefined = challenges.get(user.credential_id);
  if (!expected) throw new Error(String(ErrorCode.CHALLENGE_NOT_FOUND));

  const result: passkey.Authentication = await passkey.authenticate(
    user,
    credential,
    expected,
  );

  User.touch(username, result.counter);
  challenges.delete(user.credential_id);

  return session.create(username);
};

// Discoverable login - no username required upfront
export const discover =
  async (): Promise<PublicKeyCredentialRequestOptionsJSON> => {
    const options = await passkey.discover();

    return options;
  };

// Verify discoverable login - lookup user by credential ID
export const identify = async (
  credential: AuthenticationResponseJSON,
): Promise<{ session: string; username: string }> => {
  const user: User.Record | null = User.identify(credential.id);
  if (!user) throw new Error(String(ErrorCode.USER_NOT_FOUND));

  // Extract challenge from clientDataJSON
  const clientData: string = atob(credential.response.clientDataJSON);
  const { challenge } = JSON.parse(clientData);
  const expected: string | undefined = challenges.get(challenge);
  if (!expected) throw new Error(String(ErrorCode.CHALLENGE_NOT_FOUND));

  const result: passkey.Authentication = await passkey.authenticate(
    user,
    credential,
    expected,
  );

  User.touch(user.username, result.counter);
  challenges.delete(challenge);

  return { session: session.create(user.username), username: user.username };
};
