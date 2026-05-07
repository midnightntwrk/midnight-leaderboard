import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  getCustomName(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  submitScore(context: __compactRuntime.CircuitContext<PS>,
              score_0: bigint,
              useCustomName_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  verifyOwnership(context: __compactRuntime.CircuitContext<PS>,
                  targetEntryId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEntryCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type ProvableCircuits<PS> = {
  submitScore(context: __compactRuntime.CircuitContext<PS>,
              score_0: bigint,
              useCustomName_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  verifyOwnership(context: __compactRuntime.CircuitContext<PS>,
                  targetEntryId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEntryCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submitScore(context: __compactRuntime.CircuitContext<PS>,
              score_0: bigint,
              useCustomName_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  verifyOwnership(context: __compactRuntime.CircuitContext<PS>,
                  targetEntryId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEntryCount(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
  scores: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { score: bigint,
                             displayName: Uint8Array,
                             ownerHash: Uint8Array
                           };
    [Symbol.iterator](): Iterator<[bigint, { score: bigint, displayName: Uint8Array, ownerHash: Uint8Array }]>
  };
  readonly nextId: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
