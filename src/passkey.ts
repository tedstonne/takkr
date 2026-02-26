import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { challenges, origin, rpID, rpName } from "@/config";
import type * as User from "@/user";

export type Authentication = {
  counter: number;
};

export const challenge = async (
  username: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> => {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userDisplayName: username,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  challenges.set(username, options.challenge);

  return options;
};

export const register = async (
  username: string,
  response: RegistrationResponseJSON,
  expected: string,
): Promise<User.Record> => {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: expected,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo)
    throw new Error("Verification failed");

  const { credential } = verification.registrationInfo;

  const user: User.Record = {
    username,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey),
    counter: credential.counter,
    font: "caveat",
    preferred_color: "yellow",
    preferred_background: "grid",
    display_name: "",
    email: "",
    avatar: "",
  };

  return user;
};

export const options = async (
  id: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> => {
  const result = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id }],
  });

  challenges.set(id, result.challenge);

  return result;
};

// Discoverable login - browser shows all available passkeys for this site
export const discover =
  async (): Promise<PublicKeyCredentialRequestOptionsJSON> => {
    const result = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });

    challenges.set(result.challenge, result.challenge);

    return result;
  };

export const authenticate = async (
  user: User.Record,
  response: AuthenticationResponseJSON,
  expected: string,
): Promise<Authentication> => {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: expected,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: user.credential_id,
      publicKey: new Uint8Array(user.public_key),
      counter: user.counter,
    },
  });

  if (!verification.verified) throw new Error("Verification failed");

  return { counter: verification.authenticationInfo.newCounter };
};
