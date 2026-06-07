const TOKEN_KEY = 'techgen:token';

export const tokenStorage = {
   get(): string | null {
      try {
         return localStorage.getItem(TOKEN_KEY);
      } catch {
         return null;
      }
   },
   set(token: string): void {
      try {
         localStorage.setItem(TOKEN_KEY, token);
      } catch {
         /* ignora se storage indisponível */
      }
   },
   clear(): void {
      try {
         localStorage.removeItem(TOKEN_KEY);
      } catch {
         /* ignora */
      }
   },
};
