/**
 * Witness provider for the leaderboard contract.
 * Witnesses return [newPrivateState, value] tuples.
 */

let _customName = new Uint8Array(32);

export const setCustomName = (name: string): void => {
  _customName = new Uint8Array(32);
  _customName.set(new TextEncoder().encode(name).slice(0, 32));
};

export const createWitnesses = () => ({
  getCustomName: ({ privateState }: any) => [privateState, _customName],
});
