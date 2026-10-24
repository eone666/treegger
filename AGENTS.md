# Code Guidelines

- Write the library source in TypeScript under `src/`.
- Keep TypeScript strict mode enabled and provide types for the public API and internal code.
- Do not use `any`, including implicit `any`.
- Do not bypass the type system with double assertions such as `as unknown as SomeType`.
- Generate JavaScript and declaration files from the TypeScript source. Do not maintain handwritten `.d.ts` files for library code.
