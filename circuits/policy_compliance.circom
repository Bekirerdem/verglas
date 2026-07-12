pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/mux1.circom";

// Verglas circuit #1 — policy compliance over a Poseidon spend chain.
//
// Proves: starting from initialCommitment, folding `txCount` spends
// (leaf = Poseidon(to, amount); c = Poseidon(c_prev, leaf)) yields
// finalCommitment, AND every folded spend went to a whitelisted destination
// with amount <= perTxLimit. Individual (to, amount) pairs stay private.
//
// Completeness comes from the chain itself: finalCommitment is read from the
// VerglasAccount contract, and Poseidon's collision resistance forces the
// witness to be the one true ordered spend list. The Hub additionally checks
// that the public txCount equals the contract's txCount delta.
template PolicyCompliance(N, WL) {
    // ---- public ----
    signal input initialCommitment;
    signal input finalCommitment;
    signal input txCount; // number of real spends in this window (<= N)
    signal input whitelist[WL]; // pad unused slots with 0 (contract forbids 0-address)
    signal input perTxLimit;

    // ---- private ----
    signal input to[N];
    signal input amount[N];

    // txCount <= N, otherwise spends beyond N could be hidden
    component txCountOk = LessEqThan(16);
    txCountOk.in[0] <== txCount;
    txCountOk.in[1] <== N;
    txCountOk.out === 1;

    component isActive[N];
    component amountBits[N];
    component amountOk[N];
    component leaf[N];
    component fold[N];
    component step[N];
    component eq[N][WL];

    signal chain[N + 1];
    signal membership[N];
    chain[0] <== initialCommitment;

    for (var i = 0; i < N; i++) {
        // isActive = (i < txCount); padding rows carry the chain unchanged
        isActive[i] = LessThan(16);
        isActive[i].in[0] <== i;
        isActive[i].in[1] <== txCount;

        // fold the spend into the chain
        leaf[i] = Poseidon(2);
        leaf[i].inputs[0] <== to[i];
        leaf[i].inputs[1] <== amount[i];
        fold[i] = Poseidon(2);
        fold[i].inputs[0] <== chain[i];
        fold[i].inputs[1] <== leaf[i].out;

        step[i] = Mux1();
        step[i].c[0] <== chain[i];
        step[i].c[1] <== fold[i].out;
        step[i].s <== isActive[i].out;
        chain[i + 1] <== step[i].out;

        // amount fits 128 bits (guards the comparator's range assumption)
        amountBits[i] = Num2Bits(128);
        amountBits[i].in <== amount[i];

        // active => amount <= perTxLimit
        amountOk[i] = LessEqThan(128);
        amountOk[i].in[0] <== amount[i];
        amountOk[i].in[1] <== perTxLimit;
        isActive[i].out * (1 - amountOk[i].out) === 0;

        // active => to is one of the whitelist entries
        var msum = 0;
        for (var j = 0; j < WL; j++) {
            eq[i][j] = IsEqual();
            eq[i][j].in[0] <== to[i];
            eq[i][j].in[1] <== whitelist[j];
            msum += eq[i][j].out;
        }
        membership[i] <== msum;
        isActive[i].out * (1 - membership[i]) === 0;
    }

    finalCommitment === chain[N];
}

component main {
    public [initialCommitment, finalCommitment, txCount, whitelist, perTxLimit]
} = PolicyCompliance(64, 8);
