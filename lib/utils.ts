// shadcn's CLI expects a local module for its `utils` alias. Pointing the alias
// straight at the tailwind-variants package made it install an unrelated npm
// package named "cn" on every `shadcn add`.
export { cn } from 'tailwind-variants';
