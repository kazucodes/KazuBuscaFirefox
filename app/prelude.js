// Garante um Set global compartilhado por qualquer código legado que use 'excluded'
if (!(globalThis.excluded instanceof Set)) {
  globalThis.excluded = new Set();
}
