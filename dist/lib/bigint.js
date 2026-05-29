"use strict";
// Prisma mengembalikan kolom BigInt (saldo, nominal) sebagai BigInt JS.
// JSON.stringify tidak bisa serialisasi BigInt secara default, jadi kita
// serialisasi sebagai string agar nilai besar tidak kehilangan presisi.
BigInt.prototype.toJSON = function () {
    return this.toString();
};
