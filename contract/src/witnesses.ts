export type LeaderboardPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createLeaderboardPrivateState = (secretKey: Uint8Array): LeaderboardPrivateState => ({
  secretKey,
});

let _customName = new Uint8Array(32);

export const setCustomName = (name: string): void => {
  _customName = new Uint8Array(32);
  _customName.set(new TextEncoder().encode(name).slice(0, 32));
};

export const createWitnesses = () => ({
  localSecretKey: ({
    privateState,
  }: {
    privateState: LeaderboardPrivateState;
  }): [LeaderboardPrivateState, Uint8Array] => [privateState, privateState.secretKey],
  getCustomName: ({
    privateState,
  }: {
    privateState: LeaderboardPrivateState;
  }): [LeaderboardPrivateState, Uint8Array] => [privateState, _customName],
});
